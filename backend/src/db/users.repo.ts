import pool from "../db.js";

/** Data-access layer for the users table (login lookup). */

export type UserTableName = "users" | "auth.users";

export async function resolveUserTableName(): Promise<UserTableName | null> {
  const result = await pool.query<{
    public_users: string | null;
    auth_users: string | null;
  }>(
    `SELECT
       to_regclass('public.users')::text AS public_users,
       to_regclass('auth.users')::text AS auth_users`
  );

  if (result.rows[0]?.public_users) return "users";
  if (result.rows[0]?.auth_users) return "auth.users";
  return null;
}

export interface LoginUserRow {
  id: string;
  email: string;
  password_hash: string;
}

export async function findUserByEmailCandidates(
  userTable: UserTableName,
  candidates: string[],
  primaryLower: string,
  underscoredLower: string
): Promise<LoginUserRow | null> {
  const result = await pool.query<LoginUserRow>(
    `SELECT id, email, password_hash
     FROM ${userTable}
     WHERE LOWER(email) = ANY($1::text[])
     ORDER BY
       CASE
         WHEN LOWER(email) = $2 THEN 0
         WHEN LOWER(email) = $3 THEN 1
         ELSE 2
       END
     LIMIT 1`,
    [candidates.map((value) => value.toLowerCase()), primaryLower, underscoredLower]
  );

  return result.rows[0] ?? null;
}

/** Reads previous last_login_at, updates to now(), returns the prior timestamp. */
export async function recordUserLogin(userId: string): Promise<Date | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const prev = await client.query<{ last_login_at: Date | null }>(
      "SELECT last_login_at FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    const previousLastLogin = prev.rows[0]?.last_login_at ?? null;
    await client.query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
    await client.query("COMMIT");
    return previousLastLogin;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getPreviousLoginAt(userId: string): Promise<Date | null> {
  const result = await pool.query<{ created_at: Date }>(
    `SELECT created_at
     FROM auth_activity_log
     WHERE user_id = $1 AND event_type = 'login_success'
     ORDER BY created_at DESC
     OFFSET 1
     LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.created_at ?? null;
}
