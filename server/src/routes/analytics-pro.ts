import { Router, Response } from "express";
import pool from "../db.js";
import { authMiddleware, AuthRequest } from "../auth.js";

const router = Router();

router.use(authMiddleware);

const REPORT_TIME_ZONE = "Asia/Kolkata";
const INDIA_OFFSET_MINUTES = 330;
const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DELAY_BANDS = [
  "Within 24 Hours",
  "1-3 Days",
  "4-7 Days",
  "More Than 7 Days",
] as const;

interface ProAnalyticsRow {
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

interface AccessContext {
  isAdmin: boolean;
  profileDistrict: string | null;
}

interface ScopeResult {
  whereClause: string;
  params: string[];
  effectiveDistrict: string | null;
  yearNum: number;
  viewLevel: "state" | "district";
  rangeStart: string;
  rangeEnd: string;
}

interface TimelinessSummaryRow {
  id: string;
  firNumber: string;
  district: string;
  placeOfAccident: string;
  mandal: string;
  policeStation: string;
  roadType: string;
  accidentDate: string;
  accidentTime: string;
  personsDied: number;
  personsInjured: number;
  createdAt: string;
  createdDate: string;
  createdMonth: string;
  createdMonthLabel: string;
  createdWeekday: string;
  lagHours: number;
  timelinessStatus: "Timely" | "Delayed";
  delayBand: typeof DELAY_BANDS[number];
  signedCopyStatus: "Uploaded" | "Pending";
}

interface TimelinessAccumulator {
  name: string;
  totalSubmissions: number;
  timelySubmissions: number;
  delayedSubmissions: number;
  totalLagHours: number;
  signedCopyUploaded: number;
  signedCopyPending: number;
  deaths: number;
  injuries: number;
}

function safePercentage(numerator: number, denominator: number) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function safeString(value: unknown) {
  return String(value || "").trim();
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function createAccumulator(name: string): TimelinessAccumulator {
  return {
    name,
    totalSubmissions: 0,
    timelySubmissions: 0,
    delayedSubmissions: 0,
    totalLagHours: 0,
    signedCopyUploaded: 0,
    signedCopyPending: 0,
    deaths: 0,
    injuries: 0,
  };
}

async function getAccessContext(req: AuthRequest, res: Response): Promise<AccessContext | null> {
  const userId = req.user!.userId;
  const [rolesResult, profileResult] = await Promise.all([
    pool.query("SELECT role FROM user_roles WHERE user_id = $1", [userId]),
    pool.query("SELECT district FROM profiles WHERE user_id = $1", [userId]),
  ]);

  const roles = rolesResult.rows.map((row) => row.role as string);
  const isAdmin = roles.some((role) => ["admin", "dgp", "adgp", "prism"].includes(role));
  const profileDistrict = profileResult.rows[0]?.district as string | undefined;

  if (!isAdmin && !profileDistrict) {
    res.status(403).json({ error: "Analytics Pro access requires a district profile" });
    return null;
  }

  return {
    isAdmin,
    profileDistrict: profileDistrict || null,
  };
}

function buildSubmissionScopedWhere(
  year: string | undefined,
  district: string | undefined,
  fromDate: string | undefined,
  toDate: string | undefined,
  access: AccessContext
): ScopeResult {
  const yearNum = parseInt(year || "", 10) || new Date().getFullYear();
  const params: string[] = [];
  let whereClause = "1=1";
  let effectiveDistrict: string | null = null;
  let rangeStart = `${yearNum}-01-01`;
  let rangeEnd = `${yearNum}-12-31`;

  if (isIsoDate(fromDate)) {
    rangeStart = fromDate;
    params.push(fromDate);
    whereClause += ` AND (created_at AT TIME ZONE '${REPORT_TIME_ZONE}')::date >= $${params.length}`;
  }

  if (isIsoDate(toDate)) {
    rangeEnd = toDate;
    params.push(toDate);
    whereClause += ` AND (created_at AT TIME ZONE '${REPORT_TIME_ZONE}')::date <= $${params.length}`;
  }

  if (!isIsoDate(fromDate) && !isIsoDate(toDate)) {
    params.push(`${yearNum}-01-01`, `${yearNum + 1}-01-01`);
    whereClause += ` AND (created_at AT TIME ZONE '${REPORT_TIME_ZONE}')::date >= $${params.length - 1}`;
    whereClause += ` AND (created_at AT TIME ZONE '${REPORT_TIME_ZONE}')::date < $${params.length}`;
  }

  if (access.isAdmin) {
    if (district && district !== "all") {
      params.push(district);
      whereClause += ` AND district = $${params.length}`;
      effectiveDistrict = district;
    }
  } else if (access.profileDistrict) {
    params.push(access.profileDistrict);
    whereClause += ` AND district = $${params.length}`;
    effectiveDistrict = access.profileDistrict;
  }

  return {
    whereClause,
    params,
    effectiveDistrict,
    yearNum,
    viewLevel: access.isAdmin && !effectiveDistrict ? "state" : "district",
    rangeStart,
    rangeEnd,
  };
}

function parseAccidentInstant(accidentDate: string, accidentTime: string | null) {
  const dateMatch = safeString(accidentDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const timeMatch = safeString(accidentTime).match(/^(\d{1,2})(?::|\.)(\d{1,2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const utcMillis =
    Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText), hour, minute) -
    INDIA_OFFSET_MINUTES * 60 * 1000;

  return new Date(utcMillis);
}

function getLagHours(row: ProAnalyticsRow) {
  const createdAt = new Date(row.created_at);
  const accidentAt = parseAccidentInstant(row.accident_date, row.accident_time);
  if (Number.isNaN(createdAt.getTime()) || !accidentAt) {
    return 0;
  }

  return Math.max(0, (createdAt.getTime() - accidentAt.getTime()) / (1000 * 60 * 60));
}

function getTimelinessStatus(lagHours: number): "Timely" | "Delayed" {
  return lagHours <= 24 ? "Timely" : "Delayed";
}

function getDelayBand(lagHours: number): typeof DELAY_BANDS[number] {
  if (lagHours <= 24) return "Within 24 Hours";
  if (lagHours <= 72) return "1-3 Days";
  if (lagHours <= 168) return "4-7 Days";
  return "More Than 7 Days";
}

function getCreatedDate(value: string) {
  return new Date(value);
}

function getTimeZoneDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const lookup = (type: "year" | "month" | "day") =>
    safeString(parts.find((part) => part.type === type)?.value);

  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
  };
}

function getLocalDateKey(value: Date) {
  const parts = getTimeZoneDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getLocalMonthKey(value: Date) {
  const parts = getTimeZoneDateParts(value);
  return `${parts.year}-${parts.month}`;
}

function getLocalMonthLabel(value: Date) {
  return value.toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: REPORT_TIME_ZONE,
  });
}

function getLocalWeekday(value: Date) {
  return value.toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: REPORT_TIME_ZONE,
  });
}

