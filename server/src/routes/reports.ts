import path from "path";
import { Router, Response } from "express";
import ExcelJS from "exceljs";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";

const router = Router();

router.use(authMiddleware);

const TEMPLATE_FILE_NAME = "DSR on 01-04-2026 to 07-04-2026.xlsx";
const REPORT_TIME_ZONE = "Asia/Kolkata";
const DSR_DATA_ROWS = { start: 6, end: 33 };
const SEVERITY_DATA_ROWS = { start: 4, end: 31 };
const TIME_DATA_ROWS = { start: 5, end: 12 };
const TIME_BLACK_SPOT_ROWS = { start: 4, end: 8 };

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

type SeveritySheetName = "Fatal" | "Non Fatal";

interface UnitAggregate {
  rows: ReportSubmission[];
  fatalCount: number;
  nonFatalCount: number;
  totalCount: number;
  deaths: number;
  injuries: number;
  roadCounts: Record<RoadBucket, number>;
  villageLocations: string[];
  reasons: string[];
  policeStations: string[];
  blackSpotStatuses: string[];
  timeValues: string[];
  vehicleStats: Record<VehicleCategory, { accidents: number; deaths: number; injuries: number; labels: string[] }>;
  helmetStatus: string[];
}

const TIME_BUCKET_LABELS = [
  "06.00 to 09.00(hrs)(Day)",
  "09.00 to 12.00(hrs)(Day)",
  "12.00 to 15.00(hrs)(Day)",
  "15.00 to 18.00(hrs)(Day)",
  "18.00 to 21.00(hrs)(Night)",
  "21.00 to 24.00(hrs)(Night)",
  "00.00 to 03.00(hrs)(Night)",
  "03.00 to 06.00(hrs)(Night)",
];

const DISTRICT_ALIASES: Record<string, string> = {
  "srikakulam": "srikakulam",
  "sklm": "srikakulam",
  "vizianagaram": "vizianagaram",
  "vzm": "vizianagaram",
  "parvathipuram manyam": "parvathipuram manyam",
  "pvp mnym": "parvathipuram manyam",
  "alluri sitharama raju": "alluri sitharama raju",
  "asr": "alluri sitharama raju",
  "visakhapatnam commissionerate": "visakhapatnam commissionerate",
  "visakhapatnam": "visakhapatnam commissionerate",
  "vskp": "visakhapatnam commissionerate",
  "anakapalli": "anakapalli",
  "akp": "anakapalli",
  "kakinada": "kakinada",
  "kkd": "kakinada",
  "dr b r ambedkar konaseema": "dr b r ambedkar konaseema",
  "dr br ambedkar konaseema": "dr b r ambedkar konaseema",
  "dr. b r ambedkar konaseema": "dr b r ambedkar konaseema",
  "knsm": "dr b r ambedkar konaseema",
  "east godavari": "east godavari",
  "eg": "east godavari",
  "polavaram": "polavaram",
  "plvm": "polavaram",
  "pvlm": "polavaram",
  "west godavari": "west godavari",
  "wg": "west godavari",
  "eluru": "eluru",
  "elr": "eluru",
  "krishna": "krishna",
  "kri": "krishna",
  "ntr commissionerate": "ntr commissionerate",
  "ntr": "ntr commissionerate",
  "guntur": "guntur",
  "gtr": "guntur",
  "bapatla": "bapatla",
  "bptl": "bapatla",
  "palnadu": "palnadu",
  "plnd": "palnadu",
  "prakasam": "prakasam",
  "pksm": "prakasam",
  "markapuram": "markapuram",
  "mkp": "markapuram",
  "sri potti sriramulu nellore": "sri potti sriramulu nellore",
  "sps nlr": "sri potti sriramulu nellore",
  "kurnool": "kurnool",
  "krnl": "kurnool",
  "nandyal": "nandyal",
  "ndyl": "nandyal",
  "ananthapuram": "ananthapuram",
  "ananthapuramu": "ananthapuram",
  "atpr": "ananthapuram",
  "sri sathya sai": "sri sathya sai",
  "sss": "sri sathya sai",
  "ysr kadapa": "ysr kadapa",
  "kadapa": "ysr kadapa",
  "kdp": "ysr kadapa",
  "annamayya": "annamayya",
  "anmy": "annamayya",
  "chittoor": "chittoor",
  "ctr": "chittoor",
  "tirupathi": "tirupathi",
  "tirupati": "tirupathi",
  "tpty": "tirupathi",
};

