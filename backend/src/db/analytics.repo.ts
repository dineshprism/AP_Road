import pool from "../db.js";

/** Data-access layer for the /api/analytics summary+export endpoints. */

export async function getSummaryStats(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT
      COUNT(*) as total_accidents,
      COALESCE(SUM(persons_died), 0) as total_deaths,
      COALESCE(SUM(persons_injured), 0) as total_injuries,
      COALESCE(AVG(persons_died), 0)::numeric as avg_deaths_per_accident,
      CASE
        WHEN SUM(persons_died) + SUM(persons_injured) > 0
        THEN (SUM(persons_died)::float / (SUM(persons_died) + SUM(persons_injured))::float)
        ELSE 0
      END as fatality_rate
    FROM accident_submissions
    WHERE ${whereClause}`,
    params
  );
  return result.rows[0];
}

export async function getMonthlyTrend(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT
      DATE_TRUNC('month', accident_date) as month,
      TO_CHAR(accident_date, 'Mon') as month_name,
      COUNT(*) as accidents,
      COALESCE(SUM(persons_died), 0)::int as deaths,
      COALESCE(SUM(persons_injured), 0)::int as injuries
    FROM accident_submissions
    WHERE ${whereClause}
    GROUP BY DATE_TRUNC('month', accident_date), TO_CHAR(accident_date, 'Mon')
    ORDER BY DATE_TRUNC('month', accident_date)`,
    params
  );
  return result.rows;
}

export async function getDriverRelatedCauses(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT driver_related_causes FROM accident_submissions
    WHERE ${whereClause} AND driver_related_causes IS NOT NULL`,
    params
  );
  return result.rows;
}

export async function getRoadEngineeringNature(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT road_engineering_nature FROM accident_submissions
    WHERE ${whereClause} AND road_engineering_nature IS NOT NULL`,
    params
  );
  return result.rows;
}

export async function getRoadEngineeringJunctions(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT road_engineering_junctions FROM accident_submissions
    WHERE ${whereClause} AND road_engineering_junctions IS NOT NULL`,
    params
  );
  return result.rows;
}

export async function getRoadEngineeringSignages(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT road_engineering_signages FROM accident_submissions
    WHERE ${whereClause} AND road_engineering_signages IS NOT NULL`,
    params
  );
  return result.rows;
}

export async function getRoadEngineeringCulverts(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT road_engineering_culverts FROM accident_submissions
    WHERE ${whereClause} AND road_engineering_culverts IS NOT NULL`,
    params
  );
  return result.rows;
}

export async function getRoadEngineeringMedian(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT road_engineering_median FROM accident_submissions
    WHERE ${whereClause} AND road_engineering_median IS NOT NULL`,
    params
  );
  return result.rows;
}

export async function getDistrictComparison(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT
      district,
      COUNT(*) as accidents,
      COALESCE(SUM(persons_died), 0)::int as deaths,
      COALESCE(SUM(persons_injured), 0)::int as injuries,
      (CAST(COALESCE(SUM(persons_died), 0) AS FLOAT) / NULLIF(COUNT(*), 0)) as death_rate
    FROM accident_submissions
    WHERE ${whereClause}
    GROUP BY district
    ORDER BY accidents DESC`,
    params
  );
  return result.rows;
}

export async function getRoadTypeAnalysis(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT
      road_type,
      COUNT(*) as accidents,
      COALESCE(SUM(persons_died), 0)::int as deaths
    FROM accident_submissions
    WHERE ${whereClause} AND road_type IS NOT NULL
    GROUP BY road_type
    ORDER BY accidents DESC`,
    params
  );
  return result.rows;
}

export async function getHotspots(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT
      place_of_accident as place,
      district,
      COUNT(*) as accidents,
      COALESCE(SUM(persons_died), 0) as deaths,
      COALESCE(SUM(persons_injured), 0) as injured
    FROM accident_submissions
    WHERE ${whereClause}
    GROUP BY place_of_accident, district
    HAVING COUNT(*) >= 2
    ORDER BY accidents DESC
    LIMIT 30`,
    params
  );
  return result.rows;
}

export async function getExportRows(whereClause: string, params: any[]) {
  const result = await pool.query(
    `SELECT
      id, district, place_of_accident, mandal, police_station,
      fir_number, accident_date, persons_died, persons_injured, road_type
    FROM accident_submissions
    WHERE ${whereClause}
    ORDER BY accident_date DESC`,
    params
  );
  return result.rows;
}
