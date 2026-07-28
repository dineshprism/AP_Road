import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

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
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: false,
    sameSite: "lax" as const,
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: "/",
  };
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

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "24h",
    algorithm: "HS256",
  });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("auth_token="))
    ?.slice("auth_token=".length);
  const token = bearerToken || (cookieToken ? decodeURIComponent(cookieToken) : null);

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
