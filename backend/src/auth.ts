import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  insertSession,
  revokeSessionById,
  revokeAllSessionsForUser,
  getActiveSession,
  touchSessionActivity,
  deleteExpiredSessions,
} from "./db/sessions.repo.js";

const SESSION_IDLE_TIMEOUT_MS = Math.max(
  60_000,
  parseInt(process.env.SESSION_IDLE_TIMEOUT_MS || String(30 * 60 * 1000), 10)
);
/** Absolute session cap (default 8h); idle timeout still enforced separately. */
const SESSION_ABSOLUTE_MAX_MS = Math.max(
  SESSION_IDLE_TIMEOUT_MS,
  parseInt(process.env.SESSION_ABSOLUTE_MAX_MS || String(8 * 60 * 60 * 1000), 10)
);
const SESSION_CLEANUP_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const JWT_EXPIRES_IN_SECONDS = Math.floor(SESSION_ABSOLUTE_MAX_MS / 1000);

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

export function authCookieOptions() {
  const secure =
    process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIES === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    maxAge: SESSION_ABSOLUTE_MAX_MS,
    path: "/",
  };
}

export function authClearCookieOptions() {
  const { maxAge: _maxAge, ...options } = authCookieOptions();
  return options;
}

/** Best-effort cleanup so active_sessions doesn't grow unbounded; never blocks the caller. */
function cleanupExpiredSessions() {
  const cutoff = new Date(Date.now() - SESSION_CLEANUP_RETENTION_MS);
  deleteExpiredSessions(cutoff).catch((err) => console.error("Session cleanup failed:", err));
}

export async function generateToken(payload: { userId: string; email: string }): Promise<string> {
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_ABSOLUTE_MAX_MS);

  // Single concurrent session: invalidate any existing sessions before issuing a new one.
  await revokeAllSessionsForUser(payload.userId);
  await insertSession(jti, payload.userId, expiresAt);
  cleanupExpiredSessions();

  return jwt.sign({ ...payload, jti }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN_SECONDS,
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
    if (!payload.jti) {
      res.status(401).json({ error: "Session has been signed out. Please log in again." });
      return;
    }

    const session = await getActiveSession(payload.jti);
    if (!session) {
      res.status(401).json({ error: "Session has been signed out. Please log in again." });
      return;
    }

    const lastActivity = new Date(session.last_activity_at).getTime();
    if (Date.now() - lastActivity > SESSION_IDLE_TIMEOUT_MS) {
      await revokeSessionById(payload.jti);
      res.status(401).json({ error: "Session expired due to inactivity. Please log in again." });
      return;
    }

    await touchSessionActivity(payload.jti);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