function toSummaryRow(row: ProAnalyticsRow): TimelinessSummaryRow {
  const lagHours = getLagHours(row);
  const createdAt = getCreatedDate(row.created_at);

  return {
    id: row.id,
    firNumber: row.fir_number,
    district: row.district,
    placeOfAccident: row.place_of_accident,
    mandal: row.mandal,
    policeStation: row.police_station,
    roadType: row.road_type,
    accidentDate: row.accident_date,
    accidentTime: row.accident_time || "",
    personsDied: Number(row.persons_died || 0),
    personsInjured: Number(row.persons_injured || 0),
    createdAt: createdAt.toISOString(),
    createdDate: getLocalDateKey(createdAt),
    createdMonth: getLocalMonthKey(createdAt),
    createdMonthLabel: getLocalMonthLabel(createdAt),
    createdWeekday: getLocalWeekday(createdAt),
    lagHours: Number(lagHours.toFixed(1)),
    timelinessStatus: getTimelinessStatus(lagHours),
    delayBand: getDelayBand(lagHours),
    signedCopyStatus: row.signed_copy_uploaded ? "Uploaded" : "Pending",
  };
}

function accumulate(map: Map<string, TimelinessAccumulator>, key: string, row: TimelinessSummaryRow) {
  const current = map.get(key) || createAccumulator(key);
  current.totalSubmissions += 1;
  current.totalLagHours += row.lagHours;
  current.deaths += row.personsDied;
  current.injuries += row.personsInjured;

  if (row.timelinessStatus === "Timely") current.timelySubmissions += 1;
  else current.delayedSubmissions += 1;

  if (row.signedCopyStatus === "Uploaded") current.signedCopyUploaded += 1;
  else current.signedCopyPending += 1;

  map.set(key, current);
}

function finalizeAccumulatorRows(map: Map<string, TimelinessAccumulator>) {
  return [...map.values()]
    .map((item) => ({
      ...item,
      timelyRate: safePercentage(item.timelySubmissions, item.totalSubmissions),
      averageLagHours: item.totalSubmissions > 0 ? item.totalLagHours / item.totalSubmissions : 0,
    }))
    .sort(
      (a, b) =>
        b.timelyRate - a.timelyRate ||
        b.timelySubmissions - a.timelySubmissions ||
        b.totalSubmissions - a.totalSubmissions ||
        a.averageLagHours - b.averageLagHours ||
        a.name.localeCompare(b.name)
    );
}

