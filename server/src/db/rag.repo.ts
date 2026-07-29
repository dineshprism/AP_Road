import pool from "../db.js";

export interface AccidentSubmissionRecord {
  id: string;
  district: string;
  place_of_accident: string;
  mandal: string;
  police_station: string;
  fir_number: string;
  road_type: string;
  accident_date: string;
  accident_time: string | null;
  lat_long: string | null;
  persons_died: number;
  persons_injured: number;
  vehicles: unknown;
  drivers: unknown;
  driver_related_causes: unknown;
  vehicle_condition_causes: unknown;
  road_engineering_nature: unknown;
  road_engineering_junctions: unknown;
  road_engineering_signages: unknown;
  road_engineering_median: unknown;
  road_engineering_culverts: unknown;
}

const SELECT_FIELDS = `id, district, place_of_accident, mandal, police_station, fir_number,
                road_type, accident_date, accident_time, lat_long, persons_died, persons_injured,
                vehicles, drivers, driver_related_causes, vehicle_condition_causes,
                road_engineering_nature, road_engineering_junctions, road_engineering_signages,
                road_engineering_median, road_engineering_culverts`;

export async function getSubmissionsByIds(submissionIds: string[]): Promise<AccidentSubmissionRecord[]> {
  const result = await pool.query<AccidentSubmissionRecord>(
    `SELECT ${SELECT_FIELDS}
     FROM accident_submissions
     WHERE id = ANY($1::uuid[])`,
    [submissionIds]
  );
  return result.rows;
}

export async function getSubmissionsByIdsForUser(
  submissionIds: string[],
  userId: string
): Promise<AccidentSubmissionRecord[]> {
  const result = await pool.query<AccidentSubmissionRecord>(
    `SELECT ${SELECT_FIELDS}
     FROM accident_submissions
     WHERE id = ANY($1::uuid[]) AND user_id = $2`,
    [submissionIds, userId]
  );
  return result.rows;
}
