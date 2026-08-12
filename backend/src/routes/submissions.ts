import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { authMiddleware, AuthRequest } from "../auth.js";
import { canPickDistrict, getUserAccess, requireSubmissionWriter, resolveDistrictForWrite } from "../rbac.js";
import {
  insertSubmission,
  getSubmissionsByUser,
  getSubmissionById,
  getSubmissionForSignedCopy,
  updateSignedCopy,
} from "../db/submissions.repo.js";
import {
  assertJsonFieldSize,
  ALLOWED_UPLOAD_MIME_TYPES,
  isAllowedUploadFilename,
  MAX_UPLOAD_BYTES,
  resolveUploadMimeType,
  toSignedCopyApiUrl,
} from "../security-utils.js";
import {
  cleanupQuarantineFile,
  processSecureDocumentUpload,
  promoteToPermanentStorage,
} from "../upload-pipeline.js";
import { UploadSecurityError, uploadErrorResponse } from "../upload-errors.js";
import {
  getUploadStorageRoot,
  quarantineOriginalDir,
  quarantineSanitizedDir,
} from "../upload-config.js";
import { insertActivityLog } from "../db/auth-activity.repo.js";

const uploadsDir = getUploadStorageRoot();
const quarantineOriginal = quarantineOriginalDir();
const quarantineSanitized = quarantineSanitizedDir();

