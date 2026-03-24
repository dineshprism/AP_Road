import pool from "./db.js";

type UserTableName = "users" | "auth.users";

let cachedUserTable: UserTableName | null = null;

function normalizeLoginCandidates(username: string): string[] {
  const raw = username.trim();
  const lower = raw.toLowerCase();
  const normalized = lower.replace(/\s+/g, "_");

  return Array.from(new Set([raw, lower, normalized].filter(Boolean)));
}

export async function resolveUserTable(): Promise<UserTableName> {
  if (cachedUserTable) {
    return cachedUserTable;
  }

  const result = await pool.query<{
    public_users: string | null;
    auth_users: string | null;
  }>(
    `SELECT
       to_regclass('public.users')::text AS public_users,
       to_regclass('auth.users')::text AS auth_users`
  );

  if (result.rows[0]?.public_users) {
    cachedUserTable = "users";
    return cachedUserTable;
  }

  if (result.rows[0]?.auth_users) {
    cachedUserTable = "auth.users";
    return cachedUserTable;
  }

  throw new Error("No users table found. Expected public.users or auth.users.");
}

export async function findUserForLogin(username: string) {
  const userTable = await resolveUserTable();
  const candidates = normalizeLoginCandidates(username);

  const result = await pool.query<{
    id: string;
    email: string;
    password_hash: string;
  }>(
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
    [candidates.map((value) => value.toLowerCase()), username.trim().toLowerCase(), username.trim().toLowerCase().replace(/\s+/g, "_")]
  );

  return result.rows[0] ?? null;
}
