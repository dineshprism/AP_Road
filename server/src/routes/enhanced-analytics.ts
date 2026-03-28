import { Router, Response } from "express";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router = Router();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
});

router.use(authMiddleware);

type JsonRecord = Record<string, unknown>;

interface AnalyticsRow {
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
}

interface RoadTypeAggregate {
  roadType: string;
  accidents: number;
  deaths: number;
  injuries: number;
}

interface ScopeResult {
  whereClause: string;
  params: Array<string>;
  effectiveDistrict: string | null;
  yearNum: number;
  comparisonLabel: string;
  viewLevel: "state" | "district";
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toRecord(value: unknown): JsonRecord {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonRecord : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function truthyKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return [trimmed];
    }
  }
  return Object.entries(toRecord(value))
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);
}

function parseHour(timeText: string | null): number | null {
  if (!timeText) return null;
  const match = String(timeText).match(/^(\d{1,2})/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  return Number.isNaN(hour) || hour < 0 || hour > 23 ? null : hour;
}

function safePercentage(numerator: number, denominator: number): number {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function increment<T extends string | number>(map: Map<T, number>, key: T, value = 1) {
  map.set(key, (map.get(key) || 0) + value);
}

async function getAccessContext(req: AuthRequest, res: Response) {
  const userId = req.user!.userId;
  const [rolesResult, profileResult] = await Promise.all([
    pool.query("SELECT role FROM user_roles WHERE user_id = $1", [userId]),
    pool.query("SELECT district FROM profiles WHERE user_id = $1", [userId]),
  ]);

  const roles = rolesResult.rows.map((row) => row.role as string);
  const isAdmin = roles.some((role) => ["admin", "dgp", "adgp"].includes(role));
  const profileDistrict = profileResult.rows[0]?.district as string | undefined;

  if (!isAdmin && !profileDistrict) {
    res.status(403).json({ error: "Analytics access requires a district profile" });
    return null;
  }

  return {
    isAdmin,
    profileDistrict: profileDistrict || null,
  };
}

function buildScopedWhere(
  year?: string,
  district?: string,
  fromDate?: string,
  toDate?: string,
  access?: { isAdmin: boolean; profileDistrict: string | null }
): ScopeResult {
  const yearNum = parseInt(year || "", 10) || new Date().getFullYear();
  const params: Array<string> = [];
  let whereClause = "1=1";
  let effectiveDistrict: string | null = null;
  const isValidDate = (value?: string) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));

  if (isValidDate(fromDate)) {
    params.push(fromDate!);
    whereClause += ` AND accident_date >= $${params.length}`;
  }

  if (isValidDate(toDate)) {
    params.push(toDate!);
    whereClause += ` AND accident_date <= $${params.length}`;
  }

  if (!isValidDate(fromDate) && !isValidDate(toDate)) {
    params.push(`${yearNum}-01-01`, `${yearNum + 1}-01-01`);
    whereClause += ` AND accident_date >= $${params.length - 1} AND accident_date < $${params.length}`;
  }

  if (access?.isAdmin) {
    if (district && district !== "all") {
      params.push(district);
      whereClause += ` AND district = $${params.length}`;
      effectiveDistrict = district;
    }
  } else if (access?.profileDistrict) {
    params.push(access.profileDistrict);
    whereClause += ` AND district = $${params.length}`;
    effectiveDistrict = access.profileDistrict;
  }

  return {
    whereClause,
    params,
    effectiveDistrict,
    yearNum,
    comparisonLabel: access?.isAdmin && !effectiveDistrict ? "District" : "Police Station",
    viewLevel: access?.isAdmin && !effectiveDistrict ? "state" : "district",
  };
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function generateGeminiInsights(summaryInput: {
  scopeLabel: string;
  totalAccidents: number;
  totalDeaths: number;
  totalInjuries: number;
  peakHour: string;
  dangerousRoadType: string;
  topCauses: Array<{ label: string; count: number }>;
  topLocations: Array<{ label: string; count: number; deaths: number }>;
  topComparisons: Array<{ label: string; count: number; fatalityRate: number }>;
}) {
  if (!process.env.GEMINI_API_KEY || summaryInput.totalAccidents === 0) {
    return {
      overallAssessment: "No AI summary was generated for the current selection.",
      keyFindings: ["Insufficient filtered accident volume or AI key unavailable."],
      recommendations: ["Review the visual analytics below for operational planning."],
      predictiveAnalysis: "Prediction unavailable for the current filter selection.",
      riskFactors: ["No AI risk factors available."],
    };
  }

  try {
    const prompt = `You are preparing an official road safety analytical brief for ${summaryInput.scopeLabel}.

Accidents: ${summaryInput.totalAccidents}
Deaths: ${summaryInput.totalDeaths}
Injuries: ${summaryInput.totalInjuries}
Peak hour: ${summaryInput.peakHour}
Most dangerous road type: ${summaryInput.dangerousRoadType}

Top causes:
${summaryInput.topCauses.map((item, index) => `${index + 1}. ${item.label} (${item.count})`).join("\n")}

Top locations:
${summaryInput.topLocations.map((item, index) => `${index + 1}. ${item.label} (${item.count} accidents, ${item.deaths} deaths)`).join("\n")}

Top comparison units:
${summaryInput.topComparisons.map((item, index) => `${index + 1}. ${item.label} (${item.count} accidents, ${item.fatalityRate.toFixed(1)}% fatality rate)`).join("\n")}

Return JSON only with keys:
overallAssessment,
keyFindings (array of 4 short bullets),
recommendations (array of 4 short bullets),
predictiveAnalysis,
riskFactors (array of 4 short bullets).`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("Gemini analytics summary failed:", error);
  }

  return {
    overallAssessment: "Accident concentration is being driven by recurring behavioural and infrastructure factors.",
    keyFindings: [
      "Recurring hotspots require corridor-level intervention.",
      "High-frequency causes are concentrated in a small number of patterns.",
      "Casualty burden varies sharply across locations.",
      "Peak-hour enforcement opportunities are visible in the time analysis.",
    ],
    recommendations: [
      "Prioritize hotspot engineering corrections.",
      "Increase focused enforcement during peak hours.",
      "Monitor police-station level trends monthly.",
      "Target the top repeat causes with corrective campaigns.",
    ],
    predictiveAnalysis: "Without corrective action in the top hotspots and peak hours, the present accident pattern is likely to persist.",
    riskFactors: [
      "Driver behaviour",
      "Road environment defects",
      "High-risk corridor locations",
      "Uneven local enforcement pressure",
    ],
  };
}

router.get("/enhanced", async (req: AuthRequest, res: Response) => {
  try {
    const access = await getAccessContext(req, res);
    if (!access) return;

    const { district, year, fromDate, toDate } = req.query;
    const scope = buildScopedWhere(
      year as string,
      district as string,
      fromDate as string,
      toDate as string,
      access
    );
    const result = await pool.query<AnalyticsRow>(
      `SELECT
        id, district, place_of_accident, mandal, police_station, fir_number,
        road_type, accident_date, accident_time, lat_long, persons_died, persons_injured,
        vehicles, drivers, driver_related_causes, vehicle_condition_causes,
        road_engineering_culverts, road_engineering_junctions, road_engineering_median,
        road_engineering_nature, road_engineering_signages, signed_copy_uploaded
       FROM accident_submissions
       WHERE ${scope.whereClause}
       ORDER BY accident_date DESC`,
      scope.params
    );

    const rows = result.rows;

    if (rows.length === 0) {
      res.json({
        scope: {
          viewLevel: scope.viewLevel,
          district: scope.effectiveDistrict,
          comparisonLabel: scope.comparisonLabel,
          scopeLabel: scope.effectiveDistrict || "Andhra Pradesh",
          year: scope.yearNum,
        },
        summary: {
          totalAccidents: 0,
          totalDeaths: 0,
          totalInjuries: 0,
          averageDeathsPerAccident: 0,
          averageFatalityRate: 0,
          totalVehicles: 0,
          totalDrivers: 0,
          averageVehiclesPerAccident: 0,
          peakAccidentHour: "N/A",
          peakAccidentMonth: "N/A",
          mostDangerousRoadType: "N/A",
          signedCopyUploaded: 0,
          signedCopyPending: 0,
        },
        trendData: [],
        timeAnalysis: [],
        causeAnalysis: [],
        comparisonData: [],
        mandalAnalysis: [],
        roadTypeAnalysis: [],
        roadTypeInsights: {
          highestVolume: null,
          highestDeaths: null,
          highestFatalityRate: null,
          highestSeverityIndex: null,
        },
        hotspotsLocations: [],
        driverCauses: [],
        vehicleCauses: [],
        roadEngineeringCauses: [],
        vehicleAnalysis: [],
        signedCopyAnalysis: [],
        mapPoints: [],
        geminiInsights: {
          overallAssessment: "No accident submissions were found for the selected period.",
          keyFindings: [],
          recommendations: [],
          predictiveAnalysis: "No prediction available.",
          riskFactors: [],
        },
      });
      return;
    }

    const trendMap = new Map<string, { month: string; accidents: number; deaths: number; injuries: number }>();
    const hourMap = new Map<number, { hour: string; accidents: number; deaths: number; injuries: number }>();
    const comparisonMap = new Map<string, { name: string; accidents: number; deaths: number; injuries: number }>();
    const mandalMap = new Map<string, { name: string; accidents: number; deaths: number; injuries: number }>();
    const roadTypeMap = new Map<string, RoadTypeAggregate>();
    const hotspotMap = new Map<string, { place: string; district: string; accidents: number; deaths: number; injured: number }>();
    const policeStationMap = new Map<string, { name: string; accidents: number; deaths: number; injuries: number }>();
    const dayMap = new Map<string, { day: string; accidents: number; deaths: number; injuries: number }>();
    const severityMap = new Map<string, number>([
      ["Fatal", 0],
      ["Injury", 0],
      ["Damage Only", 0],
    ]);
    const fieldCompletenessMap = new Map<string, number>([
      ["GPS Coordinates", 0],
      ["Signed Copy Uploaded", 0],
      ["Vehicle Details", 0],
      ["Driver Details", 0],
      ["Driver Cause Details", 0],
      ["Vehicle Condition Details", 0],
      ["Road Engineering Details", 0],
    ]);
    const driverCauseMap = new Map<string, number>();
    const vehicleCauseMap = new Map<string, number>();
    const roadEngineeringMaps = [
      { category: "Culverts and Curves", key: "road_engineering_culverts" as const, counts: new Map<string, number>() },
      { category: "Junctions", key: "road_engineering_junctions" as const, counts: new Map<string, number>() },
      { category: "Median", key: "road_engineering_median" as const, counts: new Map<string, number>() },
      { category: "Nature of Area", key: "road_engineering_nature" as const, counts: new Map<string, number>() },
      { category: "Signages and Road Markings", key: "road_engineering_signages" as const, counts: new Map<string, number>() },
    ];
    const vehicleTypeMap = new Map<string, { type: string; count: number; deaths: number; injuries: number }>();

    let totalDeaths = 0;
    let totalInjuries = 0;
    let totalVehicles = 0;
    let totalDrivers = 0;
    let signedCopyUploaded = 0;
    const monthlyCounts = new Map<string, number>();

    rows.forEach((row) => {
      totalDeaths += Number(row.persons_died || 0);
      totalInjuries += Number(row.persons_injured || 0);
      if (row.signed_copy_uploaded) signedCopyUploaded += 1;

      const vehicles = toArray(row.vehicles);
      const drivers = toArray(row.drivers);
      totalVehicles += vehicles.length;
      totalDrivers += drivers.length;

      const date = new Date(row.accident_date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!trendMap.has(monthKey)) {
        trendMap.set(monthKey, {
          month: MONTH_LABELS[date.getMonth()],
          accidents: 0,
          deaths: 0,
          injuries: 0,
        });
      }
      const monthItem = trendMap.get(monthKey)!;
      monthItem.accidents += 1;
      monthItem.deaths += Number(row.persons_died || 0);
      monthItem.injuries += Number(row.persons_injured || 0);
      increment(monthlyCounts, MONTH_LABELS[date.getMonth()]);

      const hour = parseHour(row.accident_time);
      if (hour !== null) {
        if (!hourMap.has(hour)) {
          hourMap.set(hour, { hour: `${String(hour).padStart(2, "0")}:00`, accidents: 0, deaths: 0, injuries: 0 });
        }
        const hourItem = hourMap.get(hour)!;
        hourItem.accidents += 1;
        hourItem.deaths += Number(row.persons_died || 0);
        hourItem.injuries += Number(row.persons_injured || 0);
      }

      const comparisonName = scope.viewLevel === "state" ? row.district : row.police_station;
      if (!comparisonMap.has(comparisonName)) {
        comparisonMap.set(comparisonName, { name: comparisonName, accidents: 0, deaths: 0, injuries: 0 });
      }
      const comparisonItem = comparisonMap.get(comparisonName)!;
      comparisonItem.accidents += 1;
      comparisonItem.deaths += Number(row.persons_died || 0);
      comparisonItem.injuries += Number(row.persons_injured || 0);

      const stationName = row.police_station || "Unknown";
      if (!policeStationMap.has(stationName)) {
        policeStationMap.set(stationName, { name: stationName, accidents: 0, deaths: 0, injuries: 0 });
      }
      const stationItem = policeStationMap.get(stationName)!;
      stationItem.accidents += 1;
      stationItem.deaths += Number(row.persons_died || 0);
      stationItem.injuries += Number(row.persons_injured || 0);

      if (!mandalMap.has(row.mandal)) {
        mandalMap.set(row.mandal, { name: row.mandal, accidents: 0, deaths: 0, injuries: 0 });
      }
      const mandalItem = mandalMap.get(row.mandal)!;
      mandalItem.accidents += 1;
      mandalItem.deaths += Number(row.persons_died || 0);
      mandalItem.injuries += Number(row.persons_injured || 0);

      if (!roadTypeMap.has(row.road_type || "Unknown")) {
        roadTypeMap.set(row.road_type || "Unknown", { roadType: row.road_type || "Unknown", accidents: 0, deaths: 0, injuries: 0 });
      }
      const roadTypeItem = roadTypeMap.get(row.road_type || "Unknown")!;
      roadTypeItem.accidents += 1;
      roadTypeItem.deaths += Number(row.persons_died || 0);
      roadTypeItem.injuries += Number(row.persons_injured || 0);

      const hotspotKey = `${row.place_of_accident}__${row.district}`;
      if (!hotspotMap.has(hotspotKey)) {
        hotspotMap.set(hotspotKey, {
          place: row.place_of_accident,
          district: row.district,
          accidents: 0,
          deaths: 0,
          injured: 0,
        });
      }
      const hotspot = hotspotMap.get(hotspotKey)!;
      hotspot.accidents += 1;
      hotspot.deaths += Number(row.persons_died || 0);
      hotspot.injured += Number(row.persons_injured || 0);

      const dayLabel = date.toLocaleDateString("en-IN", { weekday: "short" });
      if (!dayMap.has(dayLabel)) {
        dayMap.set(dayLabel, { day: dayLabel, accidents: 0, deaths: 0, injuries: 0 });
      }
      const dayItem = dayMap.get(dayLabel)!;
      dayItem.accidents += 1;
      dayItem.deaths += Number(row.persons_died || 0);
      dayItem.injuries += Number(row.persons_injured || 0);

      if (Number(row.persons_died || 0) > 0) {
        increment(severityMap, "Fatal");
      } else if (Number(row.persons_injured || 0) > 0) {
        increment(severityMap, "Injury");
      } else {
        increment(severityMap, "Damage Only");
      }

      if (row.lat_long) increment(fieldCompletenessMap, "GPS Coordinates");
      if (row.signed_copy_uploaded) increment(fieldCompletenessMap, "Signed Copy Uploaded");
      if (vehicles.length > 0) increment(fieldCompletenessMap, "Vehicle Details");
      if (drivers.length > 0) increment(fieldCompletenessMap, "Driver Details");
      if (truthyKeys(row.driver_related_causes).length > 0) increment(fieldCompletenessMap, "Driver Cause Details");
      if (truthyKeys(row.vehicle_condition_causes).length > 0) increment(fieldCompletenessMap, "Vehicle Condition Details");
      if (
        truthyKeys(row.road_engineering_culverts).length > 0 ||
        truthyKeys(row.road_engineering_junctions).length > 0 ||
        truthyKeys(row.road_engineering_median).length > 0 ||
        truthyKeys(row.road_engineering_nature).length > 0 ||
        truthyKeys(row.road_engineering_signages).length > 0
      ) {
        increment(fieldCompletenessMap, "Road Engineering Details");
      }

      truthyKeys(row.driver_related_causes).forEach((cause) => increment(driverCauseMap, cause));
      truthyKeys(row.vehicle_condition_causes).forEach((cause) => increment(vehicleCauseMap, cause));
      roadEngineeringMaps.forEach((category) => {
        truthyKeys(row[category.key]).forEach((cause) => increment(category.counts, cause));
      });

      vehicles.forEach((vehicle) => {
        const type = vehicle?.class_type || "Unknown";
        if (!vehicleTypeMap.has(type)) {
          vehicleTypeMap.set(type, { type, count: 0, deaths: 0, injuries: 0 });
        }
        const item = vehicleTypeMap.get(type)!;
        item.count += 1;
        item.deaths += Number(row.persons_died || 0);
        item.injuries += Number(row.persons_injured || 0);
      });
    });

    const totalAccidents = rows.length;
    const peakHourEntry = [...hourMap.values()].sort((a, b) => b.accidents - a.accidents)[0];
    const peakMonthEntry = [...monthlyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const mostDangerousRoadType = [...roadTypeMap.values()].sort((a, b) => b.deaths - a.deaths || b.accidents - a.accidents)[0];

    const summary = {
      totalAccidents,
      totalDeaths,
      totalInjuries,
      averageDeathsPerAccident: totalAccidents > 0 ? totalDeaths / totalAccidents : 0,
      averageFatalityRate: safePercentage(totalDeaths, totalDeaths + totalInjuries) / 100,
      totalVehicles,
      totalDrivers,
      averageVehiclesPerAccident: totalAccidents > 0 ? totalVehicles / totalAccidents : 0,
      peakAccidentHour: peakHourEntry?.hour || "N/A",
      peakAccidentMonth: peakMonthEntry?.[0] || "N/A",
      mostDangerousRoadType: mostDangerousRoadType?.roadType || "N/A",
      signedCopyUploaded,
      signedCopyPending: totalAccidents - signedCopyUploaded,
    };

    const trendData = [...trendMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, item]) => ({
        ...item,
        fatalityRate: safePercentage(item.deaths, item.deaths + item.injuries),
      }));

    const timeAnalysis = [...hourMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, item]) => item);

    const comparisonData = [...comparisonMap.values()]
      .sort((a, b) => b.accidents - a.accidents)
      .map((item) => ({
        name: item.name,
        accidents: item.accidents,
        deaths: item.deaths,
        injuries: item.injuries,
        fatalityRate: safePercentage(item.deaths, item.deaths + item.injuries),
        severity:
          item.deaths >= 10 ? "Critical" :
          item.deaths >= 5 ? "High" :
          item.deaths >= 1 ? "Medium" : "Low",
      }));

    const mandalAnalysis = [...mandalMap.values()]
      .sort((a, b) => b.accidents - a.accidents)
      .map((item) => ({
        name: item.name,
        accidents: item.accidents,
        deaths: item.deaths,
        injuries: item.injuries,
      }));

    const roadTypeAnalysis = [...roadTypeMap.values()]
      .sort((a, b) => b.accidents - a.accidents)
      .map((item) => ({
        roadType: item.roadType,
        accidents: item.accidents,
        deaths: item.deaths,
        injuries: item.injuries,
        fatalityRate: safePercentage(item.deaths, item.deaths + item.injuries),
        accidentShare: safePercentage(item.accidents, totalAccidents),
        deathShare: safePercentage(item.deaths, totalDeaths),
        injuryShare: safePercentage(item.injuries, totalInjuries),
        casualties: item.deaths + item.injuries,
        casualtiesPerAccident: item.accidents > 0 ? (item.deaths + item.injuries) / item.accidents : 0,
        severityIndex: item.accidents > 0 ? ((item.deaths * 2) + item.injuries) / item.accidents : 0,
      }));

    const roadTypeInsights = {
      highestVolume: roadTypeAnalysis[0] || null,
      highestDeaths: [...roadTypeAnalysis].sort((a, b) => b.deaths - a.deaths || b.accidents - a.accidents)[0] || null,
      highestFatalityRate: [...roadTypeAnalysis]
        .filter((item) => item.accidents > 0)
        .sort((a, b) => b.fatalityRate - a.fatalityRate || b.deaths - a.deaths || b.accidents - a.accidents)[0] || null,
      highestSeverityIndex: [...roadTypeAnalysis]
        .filter((item) => item.accidents > 0)
        .sort((a, b) => b.severityIndex - a.severityIndex || b.deaths - a.deaths || b.accidents - a.accidents)[0] || null,
    };

    const driverCauses = [...driverCauseMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([cause, count]) => ({
        cause: formatLabel(cause),
        count,
        percentage: safePercentage(count, totalAccidents),
        severity: count >= Math.max(5, totalAccidents * 0.2) ? "high" : count >= Math.max(3, totalAccidents * 0.1) ? "medium" : "low" as "high" | "medium" | "low",
      }));

    const vehicleCauses = [...vehicleCauseMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([cause, count]) => ({
        cause: formatLabel(cause),
        count,
        percentage: safePercentage(count, totalAccidents),
        severity: count >= Math.max(4, totalAccidents * 0.15) ? "high" : count >= Math.max(2, totalAccidents * 0.08) ? "medium" : "low" as "high" | "medium" | "low",
      }));

    const roadEngineeringCauses = roadEngineeringMaps.map((category) => {
      const causes = [...category.counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({
          name: formatLabel(name),
          count,
          percentage: safePercentage(count, totalAccidents),
        }));

      return {
        category: category.category,
        causes,
        totalIncidents: causes.reduce((sum, item) => sum + item.count, 0),
      };
    });

    const vehicleAnalysis = [...vehicleTypeMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const hotspotsLocations = [...hotspotMap.values()]
      .map((item) => {
        const riskScore = Math.min(100, item.accidents * 12 + item.deaths * 18 + item.injured * 5);
        return {
          ...item,
          severity: riskScore >= 80 ? "Critical" : riskScore >= 60 ? "High" : riskScore >= 35 ? "Medium" : "Low",
          riskScore,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 20);

    const causeAnalysis = [
      ...driverCauses.map((item) => ({ cause: item.cause, count: item.count, percentage: item.percentage, category: "Driver" })),
      ...vehicleCauses.map((item) => ({ cause: item.cause, count: item.count, percentage: item.percentage, category: "Vehicle" })),
      ...roadEngineeringCauses.flatMap((category) =>
        category.causes.map((cause) => ({
          cause: cause.name,
          count: cause.count,
          percentage: cause.percentage,
          category: category.category,
        }))
      ),
    ]
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const signedCopyAnalysis = [
      { name: "Uploaded", count: signedCopyUploaded },
      { name: "Pending", count: totalAccidents - signedCopyUploaded },
    ];

    const policeStationAnalysis = [...policeStationMap.values()]
      .sort((a, b) => b.accidents - a.accidents)
      .map((item) => ({
        name: item.name,
        accidents: item.accidents,
        deaths: item.deaths,
        injuries: item.injuries,
        fatalityRate: safePercentage(item.deaths, item.deaths + item.injuries),
      }));

    const dayOfWeekAnalysis = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map((day) => dayMap.get(day) || { day, accidents: 0, deaths: 0, injuries: 0 });

    const severityBreakdown = [...severityMap.entries()].map(([name, count]) => ({
      name,
      count,
      percentage: safePercentage(count, totalAccidents),
    }));

    const fieldCompleteness = [...fieldCompletenessMap.entries()].map(([field, count]) => ({
      field,
      available: count,
      missing: totalAccidents - count,
      coverage: safePercentage(count, totalAccidents),
    }));

    const mapPoints = rows.map((row) => ({
      id: row.id,
      district: row.district,
      place_of_accident: row.place_of_accident,
      lat_long: row.lat_long,
      persons_died: row.persons_died,
      persons_injured: row.persons_injured,
      accident_date: row.accident_date,
      accident_time: row.accident_time || "",
      fir_number: row.fir_number,
    }));

    const scopeLabel = scope.effectiveDistrict || "Andhra Pradesh";
    const geminiInsights = await generateGeminiInsights({
      scopeLabel,
      totalAccidents,
      totalDeaths,
      totalInjuries,
      peakHour: summary.peakAccidentHour,
      dangerousRoadType: summary.mostDangerousRoadType,
      topCauses: causeAnalysis.slice(0, 5).map((item) => ({ label: item.cause, count: item.count })),
      topLocations: hotspotsLocations.slice(0, 5).map((item) => ({ label: `${item.place}, ${item.district}`, count: item.accidents, deaths: item.deaths })),
      topComparisons: comparisonData.slice(0, 5).map((item) => ({ label: item.name, count: item.accidents, fatalityRate: item.fatalityRate })),
    });

    res.json({
      scope: {
        viewLevel: scope.viewLevel,
        district: scope.effectiveDistrict,
        comparisonLabel: scope.comparisonLabel,
        scopeLabel,
        year: scope.yearNum,
      },
      summary,
      trendData,
      timeAnalysis,
      causeAnalysis,
      comparisonData,
      mandalAnalysis,
      roadTypeAnalysis,
      roadTypeInsights,
      hotspotsLocations,
      driverCauses,
      vehicleCauses,
      roadEngineeringCauses,
      vehicleAnalysis,
      signedCopyAnalysis,
      policeStationAnalysis,
      dayOfWeekAnalysis,
      severityBreakdown,
      fieldCompleteness,
      mapPoints,
      geminiInsights,
    });
  } catch (err: any) {
    console.error("Enhanced analytics error:", err);
    res.status(500).json({ error: `Failed to generate enhanced analytics: ${err.message}` });
  }
});

export default router;
