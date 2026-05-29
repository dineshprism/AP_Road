import { Router, Response } from "express";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import pool from "../db.js";
import { generateToken, authMiddleware, AuthRequest, authCookieOptions } from "../auth.js";
import { findUserForLogin } from "../user-store.js";
import { STATE_VIEWER_ROLES } from "../rbac.js";
import { MIN_PASSWORD_LENGTH } from "../security-utils.js";

const router = Router();
const AUTH_COOKIE_NAME = "auth_token";
const loginRateLimitMax = parseInt(process.env.LOGIN_RATE_LIMIT_MAX || "30", 10);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: loginRateLimitMax,
  message: { error: "Too many login attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      return;
    }

    const user = await findUserForLogin(username);

    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    try {
      await pool.query(
        `INSERT INTO auth_activity_log (user_id, event_type, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
          user.id,
          "login_success",
          req.ip || null,
          req.get("user-agent") || null,
          JSON.stringify({ username }),
        ]
      );
    } catch (activityError) {
      console.error("Failed to record login activity:", activityError);
    }

    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
    res.json({
      user: { id: user.id, email: user.email },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login service unavailable" });
  }
});

router.post("/logout", (_req: AuthRequest, res: Response) => {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions());
  res.json({ success: true });
});

router.get("/me", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const profileResult = await pool.query(
      "SELECT full_name, district, designation FROM profiles WHERE user_id = $1",
      [userId]
    );

    const roleResult = await pool.query(
      "SELECT role FROM user_roles WHERE user_id = $1",
      [userId]
    );

    const profile = profileResult.rows[0] || null;
    const roles = roleResult.rows.map((r) => r.role);
    const isAdmin = roles.some((role) => (STATE_VIEWER_ROLES as readonly string[]).includes(role));
    const isPrism = roles.includes("prism");

    res.json({
      user: { id: userId, email: req.user!.email },
      profile,
      isAdmin,
      isPrism,
      canViewAnySubmission: roles.some((role) =>
        ["admin", "dgp", "adgp", "prism"].includes(role)
      ),
      roles,
    });
  } catch (err: any) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
