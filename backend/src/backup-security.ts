import { Request } from "express";
import { insertActivityLog } from "./db/auth-activity.repo.js";

/** Uses Express's trust-proxy-aware `req.ip` rather than the raw (client-spoofable) X-Forwarded-For header. */
export function getClientIp(req: Request): string {
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
    await insertActivityLog(userId, "backup_download", getClientIp(req) || null, req.get("user-agent") || null, details);
  } catch (error) {
    console.error("[backup] Failed to write audit log:", error);
  }
}
