import type { Request } from "express";

/** Prefer the real client IP when nginx forwards X-Forwarded-For. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

export const rateLimitKeyGenerator = (req: Request): string => getClientIp(req);

/** Paths under /api that have dedicated limiters or must stay reachable during login flows. */
export function isExemptFromGlobalApiRateLimit(req: Request): boolean {
  const path = req.path || "";
  if (path === "/health") return true;
  if (path === "/auth/captcha" && req.method === "GET") return true;
  if (path === "/auth/login" && req.method === "POST") return true;
  return false;
}
