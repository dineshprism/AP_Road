import pool from "../db.js";

export interface ReportSubmission {
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
  victim_details: unknown;
  vehicles: unknown;
  driver_related_causes: unknown;
  vehicle_condition_causes: unknown;
  road_engineering_culverts: unknown;
  road_engineering_junctions: unknown;
  road_engineering_median: unknown;
  road_engineering_nature: unknown;
  road_engineering_signages: unknown;
}

export async function getSubmissionsInDateRange(
  timeZone: string,
  fromDate: string,
  toDate: string
): Promise<ReportSubmission[]> {
  const result = await pool.query<ReportSubmission>(
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
        victim_details,
        vehicles,
        driver_related_causes,
        vehicle_condition_causes,
        road_engineering_culverts,
        road_engineering_junctions,
        road_engineering_median,
        road_engineering_nature,
        road_engineering_signages
     FROM accident_submissions
     WHERE (created_at AT TIME ZONE '${timeZone}')::date >= $1
       AND (created_at AT TIME ZONE '${timeZone}')::date <= $2
     ORDER BY district, created_at, fir_number`,
    [fromDate, toDate]
  );

  return result.rows;
}