for (const dir of [uploadsDir, quarantineOriginal, quarantineSanitized]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, quarantineOriginal),
  filename: (_req, _file, cb) => {
    const nonce = crypto.randomUUID();
    cb(null, `quarantine-${nonce}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedUploadFilename(file.originalname)) {
      cb(new Error("Invalid filename: only PDF or DOCX files are allowed (no double/manipulated extensions)"));
      return;
    }

    // Empty/octet-stream allowed here; extension + content checks still apply after upload.
    if (
      ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype) ||
      !file.mimetype ||
      file.mimetype === "application/octet-stream"
    ) {
      cb(null, true);
      return;
    }

    cb(new Error("Only PDF and DOCX files are allowed"));
  },
});

const router = Router();

// All routes require authentication
router.use(authMiddleware);

function safeUnlink(filePath: string | undefined) {
  cleanupQuarantineFile(filePath);
}

function respondUploadError(res: Response, err: unknown) {
  if (err instanceof UploadSecurityError) {
    res.status(err.httpStatus).json(uploadErrorResponse(err.code));
    return;
  }
  res.status(400).json(uploadErrorResponse("UNSAFE_DOCUMENT"));
}

// POST /api/submissions — create a new submission
function mapSubmissionRow(row: Record<string, unknown>) {
  return {
    ...row,
    signed_copy_url: toSignedCopyApiUrl(row.signed_copy_path as string | null),
  };
}

// POST /api/submissions — create a new submission
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireSubmissionWriter(req, res))) {
      return;
    }

    const userId = req.user!.userId;
    const {
      district, place_of_accident, mandal, police_station, fir_number,
      lat_long, road_type, accident_date, accident_time,
      persons_died, persons_injured, victim_details, vehicles, drivers,
      driver_related_causes, vehicle_condition_causes,
      road_engineering_culverts, road_engineering_junctions,
      road_engineering_median, road_engineering_nature, road_engineering_signages,
      prepared_by_name, prepared_by_designation, prepared_by_date,
      verified_by_name, verified_by_designation, verified_by_date,
      approved_by_name, approved_by_designation, approved_by_date,
    } = req.body;

    if (!district || !place_of_accident || !mandal || !police_station || !fir_number || !road_type || !accident_date || !accident_time) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Input length validation to prevent abuse
    const textFields = { district, place_of_accident, mandal, police_station, fir_number, road_type, accident_time };
    for (const [field, value] of Object.entries(textFields)) {
      if (typeof value !== "string" || value.length > 500) {
        res.status(400).json({ error: `Invalid or too long value for ${field}` });
        return;
      }
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(accident_date)) {
      res.status(400).json({ error: "Invalid date format" });
      return;
    }

    // Validate numeric fields
    const died = parseInt(persons_died, 10);
    const injured = parseInt(persons_injured, 10);
    if (isNaN(died) || isNaN(injured) || died < 0 || injured < 0 || died > 10000 || injured > 10000) {
      res.status(400).json({ error: "Invalid victim count" });
      return;
    }

    const victimDetails = Array.isArray(victim_details) ? victim_details : [];
    if (victimDetails.length > 1000) {
      res.status(400).json({ error: "Too many victim detail entries" });
      return;
    }

    const victimStatusCounts = victimDetails.reduce(
      (totals, item) => {
        if (!item || typeof item !== "object") {
          totals.invalid = true;
          return totals;
        }

        const name = typeof item.name === "string" ? item.name.trim() : "";
        const address = typeof item.address === "string" ? item.address.trim() : "";
        const status = typeof item.status === "string" ? item.status.trim().toLowerCase() : "";
        const gender = typeof item.gender === "string" ? item.gender.trim().toLowerCase() : "";
        const injuryType = typeof item.injury_type === "string" ? item.injury_type.trim().toLowerCase() : "";
        const age = Number(item.age);

        if (
          !name ||
          !address ||
          !Number.isFinite(age) ||
          age < 0 ||
          age > 150 ||
          !["died", "injured"].includes(status) ||
          !["male", "female", "other"].includes(gender)
        ) {
          totals.invalid = true;
          return totals;
        }

        if (name.length > 200 || address.length > 1000) {
          totals.invalid = true;
          return totals;
        }

        if (status === "injured" && !["simple", "grievous"].includes(injuryType)) {
          totals.invalid = true;
          return totals;
        }

        if (status === "died" && injuryType) {
          totals.invalid = true;
          return totals;
        }

        if (status === "died") totals.died += 1;
        if (status === "injured") totals.injured += 1;
        return totals;
      },
      { died: 0, injured: 0, invalid: false }
    );

    if (victimStatusCounts.invalid) {
      res.status(400).json({ error: "Invalid victim details" });
      return;
    }

    if (victimStatusCounts.died !== died || victimStatusCounts.injured !== injured) {
      res.status(400).json({ error: "Victim details count must match died and injured totals" });
      return;
    }

    const access = await getUserAccess(userId);
    const effectiveDistrict = resolveDistrictForWrite(access, district);
    if (!effectiveDistrict) {
      res.status(403).json({ error: "District profile is required to create submissions" });
      return;
    }

    if (!canPickDistrict(access) && effectiveDistrict !== district) {
      res.status(403).json({ error: "District must match your assigned profile district" });
      return;
    }

    try {
      assertJsonFieldSize(vehicles, "vehicles");
      assertJsonFieldSize(drivers, "drivers");
      assertJsonFieldSize(driver_related_causes, "driver_related_causes");
      assertJsonFieldSize(vehicle_condition_causes, "vehicle_condition_causes");
      assertJsonFieldSize(road_engineering_culverts, "road_engineering_culverts");
      assertJsonFieldSize(road_engineering_junctions, "road_engineering_junctions");
      assertJsonFieldSize(road_engineering_median, "road_engineering_median");
      assertJsonFieldSize(road_engineering_nature, "road_engineering_nature");
      assertJsonFieldSize(road_engineering_signages, "road_engineering_signages");
    } catch (sizeError: any) {
      res.status(400).json({ error: sizeError.message || "Payload too large" });
      return;
    }

    const created = await insertSubmission({
      userId, district: effectiveDistrict, place_of_accident, mandal, police_station, fir_number,
      lat_long: lat_long || null, road_type, accident_date, accident_time,
      persons_died: persons_died || 0, persons_injured: persons_injured || 0, victimDetails,
      vehicles: vehicles || [], drivers: drivers || [],
      driver_related_causes: driver_related_causes || {}, vehicle_condition_causes: vehicle_condition_causes || {},
      road_engineering_culverts: road_engineering_culverts || {}, road_engineering_junctions: road_engineering_junctions || {},
      road_engineering_median: road_engineering_median || {}, road_engineering_nature: road_engineering_nature || {},
      road_engineering_signages: road_engineering_signages || {},
      prepared_by_name: prepared_by_name || null, prepared_by_designation: prepared_by_designation || null, prepared_by_date: prepared_by_date || null,
      verified_by_name: verified_by_name || null, verified_by_designation: verified_by_designation || null, verified_by_date: verified_by_date || null,
      approved_by_name: approved_by_name || null, approved_by_designation: approved_by_designation || null, approved_by_date: approved_by_date || null,
    });

    res.status(201).json({ id: created.id, created_at: created.created_at });
  } catch (err: any) {
    console.error("Create submission error:", err);
    if (err?.message?.includes("maximum allowed size")) {
      res.status(400).json({ error: "One or more fields exceed maximum allowed size" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/submissions — get current user's submissions
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const rows = await getSubmissionsByUser(userId);

    res.json(rows.map((row) => mapSubmissionRow(row)));
  } catch (err: any) {
    console.error("Get submissions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/submissions/:id — get a single submission
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      res.status(400).json({ error: "Invalid submission ID" });
      return;
    }

    const access = await getUserAccess(userId);
    const submission = await getSubmissionById(id, access.canViewAnySubmission ? undefined : userId);

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json(mapSubmissionRow(submission));
  } catch (err: any) {
    console.error("Get submission error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/signed-copy", (req, res, next) => {
  upload.single("signedCopy")(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      res.status(413).json(uploadErrorResponse("FILE_TOO_LARGE"));
      return;
    }
    if (err) {
      res.status(400).json(uploadErrorResponse("INVALID_FILE_TYPE"));
      return;
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  const uploadedPath = req.file?.path;
  try {
    if (!(await requireSubmissionWriter(req, res))) {
      safeUnlink(uploadedPath);
      return;
    }

    const userId = req.user!.userId;
    const id = req.params.id as string;
    const file = req.file;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      safeUnlink(uploadedPath);
      res.status(400).json({ error: "Invalid submission ID" });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "Signed copy file is required" });
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      safeUnlink(file.path);
      res.status(413).json(uploadErrorResponse("FILE_TOO_LARGE"));
      return;
    }

    if (!isAllowedUploadFilename(file.originalname)) {
      safeUnlink(file.path);
      res.status(400).json(uploadErrorResponse("INVALID_FILE_TYPE"));
      return;
    }

    const mimeType = resolveUploadMimeType(file.originalname, file.mimetype);
    if (!mimeType) {
      safeUnlink(file.path);
      res.status(400).json(uploadErrorResponse("INVALID_FILE_TYPE"));
      return;
    }

    const access = await getUserAccess(userId);
    const scopeUserId = access.canViewAnySubmission ? undefined : userId;
    const submission = await getSubmissionForSignedCopy(id, scopeUserId);

    if (!submission) {
      safeUnlink(file.path);
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const pipelineResult = await processSecureDocumentUpload({
      quarantineOriginalPath: file.path,
      originalFilename: file.originalname,
      mimeType,
      fileSizeBytes: file.size,
      userId,
      submissionId: id,
    });

    const previousPath = submission.signed_copy_path;
    if (previousPath) {
      const absolutePreviousPath = path.resolve(process.cwd(), "uploads", previousPath);
      safeUnlink(absolutePreviousPath);
    }

    promoteToPermanentStorage(pipelineResult.sanitizedPath, uploadsDir, pipelineResult.storedFileName);
    safeUnlink(file.path);

    const relativePath = path.posix.join("signed-copies", pipelineResult.storedFileName);
    const updated = await updateSignedCopy(
      id,
      pipelineResult.storedFileName,
      relativePath,
      pipelineResult.sha256,
      scopeUserId
    );

    if (!updated) {
      safeUnlink(path.join(uploadsDir, pipelineResult.storedFileName));
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    await insertActivityLog(userId, "signed_copy_upload", req.ip || null, req.get("user-agent") || null, {
      submissionId: id,
      fileName: pipelineResult.storedFileName,
      originalFilename: file.originalname,
      sha256: pipelineResult.sha256,
      sizeBytes: file.size,
      securityStatus: pipelineResult.securityStatus,
      scanResultPre: pipelineResult.scanResultPre,
      scanResultPost: pipelineResult.scanResultPost,
      sanitizationApplied: pipelineResult.sanitizationApplied,
    });

    res.json({
      success: true,
      signed_copy_uploaded: true,
      signed_copy_name: pipelineResult.storedFileName,
      signed_copy_url: toSignedCopyApiUrl(relativePath),
      signed_copy_sha256: pipelineResult.sha256,
    });
  } catch (err: unknown) {
    console.error("Upload signed copy error:", err);
    safeUnlink(uploadedPath);
    if (err instanceof UploadSecurityError) {
      respondUploadError(res, err);
      return;
    }
    res.status(500).json({ success: false, code: "UNSAFE_DOCUMENT", message: "Internal server error" });
  }
});

export default router;
