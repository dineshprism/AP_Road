import { Router, Response } from "express";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";

const router = Router();

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

    res.json(result.rows);
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

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error("Get submission error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
