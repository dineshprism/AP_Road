import { Router, Response } from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";
import { generateToken, authMiddleware, AuthRequest } from "../auth.js";
import { findUserForLogin } from "../user-store.js";

const router = Router();

// POST /api/auth/login — login by username (district name or DGP/ADGP)
router.post("/login", async (req: AuthRequest, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
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

    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login service unavailable" });
  }
});

// GET /api/auth/me — get current user info + profile + roles
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
    const isAdmin = roles.includes("admin") || roles.includes("dgp") || roles.includes("adgp");

    res.json({
      user: { id: userId, email: req.user!.email },
      profile,
      isAdmin,
      roles,
    });
  } catch (err: any) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
