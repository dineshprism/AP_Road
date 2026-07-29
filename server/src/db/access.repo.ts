import pool from "../db.js";

/**
 * Data-access layer for role/profile lookups (user_roles, profiles).
 * The same roles+district lookup was previously duplicated across rbac.ts,
 * routes/analytics-pro.ts, and routes/enhanced-analytics.ts.
 */

export async function getRolesByUserId(userId: string): Promise<string[]> {
  const result = await pool.query("SELECT role FROM user_roles WHERE user_id = $1", [userId]);
  return result.rows.map((row) => String(row.role));
}

export async function getDistrictByUserId(userId: string): Promise<string | null> {
  const result = await pool.query("SELECT district FROM profiles WHERE user_id = $1", [userId]);
  return result.rows[0]?.district ? String(result.rows[0].district) : null;
}

export async function getUserRolesAndDistrict(
  userId: string
): Promise<{ roles: string[]; district: string | null }> {
  const [roleResult, profileResult] = await Promise.all([
    pool.query("SELECT role FROM user_roles WHERE user_id = $1", [userId]),
    pool.query("SELECT district FROM profiles WHERE user_id = $1", [userId]),
  ]);

  return {
    roles: roleResult.rows.map((row) => String(row.role)),
    district: profileResult.rows[0]?.district ? String(profileResult.rows[0].district) : null,
  };
}

export interface ProfileSummary {
  full_name: string | null;
  district: string | null;
  designation: string | null;
}

export async function getProfileSummary(userId: string): Promise<ProfileSummary | null> {
  const result = await pool.query<ProfileSummary>(
    "SELECT full_name, district, designation FROM profiles WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function hasAnyRole(userId: string, roles: readonly string[]): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM user_roles WHERE user_id = $1 AND role::text = ANY($2::text[]) LIMIT 1",
    [userId, roles]
  );
  return (result.rowCount ?? 0) > 0;
}