const DISTRICT_TEMPLATE_CODES: Record<string, string> = {
  "srikakulam": "SKLM",
  "vizianagaram": "VZM",
  "parvathipuram manyam": "PVP MNYM",
  "alluri sitharama raju": "ASR",
  "visakhapatnam commissionerate": "VSKP",
  "anakapalli": "AKP",
  "kakinada": "KKD",
  "dr b r ambedkar konaseema": "KNSM",
  "east godavari": "EG",
  "polavaram": "PLVM",
  "west godavari": "WG",
  "eluru": "ELR",
  "krishna": "KRI",
  "ntr commissionerate": "NTR",
  "guntur": "GTR",
  "bapatla": "BPTL",
  "palnadu": "PLND",
  "prakasam": "PKSM",
  "markapuram": "MKP",
  "sri potti sriramulu nellore": "SPS NLR",
  "kurnool": "KRNL",
  "nandyal": "NDYL",
  "ananthapuram": "ATPR",
  "sri sathya sai": "SSS",
  "ysr kadapa": "KDP",
  "annamayya": "ANMY",
  "chittoor": "CTR",
  "tirupathi": "TPTY",
};

const WEEKDAY_INDEX_BY_SHORT_NAME: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function safeString(value: unknown) {
  return String(value || "").trim();
}

