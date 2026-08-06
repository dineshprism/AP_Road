import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { authMiddleware, AuthRequest } from "../auth.js";
import { canPickDistrict, getUserAccess, requireRoles, resolveDistrictForWrite, SUBMISSION_WRITER_ROLES } from "../rbac.js";
import {
  insertSubmission,
  getSubmissionsByUser,
  getSubmissionById,
  getSubmissionForSignedCopy,
  updateSignedCopy,
} from "../db/submissions.repo.js";
import {
  assertJsonFieldSize,
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  isAllowedUploadFilename,
  MAX_UPLOAD_BYTES,
  toSignedCopyApiUrl,
} from "../security-utils.js";

const router = Router();
const uploadsDir = path.resolve(process.cwd(), "uploads", "signed-copies");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  // Temp name is server-generated only; final name is set via getSignedCopyFileName.
  filename: (req, _file, cb) => {
    const idPart = String(req.params.id || "tmp").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36);
    const nonce = crypto.randomBytes(8).toString("hex");
    cb(null, `upload-${Date.now()}-${idPart}-${nonce}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedUploadFilename(file.originalname)) {
      cb(new Error("Invalid filename: only single-extension PDF, JPG, or PNG files are allowed"));
      return;
    }

    if (ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new Error("Only PDF, JPG, and PNG files are allowed"));
  },
});

// All routes require authentication
router.use(authMiddleware);

function sanitizeFilePart(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function getDistrictShortcut(district: string) {
  const normalized = district.trim();
  const knownShortcuts: Record<string, string> = {
    "YSR Kadapa": "YSRK",
    "Sri Potti Sriramulu Nellore": "SPSN",
    "Alluri Sitharama Raju": "ASR",
    "Dr. B.R. Ambedkar Konaseema": "BRAK",
    "NTR": "NTR",
  };

  if (knownShortcuts[normalized]) {
    return knownShortcuts[normalized];
  }

  const words = normalized
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= 1) {
    return sanitizeFilePart(words[0] || "DIST").slice(0, 5).toUpperCase() || "DIST";
  }

  return words.map((word) => word[0]).join("").slice(0, 5).toUpperCase();
}

function getSignedCopyFileName(
  submissionId: string,
  district: string,
  firNumber: string,
  originalName: string
) {
  const districtShortcut = getDistrictShortcut(district);
  const firPart = sanitizeFilePart(firNumber) || "FIR";
  const idPart = sanitizeFilePart(submissionId).slice(0, 12) || "SUB";
  const originalExt = path.extname(originalName).toLowerCase();
  const extension = ALLOWED_UPLOAD_EXTENSIONS.has(originalExt) ? originalExt : ".pdf";

  return `${districtShortcut}_${firPart}_${idPart}${extension}`;
}

function mapSubmissionRow(row: Record<string, unknown>) {
  return {
    ...row,
    signed_copy_url: toSignedCopyApiUrl(row.signed_copy_path as string | null),
  };
}

function computeSha256(filePath: string) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function hasAllowedFileSignature(filePath: string, mimeType: string) {
  const header = fs.readFileSync(filePath).subarray(0, 8);
  if (mimeType === "application/pdf") {
    return header.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mimeType === "image/jpeg") {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return false;
}

// POST /api/submissions — create a new submission
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireRoles(req, res, SUBMISSION_WRITER_ROLES, "Submission access denied"))) {
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
      const maxMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
      res.status(413).json({ error: `File exceeds maximum upload size (${maxMb} MB)` });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message || "Invalid upload" });
      return;
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireRoles(req, res, SUBMISSION_WRITER_ROLES, "Submission access denied"))) {
      if (req.file) fs.unlinkSync(req.file.path);
      return;
    }

    const userId = req.user!.userId;
    const id = req.params.id as string;
    const file = req.file;

    // Validate UUID format to prevent path traversal
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      if (file) fs.unlinkSync(file.path);
      res.status(400).json({ error: "Invalid submission ID" });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "Signed copy file is required" });
      return;
    }

    if (!isAllowedUploadFilename(file.originalname)) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "Invalid filename: only single-extension PDF, JPG, or PNG files are allowed" });
      return;
    }

    if (!hasAllowedFileSignature(file.path, file.mimetype)) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "Uploaded file content does not match an allowed PDF, JPG, or PNG file" });
      return;
    }

    const access = await getUserAccess(userId);
    const scopeUserId = access.canViewAnySubmission ? undefined : userId;

    const submission = await getSubmissionForSignedCopy(id, scopeUserId);

    if (!submission) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const previousPath = submission.signed_copy_path;
    if (previousPath) {
      const absolutePreviousPath = path.resolve(process.cwd(), "uploads", previousPath);
      if (fs.existsSync(absolutePreviousPath)) {
        fs.unlinkSync(absolutePreviousPath);
      }
    }

    const finalFileName = getSignedCopyFileName(id, submission.district, submission.fir_number, file.originalname);
    const finalPath = path.join(uploadsDir, finalFileName);
    if (file.path !== finalPath) {
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
      }
      fs.renameSync(file.path, finalPath);
    }

    const sha256 = computeSha256(finalPath);
    const relativePath = path.posix.join("signed-copies", finalFileName);
    const updated = await updateSignedCopy(id, finalFileName, relativePath, sha256, scopeUserId);

    if (!updated) {
      fs.unlinkSync(finalPath);
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json({
      signed_copy_uploaded: true,
      signed_copy_name: finalFileName,
      signed_copy_url: toSignedCopyApiUrl(relativePath),
      signed_copy_sha256: sha256,
    });
  } catch (err: any) {
    console.error("Upload signed copy error:", err);
    if (err?.code === "LIMIT_FILE_SIZE") {
      const maxMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
      res.status(413).json({ error: `File exceeds maximum upload size (${maxMb} MB)` });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
