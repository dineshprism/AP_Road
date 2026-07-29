import pool from "../db.js";

export interface ProAnalyticsRow {
  id: string;
  district: string;
  place_of_accident: string;
  mandal: string;
  police_station: string;
  fir_number: string;
  road_type: string;
  accident_date: string;
  accident_time: string | null;
  persons_died: number;
  persons_injured: number;
  signed_copy_uploaded: boolean;
  created_at: string;
}

export async function getScopedSubmissions(whereClause: string, params: string[]) {
  const result = await pool.query<ProAnalyticsRow>(
    `SELECT
        id,
        district,
        place_of_accident,
        mandal,
        police_station,
        fir_number,
        road_type,
        accident_date::text,
        accident_time,
        persons_died,
        persons_injured,
        signed_copy_uploaded,
        created_at
     FROM accident_submissions
     WHERE ${whereClause}
     ORDER BY created_at DESC, fir_number`,
    params
  );

  return result.rows;
}
