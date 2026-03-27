import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const knownBadSecrets = ["fallback-dev-secret", "change-this-to-a-random-64-char-secret-in-production"];
  if (!secret || secret.length < 32 || knownBadSecrets.includes(secret)) {
    if (process.env.NODE_ENV === "production") {
      console.error("FATAL: JWT_SECRET is not set or is insecure. Set a strong random secret in production.");
      process.exit(1);
    }
    // Dev-only: generate a random ephemeral secret (tokens won't survive restarts)
    console.warn("WARNING: JWT_SECRET not configured. Using ephemeral random secret. Set JWT_SECRET for persistent sessions.");
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

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authorization header missing or invalid" });
    return;
  }

  try {
    const token = header.slice(7);
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
