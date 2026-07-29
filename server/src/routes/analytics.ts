import { Router, Response } from "express";
import { authMiddleware, AuthRequest } from "../auth.js";
import { requireStateViewer } from "../rbac.js";
import { escapeCsvCell } from "../security-utils.js";
import {
  getSummaryStats,
  getMonthlyTrend,
  getDriverRelatedCauses,
  getRoadEngineeringNature,
  getRoadEngineeringJunctions,
  getRoadEngineeringSignages,
  getRoadEngineeringCulverts,
  getRoadEngineeringMedian,
  getDistrictComparison,
  getRoadTypeAnalysis,
  getHotspots,
  getExportRows,
} from "../db/analytics.repo.js";

const router = Router();

router.use(authMiddleware);

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
    if (!(await requireStateViewer(req, res))) return;

    const { district, year } = req.query;
    const { whereClause, params } = buildWhereClause(district as string, year as string);

    // Summary Stats
    const summaryRow = await getSummaryStats(whereClause, params);

    const summary = {
      totalAccidents: parseInt(summaryRow?.total_accidents || 0),
      totalDeaths: parseInt(summaryRow?.total_deaths || 0),
      totalInjuries: parseInt(summaryRow?.total_injuries || 0),
      averageDeathsPerAccident: parseFloat(summaryRow?.avg_deaths_per_accident || 0),
      averageFatalityRate: parseFloat(summaryRow?.fatality_rate || 0),
    };

    // Trend Data (monthly)
    const trendRows = await getMonthlyTrend(whereClause, params);

    const trendData = trendRows.map(row => ({
      month: row.month_name,
      accidents: parseInt(row.accidents || 0),
      deaths: parseInt(row.deaths || 0),
      injuries: parseInt(row.injuries || 0),
    }));

    // Driver Causes - Safe approach: get all data and analyze in code
    const allSubmissionsRows = await getDriverRelatedCauses(whereClause, params);

    const driverCausesCounts: { [key: string]: number } = {};
    allSubmissionsRows.forEach((row) => {
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
    const [
      roadEngineeringNatureRows,
      roadEngineeringJunctionsRows,
      roadEngineeringSigRows,
      roadEngineeringCulvertsRows,
      roadEngineeringMedianRows,
    ] = await Promise.all([
      getRoadEngineeringNature(whereClause, params),
      getRoadEngineeringJunctions(whereClause, params),
      getRoadEngineeringSignages(whereClause, params),
      getRoadEngineeringCulverts(whereClause, params),
      getRoadEngineeringMedian(whereClause, params),
    ]);

    const roadConditionCounts: { [key: string]: number } = {};

    // Aggregate all road engineering factors
    [roadEngineeringNatureRows, roadEngineeringJunctionsRows, roadEngineeringSigRows,
     roadEngineeringCulvertsRows, roadEngineeringMedianRows].forEach((rows) => {
      rows.forEach((row) => {
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
    const districtRows = await getDistrictComparison(whereClause, params);

    const districtComparison = districtRows.map(row => ({
      district: row.district,
      accidents: parseInt(row.accidents || 0),
      deaths: parseInt(row.deaths || 0),
      injuries: parseInt(row.injuries || 0),
      deathRate: parseFloat(row.death_rate || 0),
    }));

    // Road Type Analysis
    const roadTypeRows = await getRoadTypeAnalysis(whereClause, params);

    const roadTypeAnalysis = roadTypeRows.map(row => ({
      roadType: row.road_type,
      accidents: parseInt(row.accidents || 0),
      deaths: parseInt(row.deaths || 0),
    }));

    // Hotspots - locations with multiple incidents
    const hotspotsRows = await getHotspots(whereClause, params);

    const hotspotsLocations = hotspotsRows.map(row => ({
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
    if (!(await requireStateViewer(req, res))) return;

    const { district, year, format } = req.query;
    const { whereClause, params } = buildWhereClause(district as string, year as string);

    const exportRows = await getExportRows(whereClause, params);

    if (format === "csv") {
      const headers = [
        "ID", "District", "Location", "Mandal", "Police Station",
        "FIR Number", "Accident Date", "Deaths", "Injuries", "Road Type"
      ];

      const rows = exportRows.map(row => [
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
        headers.map(escapeCsvCell).join(","),
        ...rows.map((r) => r.map(escapeCsvCell).join(",")),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="analytics-${year}.csv"`);
      res.send(csv);
    } else {
      res.json(exportRows);
    }
  } catch (err: any) {
    console.error("Analytics export error:", err);
    res.status(500).json({ error: "Failed to export analytics" });
  }
});

export default router;
