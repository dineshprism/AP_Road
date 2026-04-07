import { Router, Response } from "express";
import ExcelJS from "exceljs";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";

const router = Router();

router.use(authMiddleware);

interface ReportSubmission {
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

type VehicleCategory =
  | "twoWheeler"
  | "threeWheeler"
  | "carCab"
  | "bus"
  | "lorry"
  | "other";

type RoadBucket =
  | "NH"
  | "SH"
  | "Corporation / City Road"
  | "Muncipal Road"
  | "Village Roads";

interface TimeBucket {
  label: string;
  startHour: number;
  endHour: number;
}

const TIME_BUCKETS: TimeBucket[] = [
  { label: "00.00 to 03.00(hrs)(Night)", startHour: 0, endHour: 3 },
  { label: "03.00 to 06.00(hrs)(Night)", startHour: 3, endHour: 6 },
  { label: "06.00 to 09.00(hrs)(Day)", startHour: 6, endHour: 9 },
  { label: "09.00 to 12.00(hrs)(Day)", startHour: 9, endHour: 12 },
  { label: "12.00 to 15.00(hrs)(Day)", startHour: 12, endHour: 15 },
  { label: "15.00 to 18.00(hrs)(Day)", startHour: 15, endHour: 18 },
  { label: "18.00 to 21.00(hrs)(Night)", startHour: 18, endHour: 21 },
  { label: "21.00 to 24.00(hrs)(Night)", startHour: 21, endHour: 24 },
];

const VEHICLE_HEADERS: Array<{ label: string; category: VehicleCategory }> = [
  { label: "Two Wheeler", category: "twoWheeler" },
  { label: "Three Wheeler", category: "threeWheeler" },
  { label: "Car/Cab/Maxi cab", category: "carCab" },
  { label: "BUS", category: "bus" },
  { label: "LORRY", category: "lorry" },
  { label: "Other vehicles", category: "other" },
];

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function parseDateValue(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatDateLabel(value: string) {
  const date = parseDateValue(value);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}-${mm}-${yyyy}`;
}

function safeString(value: unknown) {
  return String(value || "").trim();
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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

function toRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function truthyKeys(value: unknown) {
  return Object.entries(toRecord(value))
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => titleCase(key));
}

function summarizeCounts(values: string[], limit = 4) {
  if (values.length === 0) return "N/A";
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => `${label} (${count})`)
    .join("\n");
}

function summarizeUnique(values: Array<string | null | undefined>, limit = 4) {
  const unique = [...new Set(values.map((value) => safeString(value)).filter(Boolean))];
  if (unique.length === 0) return "N/A";
  if (unique.length <= limit) return unique.join("\n");
  return `${unique.slice(0, limit).join("\n")}\n+${unique.length - limit} more`;
}

function parseHour(timeText: string | null) {
  if (!timeText) return null;
  const match = String(timeText).match(/^(\d{1,2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

function getTimeBucketLabel(timeText: string | null) {
  const hour = parseHour(timeText);
  if (hour == null) return "Time Not Captured";
  return TIME_BUCKETS.find((bucket) => hour >= bucket.startHour && hour < bucket.endHour)?.label || "Time Not Captured";
}

function getVehicleCategory(classType: string): VehicleCategory {
  const normalized = classType.toLowerCase();
  if (
    normalized.includes("motorcycle") ||
    normalized.includes("two wheeler") ||
    normalized.includes("2 wheeler") ||
    normalized.includes("scooter") ||
    normalized.includes("bike")
  ) {
    return "twoWheeler";
  }
  if (normalized.includes("three wheeler") || normalized.includes("3 wheeler") || normalized.includes("auto")) {
    return "threeWheeler";
  }
  if (
    normalized.includes("car") ||
    normalized.includes("cab") ||
    normalized.includes("maxi") ||
    normalized.includes("jeep") ||
    normalized.includes("van")
  ) {
    return "carCab";
  }
  if (normalized.includes("bus")) {
    return "bus";
  }
  if (
    normalized.includes("lorry") ||
    normalized.includes("truck") ||
    normalized.includes("goods") ||
    normalized.includes("carrier")
  ) {
    return "lorry";
  }
  return "other";
}

function getRoadBucket(roadType: string): RoadBucket {
  const normalized = roadType.toUpperCase();
  if (normalized.includes("NH")) return "NH";
  if (normalized.includes("SH")) return "SH";
  if (normalized.includes("CITY") || normalized.includes("CORPORATION")) return "Corporation / City Road";
  if (normalized.includes("MUNICIPAL") || normalized.includes("MDR")) return "Muncipal Road";
  return "Village Roads";
}

function getReasonTokens(row: ReportSubmission) {
  return [
    ...truthyKeys(row.driver_related_causes),
    ...truthyKeys(row.vehicle_condition_causes),
    ...truthyKeys(row.road_engineering_nature),
    ...truthyKeys(row.road_engineering_junctions),
    ...truthyKeys(row.road_engineering_signages),
    ...truthyKeys(row.road_engineering_median),
    ...truthyKeys(row.road_engineering_culverts),
  ];
}

function getVictimBreakdown(row: ReportSubmission) {
  const victimDetails = toArray(row.victim_details);
  let grievous = 0;
  let minor = 0;

  for (const victim of victimDetails) {
    if (!victim || typeof victim !== "object") continue;
    if (safeString((victim as Record<string, unknown>).status).toLowerCase() !== "injured") continue;

    const injuryType = safeString((victim as Record<string, unknown>).injury_type).toLowerCase();
    if (injuryType === "grievous") {
      grievous += 1;
    } else {
      minor += 1;
    }
  }

  const accounted = grievous + minor;
  const remaining = Math.max(0, Number(row.persons_injured || 0) - accounted);
  minor += remaining;

  return { grievous, minor };
}

function locationKey(row: ReportSubmission) {
  return `${safeString(row.district).toLowerCase()}|${safeString(row.place_of_accident).toLowerCase()}`;
}

function getVehicleStats(rows: ReportSubmission[], casualtyField: "persons_died" | "persons_injured") {
  const stats: Record<VehicleCategory, { accidents: number; casualties: number }> = {
    twoWheeler: { accidents: 0, casualties: 0 },
    threeWheeler: { accidents: 0, casualties: 0 },
    carCab: { accidents: 0, casualties: 0 },
    bus: { accidents: 0, casualties: 0 },
    lorry: { accidents: 0, casualties: 0 },
    other: { accidents: 0, casualties: 0 },
  };

  for (const row of rows) {
    const vehicles = toArray(row.vehicles);
    const categories = new Set<VehicleCategory>();
    for (const vehicle of vehicles) {
      if (!vehicle || typeof vehicle !== "object") continue;
      const classType = safeString((vehicle as Record<string, unknown>).class_type);
      if (!classType) continue;
      categories.add(getVehicleCategory(classType));
    }

    for (const category of categories) {
      stats[category].accidents += 1;
      stats[category].casualties += Number(row[casualtyField] || 0);
    }
  }

  return stats;
}

function setTitleRow(worksheet: ExcelJS.Worksheet, title: string, columnCount: number) {
  worksheet.mergeCells(1, 1, 1, columnCount);
  const cell = worksheet.getCell(1, 1);
  cell.value = title;
  cell.font = { bold: true, size: 14 };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getRow(1).height = 24;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "163A70" },
  };
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "B8C2D3" } },
      left: { style: "thin", color: { argb: "B8C2D3" } },
      bottom: { style: "thin", color: { argb: "B8C2D3" } },
      right: { style: "thin", color: { argb: "B8C2D3" } },
    };
  });
}

function styleBodyRows(worksheet: ExcelJS.Worksheet, startRow: number) {
  for (let index = startRow; index <= worksheet.rowCount; index += 1) {
    const row = worksheet.getRow(index);
    row.alignment = { vertical: "top", wrapText: true };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "E5E7EB" } },
        left: { style: "thin", color: { argb: "E5E7EB" } },
        bottom: { style: "thin", color: { argb: "E5E7EB" } },
        right: { style: "thin", color: { argb: "E5E7EB" } },
      };
    });
  }
}

function applyAutoWidths(worksheet: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
}

function buildDsrSheet(workbook: ExcelJS.Workbook, rows: ReportSubmission[], fromDate: string, toDate: string) {
  const worksheet = workbook.addWorksheet("DSR");
  const headers = [
    "S.No",
    "Unit Name",
    "Fatal",
    "Non-Fatal",
    "Total",
    "Persons Died",
    "Persons Injured",
    "NH",
    "SH",
    "Corporation / City Road",
    "Muncipal Road",
    "Village Roads",
  ];

  setTitleRow(worksheet, `Daily DSR of Road Accidents (RoadSafety Wing) date: ${formatDateLabel(fromDate)} to ${formatDateLabel(toDate)}`, headers.length);
  worksheet.addRow([]);
  worksheet.addRow(headers);
  styleHeaderRow(worksheet.getRow(3));
  worksheet.views = [{ state: "frozen", ySplit: 3 }];
  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: headers.length },
  };

  const grouped = new Map<string, ReportSubmission[]>();
  for (const row of rows) {
    const key = safeString(row.district) || "Unknown";
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }

  let serial = 1;
  const totals = {
    fatal: 0,
    nonFatal: 0,
    total: rows.length,
    deaths: 0,
    injuries: 0,
    NH: 0,
    SH: 0,
    corp: 0,
    municipal: 0,
    village: 0,
  };

  for (const [district, districtRows] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const fatal = districtRows.filter((row) => Number(row.persons_died || 0) > 0).length;
    const nonFatal = districtRows.length - fatal;
    const deaths = districtRows.reduce((sum, row) => sum + Number(row.persons_died || 0), 0);
    const injuries = districtRows.reduce((sum, row) => sum + Number(row.persons_injured || 0), 0);

    const roadCounts: Record<RoadBucket, number> = {
      NH: 0,
      SH: 0,
      "Corporation / City Road": 0,
      "Muncipal Road": 0,
      "Village Roads": 0,
    };
    for (const row of districtRows) {
      roadCounts[getRoadBucket(safeString(row.road_type))] += 1;
    }

    worksheet.addRow([
      serial,
      district,
      fatal,
      nonFatal,
      districtRows.length,
      deaths,
      injuries,
      roadCounts.NH,
      roadCounts.SH,
      roadCounts["Corporation / City Road"],
      roadCounts["Muncipal Road"],
      roadCounts["Village Roads"],
    ]);
    serial += 1;

    totals.fatal += fatal;
    totals.nonFatal += nonFatal;
    totals.deaths += deaths;
    totals.injuries += injuries;
    totals.NH += roadCounts.NH;
    totals.SH += roadCounts.SH;
    totals.corp += roadCounts["Corporation / City Road"];
    totals.municipal += roadCounts["Muncipal Road"];
    totals.village += roadCounts["Village Roads"];
  }

  const totalRow = worksheet.addRow([
    "",
    "TOTAL",
    totals.fatal,
    totals.nonFatal,
    totals.total,
    totals.deaths,
    totals.injuries,
    totals.NH,
    totals.SH,
    totals.corp,
    totals.municipal,
    totals.village,
  ]);
  totalRow.font = { bold: true };

  applyAutoWidths(worksheet, [8, 20, 10, 12, 10, 14, 16, 8, 8, 20, 18, 16]);
  styleBodyRows(worksheet, 4);
}

function buildSeveritySheet(
  workbook: ExcelJS.Workbook,
  sheetName: "Fatal" | "Non Fatal",
  rows: ReportSubmission[],
  fromDate: string,
  toDate: string,
  locationCounts: Map<string, number>
) {
  const isFatal = sheetName === "Fatal";
  const filtered = rows.filter((row) =>
    isFatal ? Number(row.persons_died || 0) > 0 : Number(row.persons_died || 0) === 0
  );

  const worksheet = workbook.addWorksheet(sheetName);
  const headers = [
    "S.No",
    "Unit Name",
    sheetName,
    isFatal ? "Reason for Accident (Summary)" : "Reason for Accident (Summary)",
    "Police Station Name",
    "NH",
    "SH",
    "Corporation / City Road",
    "Muncipal Road",
    "Village Roads",
    "Black Spot Yes/No",
    "Time of Accident",
    "Two Wheeler Accidents",
    isFatal ? "Two Wheeler Deaths" : "Two Wheeler Injured",
    "Wearing helmet or Not",
    "Three Wheeler Accidents",
    isFatal ? "Three Wheeler Deaths" : "Three Wheeler Injured",
    "Car/Cab/Maxi cab Accidents",
    isFatal ? "Car/Cab/Maxi cab Deaths" : "Car/Cab/Maxi cab Injured",
    "BUS Accidents",
    isFatal ? "BUS Deaths" : "BUS Injured",
    "LORRY Accidents",
    isFatal ? "LORRY Deaths" : "LORRY Injured",
    "Other vehicles Accidents",
    isFatal ? "Other vehicles Deaths" : "Other vehicles Injured",
  ];

  setTitleRow(
    worksheet,
    `${isFatal ? "Proforma-I (Fatal Accidents)" : "Proforma-II (Non-Fatal Accidents)"} ${formatDateLabel(fromDate)} to ${formatDateLabel(toDate)}`,
    headers.length
  );
  worksheet.addRow([]);
  worksheet.addRow(headers);
  styleHeaderRow(worksheet.getRow(3));
  worksheet.views = [{ state: "frozen", ySplit: 3 }];
  worksheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: headers.length },
  };

  const grouped = new Map<string, ReportSubmission[]>();
  for (const row of filtered) {
    const key = safeString(row.district) || "Unknown";
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }

  let serial = 1;
  const totals: Record<string, number> = {
    accidents: 0,
    NH: 0,
    SH: 0,
    corp: 0,
    municipal: 0,
    village: 0,
  };
  const vehicleTotals: Record<VehicleCategory, { accidents: number; casualties: number }> = {
    twoWheeler: { accidents: 0, casualties: 0 },
    threeWheeler: { accidents: 0, casualties: 0 },
    carCab: { accidents: 0, casualties: 0 },
    bus: { accidents: 0, casualties: 0 },
    lorry: { accidents: 0, casualties: 0 },
    other: { accidents: 0, casualties: 0 },
  };

  for (const [district, districtRows] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const roadCounts: Record<RoadBucket, number> = {
      NH: 0,
      SH: 0,
      "Corporation / City Road": 0,
      "Muncipal Road": 0,
      "Village Roads": 0,
    };
    for (const row of districtRows) {
      roadCounts[getRoadBucket(safeString(row.road_type))] += 1;
    }

    const vehicleStats = getVehicleStats(
      districtRows,
      isFatal ? "persons_died" : "persons_injured"
    );

    for (const header of VEHICLE_HEADERS) {
      vehicleTotals[header.category].accidents += vehicleStats[header.category].accidents;
      vehicleTotals[header.category].casualties += vehicleStats[header.category].casualties;
    }

    const reasonSummary = summarizeCounts(districtRows.flatMap(getReasonTokens));
    const anyTwoWheeler = vehicleStats.twoWheeler.accidents > 0;
    const blackSpot = districtRows.some((row) => (locationCounts.get(locationKey(row)) || 0) >= 2) ? "Yes" : "No";

    worksheet.addRow([
      serial,
      district,
      districtRows.length,
      reasonSummary,
      summarizeUnique(districtRows.map((row) => row.police_station), 5),
      roadCounts.NH,
      roadCounts.SH,
      roadCounts["Corporation / City Road"],
      roadCounts["Muncipal Road"],
      roadCounts["Village Roads"],
      blackSpot,
      summarizeUnique(districtRows.map((row) => row.accident_time), 5),
      vehicleStats.twoWheeler.accidents,
      vehicleStats.twoWheeler.casualties,
      anyTwoWheeler ? "Not Captured" : "",
      vehicleStats.threeWheeler.accidents,
      vehicleStats.threeWheeler.casualties,
      vehicleStats.carCab.accidents,
      vehicleStats.carCab.casualties,
      vehicleStats.bus.accidents,
      vehicleStats.bus.casualties,
      vehicleStats.lorry.accidents,
      vehicleStats.lorry.casualties,
      vehicleStats.other.accidents,
      vehicleStats.other.casualties,
    ]);
    serial += 1;

    totals.accidents += districtRows.length;
    totals.NH += roadCounts.NH;
    totals.SH += roadCounts.SH;
    totals.corp += roadCounts["Corporation / City Road"];
    totals.municipal += roadCounts["Muncipal Road"];
    totals.village += roadCounts["Village Roads"];
  }

  const totalValues: Array<string | number> = [
    "",
    "TOTAL",
    totals.accidents,
    "",
    "",
    totals.NH,
    totals.SH,
    totals.corp,
    totals.municipal,
    totals.village,
    "",
    "",
  ];
  for (const header of VEHICLE_HEADERS) {
    totalValues.push(
      vehicleTotals[header.category].accidents,
      vehicleTotals[header.category].casualties
    );
    if (header.category === "twoWheeler") {
      totalValues.push(vehicleTotals.twoWheeler.accidents > 0 ? "Not Captured" : "");
    }
  }

  const totalRow = worksheet.addRow(totalValues);
  totalRow.font = { bold: true };

  applyAutoWidths(worksheet, [8, 18, 10, 26, 22, 8, 8, 16, 16, 16, 14, 18, 12, 12, 16, 12, 12, 14, 12, 10, 10, 10, 10, 14, 12]);
  styleBodyRows(worksheet, 4);
}

function buildTimeWiseSheet(
  workbook: ExcelJS.Workbook,
  rows: ReportSubmission[],
  fromDate: string,
  toDate: string,
  locationCounts: Map<string, number>
) {
  const worksheet = workbook.addWorksheet("Time Wise");
  const headers = [
    "S.No",
    "Time HOURS",
    "Fatal",
    "Non Fatal",
    "Total",
    "Killed",
    "Grievous injury",
    "Minor injury",
    "Top Black Spot Unit",
    "Fatal (Black Spot)",
    "Non Fatal (Black Spot)",
    "Deaths (Black Spot)",
  ];

  setTitleRow(worksheet, `Time Wise Road Accident Report ${formatDateLabel(fromDate)} to ${formatDateLabel(toDate)}`, headers.length);
  worksheet.addRow([]);
  worksheet.addRow(headers);
  styleHeaderRow(worksheet.getRow(3));
  worksheet.views = [{ state: "frozen", ySplit: 3 }];

  const timeRows = TIME_BUCKETS.map((bucket) => {
    const bucketRows = rows.filter((row) => getTimeBucketLabel(row.accident_time) === bucket.label);
    const fatal = bucketRows.filter((row) => Number(row.persons_died || 0) > 0).length;
    const nonFatal = bucketRows.length - fatal;
    const killed = bucketRows.reduce((sum, row) => sum + Number(row.persons_died || 0), 0);
    const injuryTotals = bucketRows.reduce(
      (totals, row) => {
        const breakdown = getVictimBreakdown(row);
        totals.grievous += breakdown.grievous;
        totals.minor += breakdown.minor;
        return totals;
      },
      { grievous: 0, minor: 0 }
    );

    return {
      label: bucket.label,
      fatal,
      nonFatal,
      total: bucketRows.length,
      killed,
      grievous: injuryTotals.grievous,
      minor: injuryTotals.minor,
    };
  });

  const blackSpotUnits = [...new Map<string, { district: string; fatal: number; nonFatal: number; deaths: number }>()];
  const blackSpotMap = new Map<string, { district: string; fatal: number; nonFatal: number; deaths: number }>();
  for (const row of rows) {
    if ((locationCounts.get(locationKey(row)) || 0) < 2) continue;
    const district = safeString(row.district) || "Unknown";
    const current = blackSpotMap.get(district) || { district, fatal: 0, nonFatal: 0, deaths: 0 };
    if (Number(row.persons_died || 0) > 0) current.fatal += 1;
    else current.nonFatal += 1;
    current.deaths += Number(row.persons_died || 0);
    blackSpotMap.set(district, current);
  }

  const rankedBlackSpots = [...blackSpotMap.values()]
    .sort((a, b) => b.deaths - a.deaths || (b.fatal + b.nonFatal) - (a.fatal + a.nonFatal) || a.district.localeCompare(b.district))
    .slice(0, TIME_BUCKETS.length);

  let serial = 1;
  for (let index = 0; index < TIME_BUCKETS.length; index += 1) {
    const timeRow = timeRows[index];
    const blackSpot = rankedBlackSpots[index];
    worksheet.addRow([
      serial,
      timeRow.label,
      timeRow.fatal,
      timeRow.nonFatal,
      timeRow.total,
      timeRow.killed,
      timeRow.grievous,
      timeRow.minor,
      blackSpot?.district || "",
      blackSpot?.fatal || "",
      blackSpot?.nonFatal || "",
      blackSpot?.deaths || "",
    ]);
    serial += 1;
  }

  const totalRow = worksheet.addRow([
    "",
    "TOTAL",
    timeRows.reduce((sum, row) => sum + row.fatal, 0),
    timeRows.reduce((sum, row) => sum + row.nonFatal, 0),
    timeRows.reduce((sum, row) => sum + row.total, 0),
    timeRows.reduce((sum, row) => sum + row.killed, 0),
    timeRows.reduce((sum, row) => sum + row.grievous, 0),
    timeRows.reduce((sum, row) => sum + row.minor, 0),
    "",
    "",
    "",
    "",
  ]);
  totalRow.font = { bold: true };

  applyAutoWidths(worksheet, [8, 28, 10, 12, 10, 10, 14, 12, 18, 14, 16, 14]);
  styleBodyRows(worksheet, 4);
}

async function requireReportAccess(req: AuthRequest, res: Response) {
  const roleResult = await pool.query(
    "SELECT 1 FROM user_roles WHERE user_id = $1 AND role IN ('admin', 'dgp', 'adgp', 'prism') LIMIT 1",
    [req.user!.userId]
  );
  if (roleResult.rows.length === 0) {
    res.status(403).json({ error: "Report access required" });
    return false;
  }
  return true;
}

router.get("/dsr-workbook", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireReportAccess(req, res))) return;

    const fromDate = safeString(req.query.fromDate);
    const toDate = safeString(req.query.toDate);

    if (!isIsoDate(fromDate) || !isIsoDate(toDate)) {
      res.status(400).json({ error: "Valid fromDate and toDate are required in YYYY-MM-DD format" });
      return;
    }

    if (fromDate > toDate) {
      res.status(400).json({ error: "fromDate cannot be later than toDate" });
      return;
    }

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
       WHERE accident_date >= $1 AND accident_date <= $2
       ORDER BY district, accident_date, fir_number`,
      [fromDate, toDate]
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Road Accident Data Hub";
    workbook.lastModifiedBy = "Road Accident Data Hub";
    workbook.created = new Date();
    workbook.modified = new Date();

    const rows = result.rows;
    const locationCounts = new Map<string, number>();
    for (const row of rows) {
      const key = locationKey(row);
      locationCounts.set(key, (locationCounts.get(key) || 0) + 1);
    }

    buildDsrSheet(workbook, rows, fromDate, toDate);
    buildSeveritySheet(workbook, "Fatal", rows, fromDate, toDate, locationCounts);
    buildSeveritySheet(workbook, "Non Fatal", rows, fromDate, toDate, locationCounts);
    buildTimeWiseSheet(workbook, rows, fromDate, toDate, locationCounts);

    const fileBuffer = await workbook.xlsx.writeBuffer();
    const fileName = `DSR_${formatDateLabel(fromDate)}_to_${formatDateLabel(toDate)}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer));
  } catch (err: any) {
    console.error("DSR workbook export error:", err);
    res.status(500).json({ error: "Failed to generate DSR workbook" });
  }
});

export default router;
