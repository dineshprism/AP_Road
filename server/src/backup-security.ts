import { Request } from "express";
import pool from "./db.js";

export function getClientIp(req: Request): string {
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "";
  }
  return req.ip || req.socket.remoteAddress || "";
}

/** Optional comma-separated IPs allowed for Prism backup (empty = allow all). */
export function isPrismBackupIpAllowed(req: Request): boolean {
  const allowlist = process.env.PRISM_BACKUP_IP_ALLOWLIST?.trim();
  if (!allowlist) return true;

  const clientIp = getClientIp(req);
  const allowed = allowlist.split(",").map((entry) => entry.trim()).filter(Boolean);
  return allowed.some((entry) => clientIp === entry);
}

export async function logBackupDownload(
  userId: string,
  req: Request,
  details: { filename: string; submissionCount: number; uploadCount: number }
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO auth_activity_log (user_id, event_type, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [
        userId,
        "backup_download",
        getClientIp(req) || null,
        req.get("user-agent") || null,
        JSON.stringify(details),
      ]
    );
  } catch (error) {
    console.error("[backup] Failed to write audit log:", error);
  }
}
