import { Router, Response } from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";
import { generateToken, authMiddleware, AuthRequest } from "../auth.js";

const router = Router();
const SALT_ROUNDS = 12;

// POST /api/auth/signup
router.post("/signup", async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, full_name, district, designation } = req.body;

    if (!email || !password || !full_name || !district) {
      res.status(400).json({ error: "email, password, full_name, and district are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    // Check existing user
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Create user
      const userResult = await client.query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
        [email.toLowerCase().trim(), passwordHash]
      );
      const userId = userResult.rows[0].id;

      // Assign default role
      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, 'user')",
        [userId]
      );

      // Create profile
      await client.query(
        "INSERT INTO profiles (user_id, full_name, district, designation) VALUES ($1, $2, $3, $4)",
        [userId, full_name.trim(), district.trim(), designation?.trim() || null]
      );

      await client.query("COMMIT");

      const token = generateToken({ userId, email: email.toLowerCase().trim() });

      res.status(201).json({
        token,
        user: { id: userId, email: email.toLowerCase().trim() },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/login
router.post("/login", async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const result = await pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
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
    const isAdmin = roles.includes("admin");

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
