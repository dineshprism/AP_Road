import { Router, Response } from "express";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";
import { requireElevated } from "../rbac.js";
import { buildMigrationBundle } from "../dataBundleExport.js";
import { isPrismBackupIpAllowed, logBackupDownload } from "../backup-security.js";
import { hasAnyRole } from "../db/access.repo.js";
import { getSubmissionsFiltered } from "../db/admin.repo.js";
import { getActivitySummary, getLoginEvents, getRecentSubmissionEvents } from "../db/auth-activity.repo.js";

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
  if (!(await hasAnyRole(req.user!.userId, ["prism"]))) {
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
    const rows = await getSubmissionsFiltered({
      district: district as string | undefined,
      year: year as string | undefined,
      month: month as string | undefined,
      date: date as string | undefined,
    });
    res.json(rows);
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

    if (!isPrismBackupIpAllowed(req)) {
      res.status(403).json({ error: "Backup download is not allowed from this network" });
      return;
    }

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

    await logBackupDownload(req.user!.userId, req, {
      filename,
      submissionCount,
      uploadCount,
    });

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

    const [summary, loginEvents, submissionEvents] = await Promise.all([
      getActivitySummary(),
      getLoginEvents(loginLimit),
      getRecentSubmissionEvents(submissionLimit),
    ]);

    res.json({
      summary: summary || {
        total_logins: 0,
        logins_last_24h: 0,
        total_submissions: 0,
        submissions_last_24h: 0,
        active_submission_districts: 0,
      },
      loginEvents,
      submissionEvents,
    });
  } catch (err: any) {
    console.error("Admin activity fetch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
