import pool from "../db.js";

/** Data-access layer for accident_submissions. */

export interface NewSubmissionInput {
  userId: string;
  district: string;
  place_of_accident: string;
  mandal: string;
  police_station: string;
  fir_number: string;
  lat_long: string | null;
  road_type: string;
  accident_date: string;
  accident_time: string;
  persons_died: number;
  persons_injured: number;
  victimDetails: unknown;
  vehicles: unknown;
  drivers: unknown;
  driver_related_causes: unknown;
  vehicle_condition_causes: unknown;
  road_engineering_culverts: unknown;
  road_engineering_junctions: unknown;
  road_engineering_median: unknown;
  road_engineering_nature: unknown;
  road_engineering_signages: unknown;
  prepared_by_name: string | null;
  prepared_by_designation: string | null;
  prepared_by_date: string | null;
  verified_by_name: string | null;
  verified_by_designation: string | null;
  verified_by_date: string | null;
  approved_by_name: string | null;
  approved_by_designation: string | null;
  approved_by_date: string | null;
}

export async function insertSubmission(input: NewSubmissionInput) {
  const result = await pool.query(
    `INSERT INTO accident_submissions (
      user_id, district, place_of_accident, mandal, police_station, fir_number,
      lat_long, road_type, accident_date, accident_time,
      persons_died, persons_injured, victim_details, vehicles, drivers,
      driver_related_causes, vehicle_condition_causes,
      road_engineering_culverts, road_engineering_junctions,
      road_engineering_median, road_engineering_nature, road_engineering_signages,
      prepared_by_name, prepared_by_designation, prepared_by_date,
      verified_by_name, verified_by_designation, verified_by_date,
      approved_by_name, approved_by_designation, approved_by_date
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17,
      $18, $19,
      $20, $21, $22,
      $23, $24, $25,
      $26, $27, $28,
      $29, $30, $31
    ) RETURNING id, created_at`,
    [
      input.userId, input.district, input.place_of_accident, input.mandal, input.police_station, input.fir_number,
      input.lat_long, input.road_type, input.accident_date, input.accident_time,
      input.persons_died, input.persons_injured, JSON.stringify(input.victimDetails),
      JSON.stringify(input.vehicles), JSON.stringify(input.drivers),
      JSON.stringify(input.driver_related_causes), JSON.stringify(input.vehicle_condition_causes),
      JSON.stringify(input.road_engineering_culverts), JSON.stringify(input.road_engineering_junctions),
      JSON.stringify(input.road_engineering_median), JSON.stringify(input.road_engineering_nature),
      JSON.stringify(input.road_engineering_signages),
      input.prepared_by_name, input.prepared_by_designation, input.prepared_by_date,
      input.verified_by_name, input.verified_by_designation, input.verified_by_date,
      input.approved_by_name, input.approved_by_designation, input.approved_by_date,
    ]
  );

  return result.rows[0] as { id: string; created_at: string };
}

export async function getSubmissionsByUser(userId: string) {
  const result = await pool.query(
    "SELECT * FROM accident_submissions WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return result.rows;
}

export async function getSubmissionById(id: string, scopeToUserId?: string) {
  const result = scopeToUserId
    ? await pool.query("SELECT * FROM accident_submissions WHERE id = $1 AND user_id = $2", [id, scopeToUserId])
    : await pool.query("SELECT * FROM accident_submissions WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export interface SignedCopyLookup {
  district: string;
  fir_number: string;
  signed_copy_path: string | null;
}

export async function getSubmissionForSignedCopy(id: string, scopeToUserId?: string): Promise<SignedCopyLookup | null> {
  const result = scopeToUserId
    ? await pool.query<SignedCopyLookup>(
        "SELECT district, fir_number, signed_copy_path FROM accident_submissions WHERE id = $1 AND user_id = $2",
        [id, scopeToUserId]
      )
    : await pool.query<SignedCopyLookup>(
        "SELECT district, fir_number, signed_copy_path FROM accident_submissions WHERE id = $1",
        [id]
      );
  return result.rows[0] ?? null;
}

export async function updateSignedCopy(
  id: string,
  finalFileName: string,
  relativePath: string,
  sha256: string,
  scopeToUserId?: string
) {
  const result = scopeToUserId
    ? await pool.query(
        `UPDATE accident_submissions
         SET signed_copy_uploaded = TRUE,
             signed_copy_name = $1,
             signed_copy_path = $2,
             signed_copy_uploaded_at = now(),
             signed_copy_sha256 = $3
         WHERE id = $4 AND user_id = $5
         RETURNING id`,
        [finalFileName, relativePath, sha256, id, scopeToUserId]
      )
    : await pool.query(
        `UPDATE accident_submissions
         SET signed_copy_uploaded = TRUE,
             signed_copy_name = $1,
             signed_copy_path = $2,
             signed_copy_uploaded_at = now(),
             signed_copy_sha256 = $3
         WHERE id = $4
         RETURNING id`,
        [finalFileName, relativePath, sha256, id]
      );
  return result.rows[0] ?? null;
}

export async function getSubmissionBySignedCopyPath(relativePath: string) {
  const result = await pool.query(
    "SELECT id, user_id, district FROM accident_submissions WHERE signed_copy_path = $1",
    [relativePath]
  );
  return result.rows[0] ?? null;
}
