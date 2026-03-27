import { Router, Response } from "express";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";

const router = Router();

// All analytics routes require authentication + admin role
router.use(authMiddleware);

async function requireAdmin(req: AuthRequest, res: Response): Promise<boolean> {
  const roleResult = await pool.query(
    "SELECT role FROM user_roles WHERE user_id = $1 AND role IN ('admin', 'dgp', 'adgp')",
    [req.user!.userId]
  );
  if (roleResult.rows.length === 0) {
    res.status(403).json({ error: "Admin access required" });
    return false;
  }
  return true;
}

// Helper to build WHERE clause and params
function buildWhereClause(district?: string, year?: string) {
  const params: any[] = [];
  const yearNum = parseInt(year as string) || new Date().getFullYear();
  
  params.push(`${yearNum}-01-01`, `${yearNum + 1}-01-01`);
  let whereClause = `accident_date >= $1 AND accident_date < $2`;
  
  if (district && district !== "all") {
    params.push(district);
    whereClause += ` AND district = $${params.length}`;
  }

  return { whereClause, params };
}

// GET /api/analytics — comprehensive analytics data
router.get("/analytics", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { district, year } = req.query;
    const { whereClause, params } = buildWhereClause(district as string, year as string);

    // Summary Stats
    const summaryResult = await pool.query(
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

    const summary = {
      totalAccidents: parseInt(summaryResult.rows[0]?.total_accidents || 0),
      totalDeaths: parseInt(summaryResult.rows[0]?.total_deaths || 0),
      totalInjuries: parseInt(summaryResult.rows[0]?.total_injuries || 0),
      averageDeathsPerAccident: parseFloat(summaryResult.rows[0]?.avg_deaths_per_accident || 0),
      averageFatalityRate: parseFloat(summaryResult.rows[0]?.fatality_rate || 0),
    };

    // Trend Data (monthly)
    const trendResult = await pool.query(
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

    const trendData = trendResult.rows.map(row => ({
      month: row.month_name,
      accidents: parseInt(row.accidents || 0),
      deaths: parseInt(row.deaths || 0),
      injuries: parseInt(row.injuries || 0),
    }));

    // Driver Causes - Safe approach: get all data and analyze in code
    const allSubmissionsResult = await pool.query(
      `SELECT driver_related_causes FROM accident_submissions
      WHERE ${whereClause} AND driver_related_causes IS NOT NULL`,
      params
    );

    const driverCausesCounts: { [key: string]: number } = {};
    allSubmissionsResult.rows.forEach((row) => {
      if (row.driver_related_causes && typeof row.driver_related_causes === 'object') {
        Object.keys(row.driver_related_causes).forEach((cause) => {
          driverCausesCounts[cause] = (driverCausesCounts[cause] || 0) + 1;
        });
      }
    });

    const driverCauses = Object.entries(driverCausesCounts)
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Road Condition Causes - combining all road engineering factors
    const roadEngineeringNatureResult = await pool.query(
      `SELECT road_engineering_nature FROM accident_submissions
      WHERE ${whereClause} AND road_engineering_nature IS NOT NULL`,
      params
    );

    const roadEngineeringJunctionsResult = await pool.query(
      `SELECT road_engineering_junctions FROM accident_submissions
      WHERE ${whereClause} AND road_engineering_junctions IS NOT NULL`,
      params
    );

    const roadEngineeringSigResult = await pool.query(
      `SELECT road_engineering_signages FROM accident_submissions
      WHERE ${whereClause} AND road_engineering_signages IS NOT NULL`,
      params
    );

    const roadEngineeringCulvertsResult = await pool.query(
      `SELECT road_engineering_culverts FROM accident_submissions
      WHERE ${whereClause} AND road_engineering_culverts IS NOT NULL`,
      params
    );

    const roadEngineeringMedianResult = await pool.query(
      `SELECT road_engineering_median FROM accident_submissions
      WHERE ${whereClause} AND road_engineering_median IS NOT NULL`,
      params
    );

    const roadConditionCounts: { [key: string]: number } = {};

    // Aggregate all road engineering factors
    [roadEngineeringNatureResult, roadEngineeringJunctionsResult, roadEngineeringSigResult,
     roadEngineeringCulvertsResult, roadEngineeringMedianResult].forEach((result) => {
      result.rows.forEach((row) => {
        const data = row.road_engineering_nature || row.road_engineering_junctions 
                  || row.road_engineering_signages || row.road_engineering_culverts
                  || row.road_engineering_median;
        if (data && typeof data === 'object') {
          Object.keys(data).forEach((cause) => {
            roadConditionCounts[cause] = (roadConditionCounts[cause] || 0) + 1;
          });
        }
      });
    });

    const roadConditionCauses = Object.entries(roadConditionCounts)
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // District Comparison
    const districtResult = await pool.query(
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

    const districtComparison = districtResult.rows.map(row => ({
      district: row.district,
      accidents: parseInt(row.accidents || 0),
      deaths: parseInt(row.deaths || 0),
      injuries: parseInt(row.injuries || 0),
      deathRate: parseFloat(row.death_rate || 0),
    }));

    // Road Type Analysis
    const roadTypeResult = await pool.query(
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

    const roadTypeAnalysis = roadTypeResult.rows.map(row => ({
      roadType: row.road_type,
      accidents: parseInt(row.accidents || 0),
      deaths: parseInt(row.deaths || 0),
    }));

    // Hotspots - locations with multiple incidents
    const hotspotsResult = await pool.query(`
      SELECT 
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
      LIMIT 30
    `, params);

    const hotspotsLocations = hotspotsResult.rows.map(row => ({
      place: row.place,
      district: row.district,
      accidents: parseInt(row.accidents),
      deaths: parseInt(row.deaths),
      injured: parseInt(row.injured),
    }));

    // Overall Cause Analysis (top causes)
    const allCauses = [
      ...Object.entries(driverCausesCounts).map(([cause, count]) => ({ cause, count, type: 'driver' })),
      ...Object.entries(roadConditionCounts).map(([cause, count]) => ({ cause, count, type: 'road' })),
    ]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const causeAnalysis = allCauses.map((item) => {
      const total = allCauses.reduce((sum, c) => sum + c.count, 0);
      return {
        cause: item.cause,
        count: item.count,
        percentage: total > 0 ? (item.count / total) * 100 : 0,
      };
    });

    res.json({
      summary,
      trendData,
      causeAnalysis,
      districtComparison,
      roadTypeAnalysis,
      hotspotsLocations,
      driverCauses,
      vehicleCauses: [], // Can be expanded similar to driverCauses
      roadConditionCauses,
    });
  } catch (err: any) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to generate analytics" });
  }
});

// GET /api/analytics/export — export analytics as CSV
router.get("/analytics/export", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { district, year, format } = req.query;
    const { whereClause, params } = buildWhereClause(district as string, year as string);

    const result = await pool.query(
      `SELECT 
        id, district, place_of_accident, mandal, police_station,
        fir_number, accident_date, persons_died, persons_injured, road_type
      FROM accident_submissions
      WHERE ${whereClause}
      ORDER BY accident_date DESC`,
      params
    );

    if (format === "csv") {
      const headers = [
        "ID", "District", "Location", "Mandal", "Police Station",
        "FIR Number", "Accident Date", "Deaths", "Injuries", "Road Type"
      ];

      const rows = result.rows.map(row => [
        row.id,
        row.district,
        row.place_of_accident,
        row.mandal,
        row.police_station,
        row.fir_number,
        new Date(row.accident_date).toLocaleDateString("en-IN"),
        row.persons_died,
        row.persons_injured,
        row.road_type,
      ]);

      const csv = [
        headers.join(","),
        ...rows.map(r => r.map(cell => `"${cell}"`).join(",")),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="analytics-${year}.csv"`);
      res.send(csv);
    } else {
      res.json(result.rows);
    }
  } catch (err: any) {
    console.error("Analytics export error:", err);
    res.status(500).json({ error: "Failed to export analytics" });
  }
});

export default router;
