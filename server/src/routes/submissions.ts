import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";

const router = Router();
const uploadsDir = path.resolve(process.cwd(), "uploads", "signed-copies");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${req.params.id}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
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

// POST /api/submissions — create a new submission
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      district, place_of_accident, mandal, police_station, fir_number,
      lat_long, road_type, accident_date, accident_time,
      persons_died, persons_injured, vehicles, drivers,
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

    const result = await pool.query(
      `INSERT INTO accident_submissions (
        user_id, district, place_of_accident, mandal, police_station, fir_number,
        lat_long, road_type, accident_date, accident_time,
        persons_died, persons_injured, vehicles, drivers,
        driver_related_causes, vehicle_condition_causes,
        road_engineering_culverts, road_engineering_junctions,
        road_engineering_median, road_engineering_nature, road_engineering_signages,
        prepared_by_name, prepared_by_designation, prepared_by_date,
        verified_by_name, verified_by_designation, verified_by_date,
        approved_by_name, approved_by_designation, approved_by_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16,
        $17, $18,
        $19, $20, $21,
        $22, $23, $24,
        $25, $26, $27,
        $28, $29, $30
      ) RETURNING id, created_at`,
      [
        userId, district, place_of_accident, mandal, police_station, fir_number,
        lat_long || null, road_type, accident_date, accident_time,
        persons_died || 0, persons_injured || 0,
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

    res.json(
      result.rows.map((row) => ({
        ...row,
        signed_copy_url: row.signed_copy_path ? `/uploads/${row.signed_copy_path}` : null,
      }))
    );
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

    // Check if user is admin/dgp/adgp
    const roleResult = await pool.query(
      "SELECT role FROM user_roles WHERE user_id = $1 AND role IN ('admin', 'dgp', 'adgp')",
      [userId]
    );
    const isAdmin = roleResult.rows.length > 0;

    let result;
    if (isAdmin) {
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

    const row = result.rows[0];
    res.json({
      ...row,
      signed_copy_url: row.signed_copy_path ? `/uploads/${row.signed_copy_path}` : null,
    });
  } catch (err: any) {
    console.error("Get submission error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/signed-copy", upload.single("signedCopy"), async (req: AuthRequest, res: Response) => {
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

    const roleResult = await pool.query(
      "SELECT role FROM user_roles WHERE user_id = $1 AND role IN ('admin', 'dgp', 'adgp')",
      [userId]
    );
    const isAdmin = roleResult.rows.length > 0;

    const existingResult = isAdmin
      ? await pool.query("SELECT signed_copy_path FROM accident_submissions WHERE id = $1", [id])
      : await pool.query("SELECT signed_copy_path FROM accident_submissions WHERE id = $1 AND user_id = $2", [id, userId]);

    if (existingResult.rows.length === 0) {
      fs.unlinkSync(file.path);
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    const previousPath = existingResult.rows[0].signed_copy_path as string | null;
    if (previousPath) {
      const absolutePreviousPath = path.resolve(process.cwd(), "uploads", previousPath);
      if (fs.existsSync(absolutePreviousPath)) {
        fs.unlinkSync(absolutePreviousPath);
      }
    }

    const relativePath = path.posix.join("signed-copies", path.basename(file.path));
    await pool.query(
      `UPDATE accident_submissions
       SET signed_copy_uploaded = TRUE,
           signed_copy_name = $1,
           signed_copy_path = $2,
           signed_copy_uploaded_at = now()
       WHERE id = $3`,
      [file.originalname, relativePath, id]
    );

    res.json({
      signed_copy_uploaded: true,
      signed_copy_name: file.originalname,
      signed_copy_url: `/uploads/${relativePath}`,
    });
  } catch (err: any) {
    console.error("Upload signed copy error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
