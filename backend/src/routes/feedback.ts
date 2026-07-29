import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../auth.js";
import { getProfileSummary, hasAnyRole } from "../db/access.repo.js";
import { insertFeedback, getRecentFeedback } from "../db/feedback.repo.js";

const router = Router();

router.use(authMiddleware);

async function isPrismUser(userId: string) {
  return hasAnyRole(userId, ["prism"]);
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

    const profile = await getProfileSummary(userId);

    await insertFeedback(
      userId,
      profile?.district || "Unknown",
      profile?.full_name || null,
      profile?.designation || null,
      trimmedSubject,
      trimmedMessage
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

    const rows = await getRecentFeedback(200);

    res.json(rows);
  } catch (error: any) {
    console.error("Get feedback error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
