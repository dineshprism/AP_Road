import pool from "../db.js";

export interface AnalyticsRow {
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
  road_engineering_culverts: unknown;
  road_engineering_junctions: unknown;
  road_engineering_median: unknown;
  road_engineering_nature: unknown;
  road_engineering_signages: unknown;
  signed_copy_uploaded: boolean;
  created_at: string;
}

export async function getScopedAnalyticsRows(whereClause: string, params: Array<string>) {
  const result = await pool.query<AnalyticsRow>(
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
        lat_long,
        persons_died,
        persons_injured,
        vehicles,
        drivers,
        driver_related_causes,
        vehicle_condition_causes,
        road_engineering_culverts,
        road_engineering_junctions,
        road_engineering_median,
        road_engineering_nature,
        road_engineering_signages,
        signed_copy_uploaded,
        created_at
     FROM accident_submissions
     WHERE ${whereClause}
     ORDER BY accident_date DESC, created_at DESC`,
    params
  );

  return result.rows;
}
