import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";
import { canPickDistrict, getUserAccess, resolveDistrictForWrite } from "../rbac.js";
import {
  assertJsonFieldSize,
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
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `upload-${Date.now()}-${req.params.id}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
    ]);

    if (allowedMimeTypes.has(file.mimetype)) {
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
  const allowedExt = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
  const extension = allowedExt.has(originalExt) ? originalExt : ".pdf";

  return `${districtShortcut}_${firPart}_${idPart}${extension}`;
}

function mapSubmissionRow(row: Record<string, unknown>) {
  return {
    ...row,
    signed_copy_url: toSignedCopyApiUrl(row.signed_copy_path as string | null),
  };
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

    const result = await pool.query(
      `INSERT INTO accident_submissions (
        user_id, district, place_of_accident, mandal, police_station, fir_number,
        lat_long, road_type, accident_date, accident_time,
        persons_died, persons_injured, victim_details, vehicles, drivers,
        driver_related_causes, vehicle_condition_causes,
        road_engineering_culverts, road_engineering_junctions,
        road_engineering_median, road_engineering_nature, road_engineering_signages,
        prepared_by_name, prepared_by_designation, prepared_by_date,
        verified_by_name, verified_by_designation, verified_by_date,
        approved_by_name, approved_by_designation, approved_by_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17,
        $18, $19,
        $20, $21, $22,
        $23, $24, $25,
        $26, $27, $28,
        $29, $30, $31
      ) RETURNING id, created_at`,
      [
        userId, effectiveDistrict, place_of_accident, mandal, police_station, fir_number,
        lat_long || null, road_type, accident_date, accident_time,
        persons_died || 0, persons_injured || 0, JSON.stringify(victimDetails),
        JSON.stringify(vehicles || []), JSON.stringify(drivers || []),
        JSON.stringify(driver_related_causes || {}), JSON.stringify(vehicle_condition_causes || {}),
        JSON.stringify(road_engineering_culverts || {}), JSON.stringify(road_engineering_junctions || {}),
        JSON.stringify(road_engineering_median || {}), JSON.stringify(road_engineering_nature || {}),
        JSON.stringify(road_engineering_signages || {}),
        prepared_by_name || null, prepared_by_designation || null, prepared_by_date || null,
        verified_by_name || null, verified_by_designation || null, verified_by_date || null,
        approved_by_name || null, approved_by_designation || null, approved_by_date || null,
      ]
    );

    res.status(201).json({ id: result.rows[0].id, created_at: result.rows[0].created_at });
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

    const result = await pool.query(
      "SELECT * FROM accident_submissions WHERE user_id = $1 ORDER BY created_at DESC",
      [userId]
    );

    res.json(result.rows.map((row) => mapSubmissionRow(row)));
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

    let result;
    if (access.canViewAnySubmission) {
      result = await pool.query("SELECT * FROM accident_submissions WHERE id = $1", [id]);
    } else {
      result = await pool.query(
        "SELECT * FROM accident_submissions WHERE id = $1 AND user_id = $2",
        [id, userId]
      );
    }

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json(mapSubmissionRow(result.rows[0]));
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

    if (!hasAllowedFileSignature(file.path, file.mimetype)) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "Uploaded file content does not match an allowed PDF, JPG, or PNG file" });
      return;
    }

    const access = await getUserAccess(userId);

    const existingResult = access.canViewAnySubmission
      ? await pool.query("SELECT district, fir_number, signed_copy_path FROM accident_submissions WHERE id = $1", [id])
      : await pool.query("SELECT district, fir_number, signed_copy_path FROM accident_submissions WHERE id = $1 AND user_id = $2", [id, userId]);

    if (existingResult.rows.length === 0) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const submission = existingResult.rows[0] as { district: string; fir_number: string; signed_copy_path: string | null };
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

    const relativePath = path.posix.join("signed-copies", finalFileName);
    const updateResult = access.canViewAnySubmission
      ? await pool.query(
          `UPDATE accident_submissions
           SET signed_copy_uploaded = TRUE,
               signed_copy_name = $1,
               signed_copy_path = $2,
               signed_copy_uploaded_at = now()
           WHERE id = $3
           RETURNING id`,
          [finalFileName, relativePath, id]
        )
      : await pool.query(
          `UPDATE accident_submissions
           SET signed_copy_uploaded = TRUE,
               signed_copy_name = $1,
               signed_copy_path = $2,
               signed_copy_uploaded_at = now()
           WHERE id = $3 AND user_id = $4
           RETURNING id`,
          [finalFileName, relativePath, id, userId]
        );

    if (updateResult.rows.length === 0) {
      fs.unlinkSync(finalPath);
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json({
      signed_copy_uploaded: true,
      signed_copy_name: finalFileName,
      signed_copy_url: toSignedCopyApiUrl(relativePath),
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
