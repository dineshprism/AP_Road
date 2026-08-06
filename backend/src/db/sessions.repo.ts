import pool from "../db.js";

/** Data-access layer for active_sessions (JWT session tracking / revocation). */

export interface ActiveSessionRow {
  id: string;
  last_activity_at: Date;
}

export async function insertSession(id: string, userId: string, expiresAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO active_sessions (id, user_id, expires_at, last_activity_at)
     VALUES ($1, $2, $3, now())`,
    [id, userId, expiresAt]
  );
}

export async function revokeSessionById(jti: string): Promise<void> {
  await pool.query("UPDATE active_sessions SET revoked_at = now() WHERE id = $1", [jti]);
}

/** Revoke every non-revoked session for a user (enforces a single concurrent login). */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await pool.query(
    "UPDATE active_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId]
  );
}

export async function getActiveSession(jti: string): Promise<ActiveSessionRow | null> {
  const result = await pool.query<ActiveSessionRow>(
    `SELECT id, last_activity_at
     FROM active_sessions
     WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [jti]
  );
  return result.rows[0] ?? null;
}

export async function isSessionActive(jti: string): Promise<boolean> {
  return (await getActiveSession(jti)) !== null;
}

export async function touchSessionActivity(jti: string): Promise<void> {
  await pool.query(
    "UPDATE active_sessions SET last_activity_at = now() WHERE id = $1 AND revoked_at IS NULL",
    [jti]
  );
}

export async function deleteExpiredSessions(cutoff: Date): Promise<void> {
  await pool.query("DELETE FROM active_sessions WHERE expires_at < $1", [cutoff]);
}
