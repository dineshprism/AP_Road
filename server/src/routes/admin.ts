import { Router, Response } from "express";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";

const router = Router();

// All admin routes require authentication + admin role
router.use(authMiddleware);

async function requireAdmin(req: AuthRequest, res: Response): Promise<boolean> {
  const roleResult = await pool.query(
    "SELECT role FROM user_roles WHERE user_id = $1 AND role IN ('admin', 'dgp', 'adgp')",
    [req.user!.userId]
  );
  if (roleResult.rows.length === 0) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// GET /api/admin/submissions — all submissions with filters
router.get("/submissions", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { district, year, month, date } = req.query;

    let query = "SELECT * FROM accident_submissions WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (district && district !== "all") {
      query += ` AND district = $${paramIndex++}`;
      params.push(district);
    }

    if (date) {
      query += ` AND accident_date = $${paramIndex++}`;
      params.push(date);
    } else if (year) {
      const yearNum = parseInt(year as string);
      if (month && month !== "all") {
        const monthNum = parseInt(month as string);
        const startDate = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
        const endDate = monthNum === 12
          ? `${yearNum + 1}-01-01`
          : `${yearNum}-${String(monthNum + 1).padStart(2, "0")}-01`;
        query += ` AND accident_date >= $${paramIndex++} AND accident_date < $${paramIndex++}`;
        params.push(startDate, endDate);
      } else {
        query += ` AND accident_date >= $${paramIndex++} AND accident_date < $${paramIndex++}`;
        params.push(`${yearNum}-01-01`, `${yearNum + 1}-01-01`);
      }
    }

    query += " ORDER BY accident_date DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error("Admin get submissions error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
