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
/** JWT cryptographic expiry matches idle window; sliding refresh extends active sessions. */
const JWT_EXPIRES_IN_SECONDS = Math.floor(SESSION_IDLE_TIMEOUT_MS / 1000);

export const AUTH_COOKIE_NAME = "auth_token";

/** Session timeout policy (APTS CWE-613): 30m idle + 8h absolute; JWT matches idle. */
export function getSessionPolicy() {
  return {
    idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
    absoluteMaxMs: SESSION_ABSOLUTE_MAX_MS,
    jwtExpiresInSeconds: JWT_EXPIRES_IN_SECONDS,
  };
}

export type SessionFreshness = "ok" | "absolute_expired" | "idle_expired";

/** Server-side idle/absolute checks independent of JWT `exp` (defense in depth). */
export function evaluateSessionFreshness(
  createdAt: Date,
  lastActivityAt: Date,
  nowMs = Date.now()
): SessionFreshness {
  if (nowMs - createdAt.getTime() > SESSION_ABSOLUTE_MAX_MS) return "absolute_expired";
  if (nowMs - lastActivityAt.getTime() > SESSION_IDLE_TIMEOUT_MS) return "idle_expired";
  return "ok";
}

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

function sessionCookieMaxAge(createdAt: Date): number {
  const absoluteRemaining = SESSION_ABSOLUTE_MAX_MS - (Date.now() - createdAt.getTime());
  return Math.max(1000, absoluteRemaining);
}

export function authCookieOptions(maxAgeMs = SESSION_ABSOLUTE_MAX_MS) {
  const secure =
    process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIES === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: "strict" as const,
    maxAge: maxAgeMs,
    path: "/",
  };
}

export function authClearCookieOptions() {
  const { maxAge: _maxAge, ...options } = authCookieOptions();
  return options;
}

function signAccessToken(payload: { userId: string; email: string; jti: string }): string {
  return jwt.sign({ ...payload }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN_SECONDS,
    algorithm: "HS256",
  });
}

function tokenWasFromCookie(req: Request): boolean {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return false;
  return Boolean(
    req.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .some((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
  );
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

  return signAccessToken({ ...payload, jti });
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
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(`${AUTH_COOKIE_NAME}=`.length);
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

    const freshness = evaluateSessionFreshness(session.created_at, session.last_activity_at);
    if (freshness === "absolute_expired") {
      await revokeSessionById(payload.jti);
      res.status(401).json({ error: "Session expired. Please log in again." });
      return;
    }
    if (freshness === "idle_expired") {
      await revokeSessionById(payload.jti);
      res.status(401).json({ error: "Session expired due to inactivity. Please log in again." });
      return;
    }

    await touchSessionActivity(payload.jti);

    // Sliding window: refresh cookie JWT so cryptographic expiry matches the 30-minute idle policy.
    if (tokenWasFromCookie(req)) {
      const refreshedToken = signAccessToken({
        userId: payload.userId,
        email: payload.email,
        jti: payload.jti,
      });
      res.cookie(AUTH_COOKIE_NAME, refreshedToken, authCookieOptions(sessionCookieMaxAge(session.created_at)));
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
