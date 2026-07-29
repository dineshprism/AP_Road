import pool from "../db.js";

/** Data-access layer for active_sessions (JWT session tracking / revocation). */

export async function insertSession(id: string, userId: string, expiresAt: Date): Promise<void> {
  await pool.query(
    "INSERT INTO active_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
    [id, userId, expiresAt]
  );
}

export async function revokeSessionById(jti: string): Promise<void> {
  await pool.query("UPDATE active_sessions SET revoked_at = now() WHERE id = $1", [jti]);
}

export async function isSessionActive(jti: string): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM active_sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()",
    [jti]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function deleteExpiredSessions(cutoff: Date): Promise<void> {
  await pool.query("DELETE FROM active_sessions WHERE expires_at < $1", [cutoff]);
}
