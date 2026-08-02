import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { insertSession, revokeSessionById, isSessionActive, deleteExpiredSessions } from "./db/sessions.repo.js";

const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SESSION_CLEANUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const knownBadSecrets = ["fallback-dev-secret", "change-this-to-a-random-64-char-secret-in-production"];
  if (!secret || secret.length < 32 || knownBadSecrets.includes(secret)) {
    if (process.env.NODE_ENV === "production") {
      console.error("FATAL: JWT_SECRET is not set or is insecure. Set a strong random secret in production.");
      process.exit(1);
    }
    if (process.env.DEV_ALLOW_EPHEMERAL_JWT !== "true") {
      console.warn("WARNING: JWT_SECRET not configured. Set JWT_SECRET or DEV_ALLOW_EPHEMERAL_JWT=true for ephemeral dev sessions.");
    }
    return crypto.randomBytes(64).toString("hex");
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

export interface AuthPayload {
  userId: string;
  email: string;
  jti: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// export function authCookieOptions() {
//   const secure =
//     process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIES === "true";
//   return {
//     httpOnly: true,
//     secure,
//     sameSite: "strict" as const,
//     maxAge: AUTH_COOKIE_MAX_AGE_MS,
//     path: "/",
//   };
// }

export function authCookieOptions() {
  const secure = process.env.FORCE_SECURE_COOKIES === "true";

  return {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  };
}

/** Best-effort cleanup so active_sessions doesn't grow unbounded; never blocks the caller. */
function cleanupExpiredSessions() {
  const cutoff = new Date(Date.now() - SESSION_CLEANUP_RETENTION_MS);
  deleteExpiredSessions(cutoff).catch((err) => console.error("Session cleanup failed:", err));
}

export async function generateToken(payload: { userId: string; email: string }): Promise<string> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + AUTH_COOKIE_MAX_AGE_MS);

  await insertSession(jti, payload.userId, expiresAt);
  cleanupExpiredSessions();

  return jwt.sign({ ...payload, jti }, JWT_SECRET, {
    expiresIn: "24h",
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
}

export function getTokenFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("auth_token="))
    ?.slice("auth_token=".length);
  return bearerToken || (cookieToken ? decodeURIComponent(cookieToken) : null);
}

/** Revokes a session immediately so a copied/replayed token stops working right away. */
export async function revokeSession(jti: string | undefined): Promise<void> {
  if (!jti) return;
  try {
    await revokeSessionById(jti);
  } catch (err) {
    console.error("Failed to revoke session:", err);
  }
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = getTokenFromRequest(req);

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyToken(token);

    // Tokens issued before session tracking was added have no jti and are no longer honored.
    if (!payload.jti || !(await isSessionActive(payload.jti))) {
      res.status(401).json({ error: "Session has been signed out. Please log in again." });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