function formatSelectionTitle(filters: {
  submissionDistrict?: string;
  policeStation?: string;
  roadType?: string;
  createdDate?: string;
  createdMonth?: string;
  timelinessStatus?: string;
  delayBand?: string;
  signedCopyStatus?: string;
  createdWeekday?: string;
}) {
  if (filters.submissionDistrict) return `${filters.submissionDistrict} submissions`;
  if (filters.policeStation) return `${filters.policeStation} submissions`;
  if (filters.roadType) return `${filters.roadType} submissions`;
  if (filters.createdDate) return `Submissions created on ${filters.createdDate}`;
  if (filters.createdMonth) return `Submissions created in ${filters.createdMonth}`;
  if (filters.timelinessStatus) return `${filters.timelinessStatus} submissions`;
  if (filters.delayBand) return `${filters.delayBand} submissions`;
  if (filters.signedCopyStatus) return `${filters.signedCopyStatus} signed copy submissions`;
  if (filters.createdWeekday) return `${filters.createdWeekday} submissions`;
  return "Filtered submissions";
}

async function fetchScopedRows(scope: ScopeResult) {
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
     WHERE ${scope.whereClause}
     ORDER BY created_at DESC, fir_number`,
    scope.params
  );

  return result.rows.map(toSummaryRow);
}

router.get("/pro", async (req: AuthRequest, res: Response) => {
  try {
    const access = await getAccessContext(req, res);
    if (!access) return;

    const { district, year, fromDate, toDate } = req.query;
    if (typeof fromDate === "string" && typeof toDate === "string" && isIsoDate(fromDate) && isIsoDate(toDate) && fromDate > toDate) {
      res.status(400).json({ error: "From date cannot be later than To date" });
      return;
    }

    const scope = buildSubmissionScopedWhere(
      year as string | undefined,
      district as string | undefined,
      fromDate as string | undefined,
      toDate as string | undefined,
      access
    );
    const rows = await fetchScopedRows(scope);

    const districtMap = new Map<string, TimelinessAccumulator>();
    const stationMap = new Map<string, TimelinessAccumulator>();
    const roadTypeMap = new Map<string, TimelinessAccumulator>();
    const cadenceMap = new Map<string, { key: string; label: string; timely: number; delayed: number; total: number }>();
    const delayBandMap = new Map<string, { band: string; count: number }>();
    const weekdayMap = new Map<string, { day: string; timely: number; delayed: number; total: number }>();

    DELAY_BANDS.forEach((band) => {
      delayBandMap.set(band, { band, count: 0 });
    });

    WEEKDAY_ORDER.forEach((day) => {
      weekdayMap.set(day, { day, timely: 0, delayed: 0, total: 0 });
    });

    let timelySubmissions = 0;
    let delayedSubmissions = 0;
    let signedCopyUploaded = 0;
    let totalLagHours = 0;

    for (const row of rows) {
      totalLagHours += row.lagHours;
      if (row.timelinessStatus === "Timely") timelySubmissions += 1;
      else delayedSubmissions += 1;
      if (row.signedCopyStatus === "Uploaded") signedCopyUploaded += 1;

      accumulate(districtMap, row.district || "Unknown", row);
      accumulate(stationMap, row.policeStation || "Unknown", row);
      accumulate(roadTypeMap, row.roadType || "Unknown", row);

      const cadenceItem = cadenceMap.get(row.createdMonth) || {
        key: row.createdMonth,
        label: row.createdMonthLabel,
        timely: 0,
        delayed: 0,
        total: 0,
      };
      cadenceItem.total += 1;
      if (row.timelinessStatus === "Timely") cadenceItem.timely += 1;
      else cadenceItem.delayed += 1;
      cadenceMap.set(row.createdMonth, cadenceItem);

      const bandItem = delayBandMap.get(row.delayBand) || { band: row.delayBand, count: 0 };
      bandItem.count += 1;
      delayBandMap.set(row.delayBand, bandItem);

      const weekdayItem = weekdayMap.get(row.createdWeekday) || {
        day: row.createdWeekday,
        timely: 0,
        delayed: 0,
        total: 0,
      };
      weekdayItem.total += 1;
      if (row.timelinessStatus === "Timely") weekdayItem.timely += 1;
      else weekdayItem.delayed += 1;
      weekdayMap.set(row.createdWeekday, weekdayItem);
    }

    const districtRanking = finalizeAccumulatorRows(districtMap);
    const stationRanking = finalizeAccumulatorRows(stationMap);
    const roadTimeliness = finalizeAccumulatorRows(roadTypeMap);
    const recentLateSubmissions = [...rows]
      .filter((row) => row.timelinessStatus === "Delayed")
      .sort((a, b) => b.lagHours - a.lagHours || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10);

    const districtsCovered = new Set(rows.map((row) => row.district).filter(Boolean)).size;
    const activeStations = new Set(rows.map((row) => row.policeStation).filter(Boolean)).size;
    const totalSubmissions = rows.length;

    res.json({
      scope: {
        viewLevel: scope.viewLevel,
        district: scope.effectiveDistrict,
        scopeLabel: scope.effectiveDistrict || "Andhra Pradesh",
        comparisonLabel: scope.viewLevel === "state" ? "District" : "Police Station",
        year: scope.yearNum,
        rangeStart: scope.rangeStart,
        rangeEnd: scope.rangeEnd,
        usesCreatedAt: true,
      },
      summary: {
        totalSubmissions,
        timelySubmissions,
        delayedSubmissions,
        timelyRate: safePercentage(timelySubmissions, totalSubmissions),
        averageLagHours: totalSubmissions > 0 ? totalLagHours / totalSubmissions : 0,
        signedCopyUploaded,
        signedCopyPending: totalSubmissions - signedCopyUploaded,
        districtsCovered,
        activeStations,
      },
      submissionCadence: [...cadenceMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
      districtRanking,
      stationRanking,
      roadTimeliness,
      delayBands: DELAY_BANDS.map((band) => delayBandMap.get(band) || { band, count: 0 }),
      weekdayPattern: WEEKDAY_ORDER.map((day) => weekdayMap.get(day) || { day, timely: 0, delayed: 0, total: 0 }),
      recentLateSubmissions,
    });
  } catch (err: any) {
    console.error("Analytics Pro error:", err);
    res.status(500).json({ error: `Failed to generate analytics pro data: ${err.message}` });
  }
});

router.get("/pro-drilldown", async (req: AuthRequest, res: Response) => {
  try {
    const access = await getAccessContext(req, res);
    if (!access) return;

    const { district, year, fromDate, toDate } = req.query;
    if (typeof fromDate === "string" && typeof toDate === "string" && isIsoDate(fromDate) && isIsoDate(toDate) && fromDate > toDate) {
      res.status(400).json({ error: "From date cannot be later than To date" });
      return;
    }

    const scope = buildSubmissionScopedWhere(
      year as string | undefined,
      district as string | undefined,
      fromDate as string | undefined,
      toDate as string | undefined,
      access
    );
    const rows = await fetchScopedRows(scope);

    const selection = {
      submissionDistrict: safeString(req.query.submissionDistrict),
      policeStation: safeString(req.query.policeStation),
      roadType: safeString(req.query.roadType),
      createdDate: safeString(req.query.createdDate),
      createdMonth: safeString(req.query.createdMonth),
      timelinessStatus: safeString(req.query.timelinessStatus),
      delayBand: safeString(req.query.delayBand),
      signedCopyStatus: safeString(req.query.signedCopyStatus),
      createdWeekday: safeString(req.query.createdWeekday),
    };

    const filteredRows = rows.filter((row) => {
      if (selection.submissionDistrict && row.district !== selection.submissionDistrict) return false;
      if (selection.policeStation && row.policeStation !== selection.policeStation) return false;
      if (selection.roadType && row.roadType !== selection.roadType) return false;
      if (selection.createdDate && row.createdDate !== selection.createdDate) return false;
      if (selection.createdMonth && row.createdMonth !== selection.createdMonth) return false;
      if (selection.timelinessStatus && row.timelinessStatus !== selection.timelinessStatus) return false;
      if (selection.delayBand && row.delayBand !== selection.delayBand) return false;
      if (selection.signedCopyStatus && row.signedCopyStatus !== selection.signedCopyStatus) return false;
      if (selection.createdWeekday && row.createdWeekday !== selection.createdWeekday) return false;
      return true;
    });

    res.json({
      title: formatSelectionTitle(selection),
      scope: {
        viewLevel: scope.viewLevel,
        district: scope.effectiveDistrict,
        scopeLabel: scope.effectiveDistrict || "Andhra Pradesh",
        rangeStart: scope.rangeStart,
        rangeEnd: scope.rangeEnd,
      },
      selection,
      count: filteredRows.length,
      submissions: filteredRows,
    });
  } catch (err: any) {
    console.error("Analytics Pro drilldown error:", err);
    res.status(500).json({ error: `Failed to load drilldown submissions: ${err.message}` });
  }
});

export default router;
