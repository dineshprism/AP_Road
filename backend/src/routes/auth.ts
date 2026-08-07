import { Router, Response } from "express";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import {
  generateToken,
  authMiddleware,
  AuthRequest,
  authCookieOptions,
  authClearCookieOptions,
  getTokenFromRequest,
  verifyToken,
  revokeSession,
} from "../auth.js";
import { findUserForLogin } from "../user-store.js";
import { STATE_VIEWER_ROLES } from "../rbac.js";
import { getProfileSummary, getRolesByUserId } from "../db/access.repo.js";
import { getPreviousLoginAt, recordUserLogin } from "../db/users.repo.js";
import { insertActivityLog } from "../db/auth-activity.repo.js";
import { MIN_PASSWORD_LENGTH } from "../security-utils.js";
import { createCaptchaChallenge, verifyCaptchaAnswer } from "../captcha.js";
import { rateLimitKeyGenerator } from "../rate-limit-utils.js";

const router = Router();
const AUTH_COOKIE_NAME = "auth_token";
const loginRateLimitMax = parseInt(process.env.LOGIN_RATE_LIMIT_MAX || "1000000", 10);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: loginRateLimitMax,
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  validate: { xForwardedForHeader: false },
});

async function logAuthActivity(
  userId: string | null,
  eventType: string,
  req: AuthRequest,
  metadata: Record<string, unknown>
) {
  try {
    await insertActivityLog(userId, eventType, req.ip || null, req.get("user-agent") || null, metadata);
  } catch (activityError) {
    console.error("Failed to record auth activity:", activityError);
  }
}

router.get("/captcha", (_req, res: Response) => {
  const { captchaId, svg } = createCaptchaChallenge();
  res.json({ captchaId, image: svg });
});

router.post("/login", loginLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { username, password, captchaId, captchaAnswer } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    if (!captchaId || !captchaAnswer) {
      res.status(400).json({ error: "CAPTCHA verification is required" });
      return;
    }

    if (!verifyCaptchaAnswer(captchaId, String(captchaAnswer))) {
      await logAuthActivity(null, "login_failure", req, { username, reason: "captcha_failed" });
      res.status(400).json({ error: "Incorrect CAPTCHA. Please try again." });
      return;
    }

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const user = await findUserForLogin(username);

    if (!user) {
      await logAuthActivity(null, "login_failure", req, { username, reason: "unknown_username" });
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      await logAuthActivity(user.id, "login_failure", req, { username, reason: "bad_password" });
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const lastLoginAt = await recordUserLogin(user.id);
    const token = await generateToken({ userId: user.id, email: user.email });

    await logAuthActivity(user.id, "login_success", req, { username });

    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    res.json({
      user: { id: user.id, email: user.email },
      lastLoginAt: lastLoginAt ? lastLoginAt.toISOString() : null,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login service unavailable" });
  }
});

router.post("/logout", async (req: AuthRequest, res: Response) => {
  const token = getTokenFromRequest(req);
  if (token) {
    try {
      const payload = verifyToken(token);
      await revokeSession(payload.jti);
    } catch {
      // Token already invalid/expired — nothing to revoke.
    }
  }
  res.clearCookie(AUTH_COOKIE_NAME, authClearCookieOptions());
  res.json({ success: true });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const profile = await getProfileSummary(userId);
    const roles = await getRolesByUserId(userId);
    const isAdmin = roles.some((role) => (STATE_VIEWER_ROLES as readonly string[]).includes(role));
    const isPrism = roles.includes("prism");
    const lastLoginAt = await getPreviousLoginAt(userId);

    res.json({
      user: { id: userId, email: req.user!.email },
      profile,
      isAdmin,
      isPrism,
      canViewAnySubmission: roles.some((role) =>
        ["admin", "dgp", "adgp", "prism"].includes(role)
      ),
      roles,
      lastLoginAt: lastLoginAt ? lastLoginAt.toISOString() : null,
    });
  } catch (err: any) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
