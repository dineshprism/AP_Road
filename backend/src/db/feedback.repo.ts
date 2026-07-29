import pool from "../db.js";

/** Data-access layer for feedback_messages. */

export async function insertFeedback(
  userId: string,
  district: string,
  fullName: string | null,
  designation: string | null,
  subject: string,
  message: string
): Promise<void> {
  await pool.query(
    `INSERT INTO feedback_messages (user_id, district, full_name, designation, subject, message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, district, fullName, designation, subject, message]
  );
}

export async function getRecentFeedback(limit: number) {
  const result = await pool.query(
    `SELECT id, district, full_name, designation, subject, message, status, created_at
     FROM feedback_messages
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
