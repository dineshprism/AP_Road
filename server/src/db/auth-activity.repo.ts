import pool from "../db.js";

/** Data-access layer for auth_activity_log (login/logout/backup audit trail). */

export async function insertActivityLog(
  userId: string | null,
  eventType: string,
  ipAddress: string | null,
  userAgent: string | null,
  metadata: Record<string, unknown>
): Promise<void> {
  await pool.query(
    `INSERT INTO auth_activity_log (user_id, event_type, ip_address, user_agent, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, eventType, ipAddress, userAgent, JSON.stringify(metadata)]
  );
}

export interface ActivitySummary {
  total_logins: number;
  logins_last_24h: number;
  total_submissions: number;
  submissions_last_24h: number;
  active_submission_districts: number;
}

export async function getActivitySummary(): Promise<ActivitySummary | undefined> {
  const result = await pool.query<ActivitySummary>(
    `SELECT
        (SELECT COUNT(*) FROM auth_activity_log WHERE event_type = 'login_success')::int AS total_logins,
        (SELECT COUNT(*) FROM auth_activity_log WHERE event_type = 'login_success' AND created_at >= now() - interval '24 hours')::int AS logins_last_24h,
        (SELECT COUNT(*) FROM accident_submissions)::int AS total_submissions,
        (SELECT COUNT(*) FROM accident_submissions WHERE created_at >= now() - interval '24 hours')::int AS submissions_last_24h,
        (SELECT COUNT(DISTINCT district) FROM accident_submissions)::int AS active_submission_districts`
  );
  return result.rows[0];
}

export async function getLoginEvents(limit: number) {
  const result = await pool.query(
    `SELECT
        log.id,
        log.event_type,
        log.ip_address,
        log.user_agent,
        log.created_at,
        users.email AS username,
        profiles.district,
        profiles.full_name,
        profiles.designation
     FROM auth_activity_log log
     JOIN users ON users.id = log.user_id
     LEFT JOIN profiles ON profiles.user_id = log.user_id
     WHERE log.event_type = 'login_success'
     ORDER BY log.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function getRecentSubmissionEvents(limit: number) {
  const result = await pool.query(
    `SELECT
        s.id,
        s.fir_number,
        s.district,
        s.police_station,
        s.place_of_accident,
        s.mandal,
        s.created_at,
        users.email AS username,
        profiles.full_name,
        profiles.designation
     FROM accident_submissions s
     JOIN users ON users.id = s.user_id
     LEFT JOIN profiles ON profiles.user_id = s.user_id
     ORDER BY s.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}
