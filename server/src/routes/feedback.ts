import { Router, Response } from "express";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";

const router = Router();

router.use(authMiddleware);

async function isPrismUser(userId: string) {
  const result = await pool.query(
    "SELECT 1 FROM user_roles WHERE user_id = $1 AND role = 'prism' LIMIT 1",
    [userId]
  );
  return result.rows.length > 0;
}

router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { subject, message } = req.body;

    const trimmedSubject = String(subject || "").trim();
    const trimmedMessage = String(message || "").trim();

    if (!trimmedSubject || !trimmedMessage) {
      res.status(400).json({ error: "Subject and message are required" });
      return;
    }

    if (trimmedSubject.length > 200 || trimmedMessage.length > 4000) {
      res.status(400).json({ error: "Feedback is too long" });
      return;
    }

    const profileResult = await pool.query(
      "SELECT district, full_name, designation FROM profiles WHERE user_id = $1",
      [userId]
    );
    const profile = profileResult.rows[0];

    await pool.query(
      `INSERT INTO feedback_messages (user_id, district, full_name, designation, subject, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        profile?.district || "Unknown",
        profile?.full_name || null,
        profile?.designation || null,
        trimmedSubject,
        trimmedMessage,
      ]
    );

    res.status(201).json({ success: true });
  } catch (error: any) {
    console.error("Create feedback error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await isPrismUser(req.user!.userId))) {
      res.status(403).json({ error: "Prism access required" });
      return;
    }

    const result = await pool.query(
      `SELECT id, district, full_name, designation, subject, message, status, created_at
       FROM feedback_messages
       ORDER BY created_at DESC
       LIMIT 200`
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error("Get feedback error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
