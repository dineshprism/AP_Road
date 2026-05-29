import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";
import { requireElevated } from "../rbac.js";
import { buildMigrationBundle } from "../dataBundleExport.js";

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, "../../uploads");

const backupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  message: { error: "Backup limit reached. Please wait before downloading again." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authMiddleware);

async function requirePrism(req: AuthRequest, res: Response): Promise<boolean> {
  const roleResult = await pool.query(
    "SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'prism' LIMIT 1",
    [req.user!.userId]
  );
  if (roleResult.rows.length === 0) {
    res.status(403).json({ error: "Prism access required" });
    return false;
  }
  return true;
}

// GET /api/admin/submissions — all submissions with filters
router.get("/submissions", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireElevated(req, res))) return;

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

// GET /api/admin/backup — full seed-ready export (Prism only)
router.get("/backup", backupLimiter, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();

  try {
    if (!(await requirePrism(req, res))) return;

    console.log(`[backup] Started by user ${req.user!.userId}`);
    const bundle = await buildMigrationBundle(client, {
      includeUploads: true,
      uploadsRoot,
    });

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `road-accident-backup-${stamp}.json`;
    const submissionCount = bundle.tables.accident_submissions?.rows.length ?? 0;
    const uploadCount = bundle.uploads?.length ?? 0;

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Backup-Submissions", String(submissionCount));
    res.setHeader("X-Backup-Uploads", String(uploadCount));
    res.json(bundle);

    console.log(
      `[backup] Completed for user ${req.user!.userId}: ${submissionCount} submissions, ${uploadCount} signed copies`
    );
  } catch (err: any) {
    console.error("Admin backup error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Backup failed" });
    }
  } finally {
    client.release();
  }
});

router.get("/activity", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requirePrism(req, res))) return;

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const loginLimit = Math.min(Math.max(Number(req.query.loginLimit || 100), 1), 500);
    const submissionLimit = Math.min(Math.max(Number(req.query.submissionLimit || 100), 1), 500);

    const [summaryResult, loginEventsResult, submissionEventsResult] = await Promise.all([
      pool.query(
        `SELECT
            (SELECT COUNT(*) FROM auth_activity_log WHERE event_type = 'login_success')::int AS total_logins,
            (SELECT COUNT(*) FROM auth_activity_log WHERE event_type = 'login_success' AND created_at >= now() - interval '24 hours')::int AS logins_last_24h,
            (SELECT COUNT(*) FROM accident_submissions)::int AS total_submissions,
            (SELECT COUNT(*) FROM accident_submissions WHERE created_at >= now() - interval '24 hours')::int AS submissions_last_24h,
            (SELECT COUNT(DISTINCT district) FROM accident_submissions)::int AS active_submission_districts`
      ),
      pool.query(
        `SELECT
            log.id,
            log.event_type,
            log.ip_address,
            log.user_agent,
            log.created_at,
            users.email AS username,
            profiles.district,
            profiles.full_name,
            profiles.designation
         FROM auth_activity_log log
         JOIN users ON users.id = log.user_id
         LEFT JOIN profiles ON profiles.user_id = log.user_id
         WHERE log.event_type = 'login_success'
         ORDER BY log.created_at DESC
         LIMIT $1`,
        [loginLimit]
      ),
      pool.query(
        `SELECT
            s.id,
            s.fir_number,
            s.district,
            s.police_station,
            s.place_of_accident,
            s.mandal,
            s.created_at,
            users.email AS username,
            profiles.full_name,
            profiles.designation
         FROM accident_submissions s
         JOIN users ON users.id = s.user_id
         LEFT JOIN profiles ON profiles.user_id = s.user_id
         ORDER BY s.created_at DESC
         LIMIT $1`,
        [submissionLimit]
      ),
    ]);

    res.json({
      summary: summaryResult.rows[0] || {
        total_logins: 0,
        logins_last_24h: 0,
        total_submissions: 0,
        submissions_last_24h: 0,
        active_submission_districts: 0,
      },
      loginEvents: loginEventsResult.rows,
      submissionEvents: submissionEventsResult.rows,
    });
  } catch (err: any) {
    console.error("Admin activity fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