function normalizeKey(value: string) {
  return safeString(value)
    .toLowerCase()
    .replace(/[().,/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDistrict(value: string) {
  const normalized = normalizeKey(value);
  return DISTRICT_ALIASES[normalized] || normalized;
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function formatUtcIsoDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTimeZoneDateParts(reference: Date, timeZone = REPORT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);

  const lookup = (type: Intl.DateTimeFormatPartTypes) => safeString(parts.find((part) => part.type === type)?.value);

  return {
    weekday: lookup("weekday"),
    year: Number(lookup("year")),
    month: Number(lookup("month")),
    day: Number(lookup("day")),
  };
}

function getPreviousWeekRange(reference = new Date()) {
  const { weekday, year, month, day } = getTimeZoneDateParts(reference);
  const dayOfWeek = WEEKDAY_INDEX_BY_SHORT_NAME[weekday] ?? 0;
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const current = new Date(Date.UTC(year, month - 1, day));

  const currentWeekMonday = new Date(current);
  currentWeekMonday.setUTCDate(current.getUTCDate() - daysSinceMonday);

  const lastWeekMonday = new Date(currentWeekMonday);
  lastWeekMonday.setUTCDate(currentWeekMonday.getUTCDate() - 7);

  const lastWeekSunday = new Date(lastWeekMonday);
  lastWeekSunday.setUTCDate(lastWeekMonday.getUTCDate() + 6);

  return {
    fromDate: formatUtcIsoDate(lastWeekMonday),
    toDate: formatUtcIsoDate(lastWeekSunday),
  };
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

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function truthyKeys(value: unknown) {
  return Object.entries(toRecord(value))
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => titleCase(key));
}

function uniqueOrdered(values: Array<string | null | undefined>) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = safeString(value);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function summarizeLines(values: Array<string | null | undefined>, defaultValue: string | number = 0, limit = 4) {
  const unique = uniqueOrdered(values);
  if (unique.length === 0) return defaultValue;
  return unique.slice(0, limit).join("\n");
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
  if (hour == null) return null;
  if (hour >= 6 && hour < 9) return "06.00 to 09.00(hrs)(Day)";
  if (hour >= 9 && hour < 12) return "09.00 to 12.00(hrs)(Day)";
  if (hour >= 12 && hour < 15) return "12.00 to 15.00(hrs)(Day)";
  if (hour >= 15 && hour < 18) return "15.00 to 18.00(hrs)(Day)";
  if (hour >= 18 && hour < 21) return "18.00 to 21.00(hrs)(Night)";
  if (hour >= 21 && hour < 24) return "21.00 to 24.00(hrs)(Night)";
  if (hour >= 0 && hour < 3) return "00.00 to 03.00(hrs)(Night)";
  return "03.00 to 06.00(hrs)(Night)";
}

function getTemplateUnitCode(district: string) {
  const normalized = normalizeDistrict(district);
  return DISTRICT_TEMPLATE_CODES[normalized] || safeString(district);
}

function getRoadBucket(roadType: string): RoadBucket {
  const normalized = safeString(roadType).toUpperCase();
  if (normalized.includes("NH")) return "NH";
  if (normalized.includes("SH")) return "SH";
  if (normalized.includes("CITY") || normalized.includes("CORPORATION")) return "Corporation / City Road";
  if (normalized.includes("MUNICIPAL") || normalized.includes("MDR")) return "Muncipal Road";
  return "Village Roads";
}

function getVehicleCategory(classType: string): VehicleCategory {
  const normalized = classType.toLowerCase();
  if (
    normalized.includes("motorcycle") ||
    normalized.includes("motor cycle") ||
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
  if (normalized.includes("bus")) return "bus";
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

function createEmptyAggregate(): UnitAggregate {
  return {
    rows: [],
    fatalCount: 0,
    nonFatalCount: 0,
    totalCount: 0,
    deaths: 0,
    injuries: 0,
    roadCounts: {
      NH: 0,
      SH: 0,
      "Corporation / City Road": 0,
      "Muncipal Road": 0,
      "Village Roads": 0,
    },
    villageLocations: [],
    reasons: [],
    policeStations: [],
    blackSpotStatuses: [],
    timeValues: [],
    vehicleStats: {
      twoWheeler: { accidents: 0, deaths: 0, injuries: 0, labels: [] },
      threeWheeler: { accidents: 0, deaths: 0, injuries: 0, labels: [] },
      carCab: { accidents: 0, deaths: 0, injuries: 0, labels: [] },
      bus: { accidents: 0, deaths: 0, injuries: 0, labels: [] },
      lorry: { accidents: 0, deaths: 0, injuries: 0, labels: [] },
      other: { accidents: 0, deaths: 0, injuries: 0, labels: [] },
    },
    helmetStatus: [],
  };
}

function locationKey(row: Pick<ReportSubmission, "district" | "place_of_accident">) {
  return `${normalizeDistrict(row.district)}|${normalizeKey(row.place_of_accident)}`;
}

function computeLocationCounts(rows: ReportSubmission[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = locationKey(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function buildAggregateMap(rows: ReportSubmission[], locationCounts: Map<string, number>) {
  const aggregateMap = new Map<string, UnitAggregate>();

  for (const row of rows) {
    const districtKey = normalizeDistrict(row.district);
    const aggregate = aggregateMap.get(districtKey) || createEmptyAggregate();
    aggregateMap.set(districtKey, aggregate);

    aggregate.rows.push(row);
    aggregate.totalCount += 1;
    if (Number(row.persons_died || 0) > 0) aggregate.fatalCount += 1;
    else aggregate.nonFatalCount += 1;

    aggregate.deaths += Number(row.persons_died || 0);
    aggregate.injuries += Number(row.persons_injured || 0);

    const roadBucket = getRoadBucket(row.road_type);
    aggregate.roadCounts[roadBucket] += 1;
    if (roadBucket === "Village Roads") {
      aggregate.villageLocations.push(row.place_of_accident);
    }

    const reasonTokens = [
      ...truthyKeys(row.driver_related_causes),
      ...truthyKeys(row.vehicle_condition_causes),
      ...truthyKeys(row.road_engineering_nature),
      ...truthyKeys(row.road_engineering_junctions),
      ...truthyKeys(row.road_engineering_signages),
      ...truthyKeys(row.road_engineering_median),
      ...truthyKeys(row.road_engineering_culverts),
    ];

    aggregate.reasons.push(...reasonTokens);
    aggregate.policeStations.push(row.police_station);
    aggregate.timeValues.push(safeString(row.accident_time));
    aggregate.blackSpotStatuses.push((locationCounts.get(locationKey(row)) || 0) >= 2 ? "Yes" : "No");

    const vehicles = toArray(row.vehicles);
    const categories = new Set<VehicleCategory>();
    for (const vehicle of vehicles) {
      if (!vehicle || typeof vehicle !== "object") continue;
      const classType = safeString((vehicle as Record<string, unknown>).class_type);
      if (!classType) continue;

      const category = getVehicleCategory(classType);
      categories.add(category);
      if (category === "other") {
        aggregate.vehicleStats.other.labels.push(classType);
      }
    }

    for (const category of categories) {
      aggregate.vehicleStats[category].accidents += 1;
      aggregate.vehicleStats[category].deaths += Number(row.persons_died || 0);
      aggregate.vehicleStats[category].injuries += Number(row.persons_injured || 0);
    }

    if (categories.has("twoWheeler")) {
      aggregate.helmetStatus.push("Not Captured");
    }
  }

  return aggregateMap;
}

function getVictimBreakdown(row: ReportSubmission) {
  const victimDetails = toArray(row.victim_details);
  let grievous = 0;
  let minor = 0;

  for (const victim of victimDetails) {
    if (!victim || typeof victim !== "object") continue;
    const status = safeString((victim as Record<string, unknown>).status).toLowerCase();
    if (status !== "injured") continue;

    const injuryType = safeString((victim as Record<string, unknown>).injury_type).toLowerCase();
    if (injuryType === "grievous") grievous += 1;
    else minor += 1;
  }

  const accounted = grievous + minor;
  const remaining = Math.max(0, Number(row.persons_injured || 0) - accounted);
  minor += remaining;

  return { grievous, minor };
}

function ensureTemplateExists() {
  const templatePath = path.resolve(process.cwd(), TEMPLATE_FILE_NAME);
  return templatePath;
}

function setCellValue(worksheet: ExcelJS.Worksheet, cellAddress: string, value: string | number | null) {
  const cell = worksheet.getCell(cellAddress);
  cell.value = value == null ? null : value;
}

function setFormulaValue(worksheet: ExcelJS.Worksheet, cellAddress: string, formula: string, result: number) {
  worksheet.getCell(cellAddress).value = { formula, result };
}

function setRowHeightFromContent(worksheet: ExcelJS.Worksheet, rowNumber: number, cellAddresses: string[], minimum = 21) {
  const maxLines = Math.max(
    1,
    ...cellAddresses.map((address) => {
      const value = worksheet.getCell(address).value;
      const raw = typeof value === "object" && value && "text" in value ? String((value as any).text || "") : String(value || "");
      return raw.split("\n").length;
    })
  );

  worksheet.getRow(rowNumber).height = Math.max(minimum, 15 * maxLines);
}

function populateDsrSheet(worksheet: ExcelJS.Worksheet, aggregateMap: Map<string, UnitAggregate>, fromDate: string, toDate: string) {
  setCellValue(
    worksheet,
    "A2",
    `Weekly DSR of Road Accidents (RoadSafety Wing) date: ${formatDateLabel(fromDate)} to ${formatDateLabel(toDate)}`
  );

  const totals = {
    fatalCount: 0,
    nonFatalCount: 0,
    totalCount: 0,
    deaths: 0,
    injuries: 0,
    nh: 0,
    sh: 0,
    city: 0,
    municipal: 0,
    village: 0,
  };

  for (let row = DSR_DATA_ROWS.start; row <= DSR_DATA_ROWS.end; row += 1) {
    const unitCode = safeString(worksheet.getCell(`B${row}`).value);
    const aggregate = aggregateMap.get(normalizeDistrict(unitCode)) || createEmptyAggregate();

    setCellValue(worksheet, `C${row}`, aggregate.fatalCount);
    setCellValue(worksheet, `D${row}`, aggregate.nonFatalCount);
    setCellValue(worksheet, `E${row}`, aggregate.totalCount);
    setCellValue(worksheet, `F${row}`, aggregate.deaths);
    setCellValue(worksheet, `G${row}`, aggregate.injuries);
    setCellValue(worksheet, `H${row}`, aggregate.roadCounts.NH);
    setCellValue(worksheet, `I${row}`, aggregate.roadCounts.SH);
    setCellValue(worksheet, `J${row}`, aggregate.roadCounts["Corporation / City Road"]);
    setCellValue(worksheet, `K${row}`, aggregate.roadCounts["Muncipal Road"]);
    setCellValue(worksheet, `L${row}`, aggregate.roadCounts["Village Roads"]);

    totals.fatalCount += aggregate.fatalCount;
    totals.nonFatalCount += aggregate.nonFatalCount;
    totals.totalCount += aggregate.totalCount;
    totals.deaths += aggregate.deaths;
    totals.injuries += aggregate.injuries;
    totals.nh += aggregate.roadCounts.NH;
    totals.sh += aggregate.roadCounts.SH;
    totals.city += aggregate.roadCounts["Corporation / City Road"];
    totals.municipal += aggregate.roadCounts["Muncipal Road"];
    totals.village += aggregate.roadCounts["Village Roads"];
  }

  const totalRow = DSR_DATA_ROWS.end + 1;
  setCellValue(worksheet, `A${totalRow}`, "TOTAL");
  setCellValue(worksheet, `B${totalRow}`, null);
  setFormulaValue(worksheet, `C${totalRow}`, `SUM(C${DSR_DATA_ROWS.start}:C${DSR_DATA_ROWS.end})`, totals.fatalCount);
  setFormulaValue(worksheet, `D${totalRow}`, `SUM(D${DSR_DATA_ROWS.start}:D${DSR_DATA_ROWS.end})`, totals.nonFatalCount);
  setFormulaValue(worksheet, `E${totalRow}`, `SUM(E${DSR_DATA_ROWS.start}:E${DSR_DATA_ROWS.end})`, totals.totalCount);
  setFormulaValue(worksheet, `F${totalRow}`, `SUM(F${DSR_DATA_ROWS.start}:F${DSR_DATA_ROWS.end})`, totals.deaths);
  setFormulaValue(worksheet, `G${totalRow}`, `SUM(G${DSR_DATA_ROWS.start}:G${DSR_DATA_ROWS.end})`, totals.injuries);
  setFormulaValue(worksheet, `H${totalRow}`, `SUM(H${DSR_DATA_ROWS.start}:H${DSR_DATA_ROWS.end})`, totals.nh);
  setFormulaValue(worksheet, `I${totalRow}`, `SUM(I${DSR_DATA_ROWS.start}:I${DSR_DATA_ROWS.end})`, totals.sh);
  setFormulaValue(worksheet, `J${totalRow}`, `SUM(J${DSR_DATA_ROWS.start}:J${DSR_DATA_ROWS.end})`, totals.city);
  setFormulaValue(worksheet, `K${totalRow}`, `SUM(K${DSR_DATA_ROWS.start}:K${DSR_DATA_ROWS.end})`, totals.municipal);
  setFormulaValue(worksheet, `L${totalRow}`, `SUM(L${DSR_DATA_ROWS.start}:L${DSR_DATA_ROWS.end})`, totals.village);
}

function populateSeveritySheet(
  worksheet: ExcelJS.Worksheet,
  aggregateMap: Map<string, UnitAggregate>,
  sheetName: SeveritySheetName
) {
  const isFatalSheet = sheetName === "Fatal";
  const totals = {
    primaryCount: 0,
    nh: 0,
    sh: 0,
    city: 0,
    municipal: 0,
    village: 0,
    twoWheelerAccidents: 0,
    twoWheelerImpact: 0,
    threeWheelerAccidents: 0,
    threeWheelerImpact: 0,
    carCabAccidents: 0,
    carCabImpact: 0,
    busAccidents: 0,
    busImpact: 0,
    lorryAccidents: 0,
    lorryImpact: 0,
    otherAccidents: 0,
    otherImpact: 0,
  };

  for (let row = SEVERITY_DATA_ROWS.start; row <= SEVERITY_DATA_ROWS.end; row += 1) {
    const unitCode = safeString(worksheet.getCell(`B${row}`).value);
    const aggregate = aggregateMap.get(normalizeDistrict(unitCode)) || createEmptyAggregate();
    const primaryCount = isFatalSheet ? aggregate.fatalCount : aggregate.nonFatalCount;
    const twoWheelerImpact = isFatalSheet ? aggregate.vehicleStats.twoWheeler.deaths : aggregate.vehicleStats.twoWheeler.injuries;
    const threeWheelerImpact = isFatalSheet ? aggregate.vehicleStats.threeWheeler.deaths : aggregate.vehicleStats.threeWheeler.injuries;
    const carCabImpact = isFatalSheet ? aggregate.vehicleStats.carCab.deaths : aggregate.vehicleStats.carCab.injuries;
    const busImpact = isFatalSheet ? aggregate.vehicleStats.bus.deaths : aggregate.vehicleStats.bus.injuries;
    const lorryImpact = isFatalSheet ? aggregate.vehicleStats.lorry.deaths : aggregate.vehicleStats.lorry.injuries;
    const otherImpact = isFatalSheet ? aggregate.vehicleStats.other.deaths : aggregate.vehicleStats.other.injuries;

    setCellValue(worksheet, `C${row}`, primaryCount);
    setCellValue(worksheet, `D${row}`, summarizeLines(aggregate.reasons, 0, 6));
    setCellValue(worksheet, `E${row}`, summarizeLines(aggregate.policeStations, 0, 6));
    setCellValue(worksheet, `F${row}`, aggregate.roadCounts.NH);
    setCellValue(worksheet, `G${row}`, aggregate.roadCounts.SH);
    setCellValue(worksheet, `H${row}`, aggregate.roadCounts["Corporation / City Road"]);
    setCellValue(worksheet, `I${row}`, aggregate.roadCounts["Muncipal Road"]);
    setCellValue(worksheet, `J${row}`, summarizeLines(aggregate.villageLocations, 0, 6));
    setCellValue(worksheet, `K${row}`, summarizeLines(aggregate.blackSpotStatuses, 0, 6));
    setCellValue(worksheet, `L${row}`, summarizeLines(aggregate.timeValues, 0, 6));
    setCellValue(worksheet, `M${row}`, aggregate.vehicleStats.twoWheeler.accidents);
    setCellValue(worksheet, `N${row}`, twoWheelerImpact);
    setCellValue(worksheet, `O${row}`, aggregate.vehicleStats.twoWheeler.accidents > 0 ? summarizeLines(aggregate.helmetStatus, "Not Captured", 3) : 0);
    setCellValue(worksheet, `P${row}`, aggregate.vehicleStats.threeWheeler.accidents);
    setCellValue(worksheet, `Q${row}`, threeWheelerImpact);
    setCellValue(worksheet, `R${row}`, aggregate.vehicleStats.carCab.accidents);
    setCellValue(worksheet, `S${row}`, carCabImpact);
    setCellValue(worksheet, `T${row}`, aggregate.vehicleStats.bus.accidents);
    setCellValue(worksheet, `U${row}`, busImpact);
    setCellValue(worksheet, `V${row}`, aggregate.vehicleStats.lorry.accidents);
    setCellValue(worksheet, `W${row}`, lorryImpact);
    setCellValue(worksheet, `X${row}`, aggregate.vehicleStats.other.accidents > 0 ? summarizeLines(aggregate.vehicleStats.other.labels, "Other", 4) : 0);
    setCellValue(worksheet, `Y${row}`, otherImpact);

    setRowHeightFromContent(worksheet, row, [`D${row}`, `E${row}`, `J${row}`, `K${row}`, `L${row}`, `O${row}`, `X${row}`], 21);

    totals.primaryCount += primaryCount;
    totals.nh += aggregate.roadCounts.NH;
    totals.sh += aggregate.roadCounts.SH;
    totals.city += aggregate.roadCounts["Corporation / City Road"];
    totals.municipal += aggregate.roadCounts["Muncipal Road"];
    totals.village += aggregate.roadCounts["Village Roads"];
    totals.twoWheelerAccidents += aggregate.vehicleStats.twoWheeler.accidents;
    totals.twoWheelerImpact += twoWheelerImpact;
    totals.threeWheelerAccidents += aggregate.vehicleStats.threeWheeler.accidents;
    totals.threeWheelerImpact += threeWheelerImpact;
    totals.carCabAccidents += aggregate.vehicleStats.carCab.accidents;
    totals.carCabImpact += carCabImpact;
    totals.busAccidents += aggregate.vehicleStats.bus.accidents;
    totals.busImpact += busImpact;
    totals.lorryAccidents += aggregate.vehicleStats.lorry.accidents;
    totals.lorryImpact += lorryImpact;
    totals.otherAccidents += aggregate.vehicleStats.other.accidents;
    totals.otherImpact += otherImpact;
  }

  const totalRow = SEVERITY_DATA_ROWS.end + 1;
  setCellValue(worksheet, `A${totalRow}`, "TOTAL");
  setCellValue(worksheet, `B${totalRow}`, null);
  setFormulaValue(worksheet, `C${totalRow}`, `SUM(C${SEVERITY_DATA_ROWS.start}:C${SEVERITY_DATA_ROWS.end})`, totals.primaryCount);
  setCellValue(worksheet, `D${totalRow}`, null);
  setCellValue(worksheet, `E${totalRow}`, null);
  setFormulaValue(worksheet, `F${totalRow}`, `SUM(F${SEVERITY_DATA_ROWS.start}:F${SEVERITY_DATA_ROWS.end})`, totals.nh);
  setFormulaValue(worksheet, `G${totalRow}`, `SUM(G${SEVERITY_DATA_ROWS.start}:G${SEVERITY_DATA_ROWS.end})`, totals.sh);
  setFormulaValue(worksheet, `H${totalRow}`, `SUM(H${SEVERITY_DATA_ROWS.start}:H${SEVERITY_DATA_ROWS.end})`, totals.city);
  setFormulaValue(worksheet, `I${totalRow}`, `SUM(I${SEVERITY_DATA_ROWS.start}:I${SEVERITY_DATA_ROWS.end})`, totals.municipal);
  setCellValue(worksheet, `J${totalRow}`, totals.village);
  setCellValue(worksheet, `K${totalRow}`, null);
  setCellValue(worksheet, `L${totalRow}`, null);
  setFormulaValue(worksheet, `M${totalRow}`, `SUM(M${SEVERITY_DATA_ROWS.start}:M${SEVERITY_DATA_ROWS.end})`, totals.twoWheelerAccidents);
  setFormulaValue(worksheet, `N${totalRow}`, `SUM(N${SEVERITY_DATA_ROWS.start}:N${SEVERITY_DATA_ROWS.end})`, totals.twoWheelerImpact);
  if (isFatalSheet) {
    setFormulaValue(worksheet, `O${totalRow}`, `SUM(O${SEVERITY_DATA_ROWS.start}:O${SEVERITY_DATA_ROWS.end})`, 0);
  } else {
    setCellValue(worksheet, `O${totalRow}`, null);
  }
  setFormulaValue(worksheet, `P${totalRow}`, `SUM(P${SEVERITY_DATA_ROWS.start}:P${SEVERITY_DATA_ROWS.end})`, totals.threeWheelerAccidents);
  setFormulaValue(worksheet, `Q${totalRow}`, `SUM(Q${SEVERITY_DATA_ROWS.start}:Q${SEVERITY_DATA_ROWS.end})`, totals.threeWheelerImpact);
  setFormulaValue(worksheet, `R${totalRow}`, `SUM(R${SEVERITY_DATA_ROWS.start}:R${SEVERITY_DATA_ROWS.end})`, totals.carCabAccidents);
  setFormulaValue(worksheet, `S${totalRow}`, `SUM(S${SEVERITY_DATA_ROWS.start}:S${SEVERITY_DATA_ROWS.end})`, totals.carCabImpact);
  setFormulaValue(worksheet, `T${totalRow}`, `SUM(T${SEVERITY_DATA_ROWS.start}:T${SEVERITY_DATA_ROWS.end})`, totals.busAccidents);
  setFormulaValue(worksheet, `U${totalRow}`, `SUM(U${SEVERITY_DATA_ROWS.start}:U${SEVERITY_DATA_ROWS.end})`, totals.busImpact);
  setFormulaValue(worksheet, `V${totalRow}`, `SUM(V${SEVERITY_DATA_ROWS.start}:V${SEVERITY_DATA_ROWS.end})`, totals.lorryAccidents);
  setFormulaValue(worksheet, `W${totalRow}`, `SUM(W${SEVERITY_DATA_ROWS.start}:W${SEVERITY_DATA_ROWS.end})`, totals.lorryImpact);
  setCellValue(worksheet, `X${totalRow}`, totals.otherAccidents);
  setFormulaValue(worksheet, `Y${totalRow}`, `SUM(Y${SEVERITY_DATA_ROWS.start}:Y${SEVERITY_DATA_ROWS.end})`, totals.otherImpact);
}

function buildTimeBuckets(rows: ReportSubmission[]) {
  return TIME_BUCKET_LABELS.map((label) => {
    const matching = rows.filter((row) => getTimeBucketLabel(row.accident_time) === label);
    const fatal = matching.filter((row) => Number(row.persons_died || 0) > 0).length;
    const nonFatal = matching.length - fatal;
    const killed = matching.reduce((sum, row) => sum + Number(row.persons_died || 0), 0);
    const injuryBreakdown = matching.reduce(
      (totals, row) => {
        const breakdown = getVictimBreakdown(row);
        totals.grievous += breakdown.grievous;
        totals.minor += breakdown.minor;
        return totals;
      },
      { grievous: 0, minor: 0 }
    );

    return {
      label,
      fatal,
      nonFatal,
      total: matching.length,
      killed,
      grievous: injuryBreakdown.grievous,
      minor: injuryBreakdown.minor,
    };
  });
}

function buildTopBlackSpotUnits(rows: ReportSubmission[], locationCounts: Map<string, number>) {
  const ranked = new Map<string, { unitCode: string; fatal: number; nonFatal: number; deaths: number }>();

  for (const row of rows) {
    if ((locationCounts.get(locationKey(row)) || 0) < 2) continue;

    const unitKey = normalizeDistrict(row.district);
    const current = ranked.get(unitKey) || {
      unitCode: getTemplateUnitCode(row.district),
      fatal: 0,
      nonFatal: 0,
      deaths: 0,
    };

    if (Number(row.persons_died || 0) > 0) current.fatal += 1;
    else current.nonFatal += 1;
    current.deaths += Number(row.persons_died || 0);
    current.unitCode = getTemplateUnitCode(row.district);
    ranked.set(unitKey, current);
  }

  return [...ranked.entries()]
    .map(([key, value]) => ({
      unitCode: safeString(value.unitCode),
      canonical: key,
      fatal: value.fatal,
      nonFatal: value.nonFatal,
      deaths: value.deaths,
    }))
    .sort((a, b) => b.deaths - a.deaths || (b.fatal + b.nonFatal) - (a.fatal + a.nonFatal) || a.unitCode.localeCompare(b.unitCode))
    .slice(0, TIME_BLACK_SPOT_ROWS.end - TIME_BLACK_SPOT_ROWS.start + 1);
}

function populateTimeWiseSheet(
  worksheet: ExcelJS.Worksheet,
  rows: ReportSubmission[],
  locationCounts: Map<string, number>
) {
  const buckets = buildTimeBuckets(rows);
  let bucketIndex = 0;
  const totals = {
    fatal: 0,
    nonFatal: 0,
    total: 0,
    killed: 0,
    grievous: 0,
    minor: 0,
  };

  for (let row = TIME_DATA_ROWS.start; row <= TIME_DATA_ROWS.end; row += 1) {
    const bucket = buckets[bucketIndex];
    setCellValue(worksheet, `A${row}`, row - TIME_DATA_ROWS.start + 1);
    setCellValue(worksheet, `C${row}`, bucket.fatal);
    setCellValue(worksheet, `D${row}`, bucket.nonFatal);
    setFormulaValue(worksheet, `E${row}`, `SUM(C${row}:D${row})`, bucket.total);
    setCellValue(worksheet, `F${row}`, bucket.killed);
    setCellValue(worksheet, `G${row}`, bucket.grievous);
    setCellValue(worksheet, `H${row}`, bucket.minor);

    totals.fatal += bucket.fatal;
    totals.nonFatal += bucket.nonFatal;
    totals.total += bucket.total;
    totals.killed += bucket.killed;
    totals.grievous += bucket.grievous;
    totals.minor += bucket.minor;
    bucketIndex += 1;
  }

  const totalRow = TIME_DATA_ROWS.end + 1;
  setCellValue(worksheet, `A${totalRow}`, "Total");
  setCellValue(worksheet, `B${totalRow}`, null);
  setFormulaValue(worksheet, `C${totalRow}`, `SUM(C${TIME_DATA_ROWS.start}:C${TIME_DATA_ROWS.end})`, totals.fatal);
  setFormulaValue(worksheet, `D${totalRow}`, `SUM(D${TIME_DATA_ROWS.start}:D${TIME_DATA_ROWS.end})`, totals.nonFatal);
  setFormulaValue(worksheet, `E${totalRow}`, `SUM(C${totalRow}:D${totalRow})`, totals.total);
  setFormulaValue(worksheet, `F${totalRow}`, `SUM(F${TIME_DATA_ROWS.start}:F${TIME_DATA_ROWS.end})`, totals.killed);
  setFormulaValue(worksheet, `G${totalRow}`, `SUM(G${TIME_DATA_ROWS.start}:G${TIME_DATA_ROWS.end})`, totals.grievous);
  setFormulaValue(worksheet, `H${totalRow}`, `SUM(H${TIME_DATA_ROWS.start}:H${TIME_DATA_ROWS.end})`, totals.minor);

  for (let row = TIME_BLACK_SPOT_ROWS.start; row <= TIME_BLACK_SPOT_ROWS.end; row += 1) {
    setCellValue(worksheet, `K${row}`, null);
    setCellValue(worksheet, `L${row}`, null);
    setCellValue(worksheet, `M${row}`, null);
    setCellValue(worksheet, `N${row}`, null);
  }

  const topUnits = buildTopBlackSpotUnits(rows, locationCounts);
  for (let index = 0; index < topUnits.length; index += 1) {
    const row = TIME_BLACK_SPOT_ROWS.start + index;
    const unit = topUnits[index];
    setCellValue(worksheet, `K${row}`, unit.unitCode);
    setCellValue(worksheet, `L${row}`, unit.fatal);
    setCellValue(worksheet, `M${row}`, unit.nonFatal);
    setCellValue(worksheet, `N${row}`, unit.deaths);
  }
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

function resolveDateRange(req: AuthRequest, res: Response) {
  const preset = safeString(req.query.preset).toLowerCase();
  if (preset === "weekly" || preset === "last-week") {
    return getPreviousWeekRange();
  }

  const fromDate = safeString(req.query.fromDate);
  const toDate = safeString(req.query.toDate);

  if (!isIsoDate(fromDate) || !isIsoDate(toDate)) {
    res.status(400).json({ error: "Valid fromDate and toDate are required in YYYY-MM-DD format" });
    return null;
  }

  if (fromDate > toDate) {
    res.status(400).json({ error: "fromDate cannot be later than toDate" });
    return null;
  }

  return { fromDate, toDate };
}

router.get("/dsr-workbook", async (req: AuthRequest, res: Response) => {
  try {
    if (!(await requireReportAccess(req, res))) return;

    const dateRange = resolveDateRange(req, res);
    if (!dateRange) return;

    const { fromDate, toDate } = dateRange;

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
       WHERE (created_at AT TIME ZONE '${REPORT_TIME_ZONE}')::date >= $1
         AND (created_at AT TIME ZONE '${REPORT_TIME_ZONE}')::date <= $2
       ORDER BY district, created_at, fir_number`,
      [fromDate, toDate]
    );

    const templatePath = ensureTemplateExists();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);
    workbook.creator = "Road Accident Data Hub";
    workbook.lastModifiedBy = "Road Accident Data Hub";
    workbook.modified = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;

    const rows = result.rows;
    const fatalRows = rows.filter((row) => Number(row.persons_died || 0) > 0);
    const nonFatalRows = rows.filter((row) => Number(row.persons_died || 0) === 0);
    const locationCounts = computeLocationCounts(rows);
    const aggregateMap = buildAggregateMap(rows, locationCounts);
    const fatalAggregateMap = buildAggregateMap(fatalRows, locationCounts);
    const nonFatalAggregateMap = buildAggregateMap(nonFatalRows, locationCounts);

    const dsrSheet = workbook.getWorksheet("DSR");
    const fatalSheet = workbook.getWorksheet("Fatal");
    const nonFatalSheet = workbook.getWorksheet("Non Fatal");
    const timeWiseSheet = workbook.getWorksheet("Time Wise");

    if (!dsrSheet || !fatalSheet || !nonFatalSheet || !timeWiseSheet) {
      res.status(500).json({ error: "Report template is missing required sheets" });
      return;
    }

    populateDsrSheet(dsrSheet, aggregateMap, fromDate, toDate);
    populateSeveritySheet(fatalSheet, fatalAggregateMap, "Fatal");
    populateSeveritySheet(nonFatalSheet, nonFatalAggregateMap, "Non Fatal");
    populateTimeWiseSheet(timeWiseSheet, rows, locationCounts);

    const fileBuffer = await workbook.xlsx.writeBuffer();
    const fileName = `Weekly_DSR_${formatDateLabel(fromDate)}_to_${formatDateLabel(toDate)}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer));
  } catch (err: any) {
    console.error("DSR workbook export error:", err);
    res.status(500).json({ error: "Failed to generate DSR workbook" });
  }
});

export default router;
