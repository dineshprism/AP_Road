import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import GovHeader from "@/components/GovHeader";
import AccidentChat from "@/components/AccidentChat";
import AnalyticsSubmissionInspector, {
  AnalyticsClassicDrilldownFilters,
  AnalyticsProDrilldownFilters,
} from "@/components/analytics/AnalyticsSubmissionInspector";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { AP_DISTRICTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock3,
  FileCheck,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";

interface TimelinessRankingRow {
  name: string;
  totalSubmissions: number;
  timelySubmissions: number;
  delayedSubmissions: number;
  timelyRate: number;
  averageLagHours: number;
  signedCopyUploaded: number;
  signedCopyPending: number;
  deaths: number;
  injuries: number;
}

interface AnalyticsProData {
  scope: {
    viewLevel: "state" | "district";
    district: string | null;
    scopeLabel: string;
    comparisonLabel: string;
    year: number;
    rangeStart: string;
    rangeEnd: string;
    usesCreatedAt: boolean;
  };
  summary: {
    totalSubmissions: number;
    timelySubmissions: number;
    delayedSubmissions: number;
    timelyRate: number;
    averageLagHours: number;
    signedCopyUploaded: number;
    signedCopyPending: number;
    districtsCovered: number;
    activeStations: number;
  };
  submissionCadence: Array<{
    key: string;
    label: string;
    timely: number;
    delayed: number;
    total: number;
  }>;
  districtRanking: TimelinessRankingRow[];
  stationRanking: TimelinessRankingRow[];
  roadTimeliness: TimelinessRankingRow[];
  delayBands: Array<{ band: string; count: number }>;
  weekdayPattern: Array<{ day: string; timely: number; delayed: number; total: number }>;
  recentLateSubmissions: Array<{
    id: string;
    firNumber: string;
    district: string;
    placeOfAccident: string;
    policeStation: string;
    createdAt: string;
    lagHours: number;
    timelinessStatus: "Timely" | "Delayed";
    delayBand: string;
  }>;
}

interface EnhancedAnalyticsData {
  scope: {
    viewLevel: "state" | "district";
    district: string | null;
    comparisonLabel: string;
    scopeLabel: string;
    year: number;
  };
  summary: {
    totalAccidents: number;
    totalDeaths: number;
    totalInjuries: number;
    averageDeathsPerAccident: number;
    averageFatalityRate: number;
    totalVehicles: number;
    totalDrivers: number;
    averageVehiclesPerAccident: number;
    peakAccidentHour: string;
    peakAccidentMonth: string;
    mostDangerousRoadType: string;
    signedCopyUploaded: number;
    signedCopyPending: number;
  };
  trendData: Array<{ month: string; accidents: number; deaths: number; injuries: number; fatalityRate: number }>;
  timeAnalysis: Array<{ hour: string; accidents: number; deaths: number; injuries: number }>;
  causeAnalysis: Array<{ cause: string; count: number; percentage: number; category: string }>;
  comparisonData: Array<{ name: string; accidents: number; deaths: number; injuries: number; fatalityRate: number; severity: string }>;
  roadTypeAnalysis: Array<{
    roadType: string;
    accidents: number;
    deaths: number;
    injuries: number;
    fatalityRate: number;
    accidentShare: number;
    deathShare: number;
    injuryShare: number;
    casualties: number;
    casualtiesPerAccident: number;
    severityIndex: number;
  }>;
  roadTypeInsights: {
    highestVolume: EnhancedAnalyticsData["roadTypeAnalysis"][number] | null;
    highestDeaths: EnhancedAnalyticsData["roadTypeAnalysis"][number] | null;
    highestFatalityRate: EnhancedAnalyticsData["roadTypeAnalysis"][number] | null;
    highestSeverityIndex: EnhancedAnalyticsData["roadTypeAnalysis"][number] | null;
  };
  hotspotsLocations: Array<{ place: string; district: string; accidents: number; deaths: number; injured: number; severity: string; riskScore: number }>;
  driverCauses: Array<{ cause: string; count: number; percentage: number; severity: "high" | "medium" | "low" }>;
  vehicleCauses: Array<{ cause: string; count: number; percentage: number; severity: "high" | "medium" | "low" }>;
  roadEngineeringCauses: Array<{ category: string; causes: Array<{ name: string; count: number; percentage: number }>; totalIncidents: number }>;
  vehicleAnalysis: Array<{ type: string; count: number; deaths: number; injuries: number }>;
  policeStationAnalysis: Array<{ name: string; accidents: number; deaths: number; injuries: number; fatalityRate: number }>;
  dayOfWeekAnalysis: Array<{ day: string; accidents: number; deaths: number; injuries: number }>;
  severityBreakdown: Array<{ name: string; count: number; percentage: number }>;
  fieldCompleteness: Array<{ field: string; available: number; missing: number; coverage: number }>;
  geminiInsights: {
    overallAssessment: string;
    keyFindings: string[];
    recommendations: string[];
    predictiveAnalysis: string;
    riskFactors: string[];
  };
}

interface DrilldownSubmissionSummary {
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
  delayBand: string;
  signedCopyStatus: "Uploaded" | "Pending";
}

interface DrilldownResponse {
  title: string;
  scope: {
    viewLevel: "state" | "district";
    district: string | null;
    scopeLabel: string;
    rangeStart: string;
    rangeEnd: string;
  };
  count: number;
  submissions: DrilldownSubmissionSummary[];
}

type ChatScopeKey = "hotspot" | "fatal" | "delayed" | "road" | "time" | "watchlist";

interface ChatStudioScope {
  key: ChatScopeKey;
  label: string;
  description: string;
  helper: string;
  badge: string;
  count: number;
  mode: "classic" | "pro";
  filters: AnalyticsClassicDrilldownFilters | AnalyticsProDrilldownFilters;
  sortBy: "createdAt" | "lagHours" | "deaths";
  maxSubmissions: number;
  emptyMessage: string;
}

type InspectorRequest =
  | { mode: "pro"; filters: AnalyticsProDrilldownFilters }
  | { mode: "classic"; filters: AnalyticsClassicDrilldownFilters }
  | null;

const CHART_COLORS = {
  timely: "#1f8a70",
  delayed: "#d95d39",
  accidents: "#163a70",
  deaths: "#b42318",
  injuries: "#d97706",
  severity: "#0f766e",
};

const PIE_COLORS = ["#163a70", "#1f8a70", "#d97706", "#d95d39", "#2b5c8f", "#7c3aed", "#c48a15"];

const DSR_TIME_BUCKETS = [
  { label: "06.00 to 09.00 (Day)", hours: ["06:00", "07:00", "08:00"], period: "Day" as const },
  { label: "09.00 to 12.00 (Day)", hours: ["09:00", "10:00", "11:00"], period: "Day" as const },
  { label: "12.00 to 15.00 (Day)", hours: ["12:00", "13:00", "14:00"], period: "Day" as const },
  { label: "15.00 to 18.00 (Day)", hours: ["15:00", "16:00", "17:00"], period: "Day" as const },
  { label: "18.00 to 21.00 (Night)", hours: ["18:00", "19:00", "20:00"], period: "Night" as const },
  { label: "21.00 to 24.00 (Night)", hours: ["21:00", "22:00", "23:00"], period: "Night" as const },
  { label: "00.00 to 03.00 (Night)", hours: ["00:00", "01:00", "02:00"], period: "Night" as const },
  { label: "03.00 to 06.00 (Night)", hours: ["03:00", "04:00", "05:00"], period: "Night" as const },
];

const severityClasses: Record<string, string> = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Fatal: "border-red-200 bg-red-50 text-red-700",
  Injury: "border-orange-200 bg-orange-50 text-orange-700",
  "Damage Only": "border-slate-200 bg-slate-50 text-slate-700",
};

function toIsoDate(value: Date | undefined) {
  return value ? format(value, "yyyy-MM-dd") : "";
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLabel(value: string) {
  const parsed = parseIsoDate(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function compact(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatRatioPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatLagHours(value: number) {
  return `${value.toFixed(1)} hrs`;
}

function formatCauseLabel(value: string, limit = 44) {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function getChartPayload<T>(entry: unknown): T | null {
  if (!entry) return null;
  if (typeof entry === "object" && entry !== null && "payload" in entry) {
    const payload = (entry as { payload?: T }).payload;
    if (payload) return payload;
  }
  return entry as T;
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function findCoverage(items: EnhancedAnalyticsData["fieldCompleteness"] | undefined, field: string) {
  return items?.find((item) => item.field === field) || { field, available: 0, missing: 0, coverage: 0 };
}

function buildTimeBucketAnalysis(timeAnalysis: EnhancedAnalyticsData["timeAnalysis"]) {
  const byHour = new Map(timeAnalysis.map((item) => [item.hour, item]));
  return DSR_TIME_BUCKETS.map((bucket) =>
    bucket.hours.reduce(
      (accumulator, hour) => {
        const value = byHour.get(hour);
        if (!value) return accumulator;
        return {
          ...accumulator,
          accidents: accumulator.accidents + value.accidents,
          deaths: accumulator.deaths + value.deaths,
          injuries: accumulator.injuries + value.injuries,
        };
      },
      { label: bucket.label, period: bucket.period, accidents: 0, deaths: 0, injuries: 0 }
    )
  );
}

function buildDayNightSplit(timeBuckets: ReturnType<typeof buildTimeBucketAnalysis>) {
  return ["Day", "Night"].map((period) =>
    timeBuckets
      .filter((bucket) => bucket.period === period)
      .reduce(
        (accumulator, bucket) => ({
          label: period,
          accidents: accumulator.accidents + bucket.accidents,
          deaths: accumulator.deaths + bucket.deaths,
          injuries: accumulator.injuries + bucket.injuries,
        }),
        { label: period, accidents: 0, deaths: 0, injuries: 0 }
      )
  );
}

function groupCauseCategories(causes: EnhancedAnalyticsData["causeAnalysis"]) {
  const totals = new Map<string, number>();
  causes.forEach((item) => {
    totals.set(item.category, (totals.get(item.category) || 0) + item.count);
  });
  return [...totals.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function CountBadgeButton({
  value,
  onClick,
  variant = "default",
  className,
}: {
  value: number;
  onClick?: () => void;
  variant?: "default" | "outline";
  className?: string;
}) {
  if (!onClick) {
    return (
      <Badge variant={variant} className={cn("rounded-full px-3 py-1 text-sm font-semibold", className)}>
        {compact(value)}
      </Badge>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={variant === "outline" ? "outline" : "secondary"}
      className={cn("h-8 rounded-full px-3 text-sm font-semibold", className)}
      onClick={onClick}
    >
      {compact(value)}
    </Button>
  );
}

function MetricCard({
  title,
  value,
  description,
  accent,
  icon: Icon,
  onClick,
}: {
  title: string;
  value: string;
  description: string;
  accent: string;
  icon: ComponentType<{ className?: string }>;
  onClick?: () => void;
}) {
  return (
    <Card className="analytics-liquid-panel analytics-elevate analytics-sheen overflow-hidden border border-white/75 bg-white/78 shadow-[0_28px_72px_-46px_rgba(15,23,42,0.44)] backdrop-blur">
      <div className={cn("h-1.5", accent)} />
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
            {onClick ? (
              <Button variant="ghost" className="mt-2 h-auto px-0 py-0 text-left hover:bg-transparent" onClick={onClick}>
                <span className="analytics-display-font text-3xl font-bold tracking-tight text-slate-900">{value}</span>
                <ArrowUpRight className="ml-2 h-4 w-4 text-slate-400" />
              </Button>
            ) : (
              <p className="analytics-display-font mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
            )}
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(226,232,240,0.95)_100%)] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function sortChatSubmissions(submissions: DrilldownSubmissionSummary[], sortBy: ChatStudioScope["sortBy"]) {
  const sorted = [...submissions];

  sorted.sort((a, b) => {
    if (sortBy === "lagHours") {
      return b.lagHours - a.lagHours || b.createdAt.localeCompare(a.createdAt);
    }

    if (sortBy === "deaths") {
      return (
        b.personsDied - a.personsDied ||
        b.personsInjured - a.personsInjured ||
        b.lagHours - a.lagHours ||
        b.createdAt.localeCompare(a.createdAt)
      );
    }

    return b.createdAt.localeCompare(a.createdAt);
  });

  return sorted;
}

const AnalyticsPro = () => {
  const navigate = useNavigate();
  const { user, isAdmin, roles, profile, loading: authLoading } = useAuth();
  const currentYear = new Date().getFullYear().toString();

  const [filters, setFilters] = useState({ district: "all", year: currentYear, fromDate: "", toDate: "" });
  const [appliedFilters, setAppliedFilters] = useState({ district: "all", year: currentYear, fromDate: "", toDate: "" });
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [timelinessData, setTimelinessData] = useState<AnalyticsProData | null>(null);
  const [enhancedData, setEnhancedData] = useState<EnhancedAnalyticsData | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorRequest, setInspectorRequest] = useState<InspectorRequest>(null);
  const [chatScope, setChatScope] = useState<ChatScopeKey>("hotspot");
  const [chatData, setChatData] = useState<DrilldownResponse | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      toast.error("Please login to access analytics");
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!isAdmin && profile?.district) {
      setFilters((prev) => ({ ...prev, district: profile.district }));
      setAppliedFilters((prev) => ({ ...prev, district: profile.district }));
    }
  }, [isAdmin, profile?.district]);

  const goBack = useMemo(() => {
    if (roles.includes("prism")) return "/prism-dashboard";
    if (roles.includes("adgp")) return "/adgp-dashboard";
    if (roles.includes("dgp") || roles.includes("admin")) return "/admin";
    return "/dashboard";
  }, [roles]);

  const years = useMemo(
    () => Array.from({ length: 6 }, (_, index) => (new Date().getFullYear() - index).toString()),
    []
  );

  const requestedDistrict = isAdmin ? appliedFilters.district : profile?.district || appliedFilters.district;
  const scopeFilters = useMemo(
    () => ({
      district: requestedDistrict,
      year: appliedFilters.year,
      fromDate: appliedFilters.fromDate || undefined,
      toDate: appliedFilters.toDate || undefined,
    }),
    [appliedFilters, requestedDistrict]
  );

  const hasCustomDateRange = Boolean(filters.fromDate || filters.toDate);

  const openProInspector = (filtersToApply: AnalyticsProDrilldownFilters) => {
    setInspectorRequest({ mode: "pro", filters: filtersToApply });
    setInspectorOpen(true);
  };

  const openClassicInspector = (filtersToApply: AnalyticsClassicDrilldownFilters = {}) => {
    setInspectorRequest({ mode: "classic", filters: filtersToApply });
    setInspectorOpen(true);
  };

  const fetchAnalyticsBundle = useCallback(async () => {
    try {
      setLoading(true);
      const [proResponse, enhancedResponse] = await Promise.all([
        api.analytics.getAnalyticsPro(scopeFilters),
        api.analytics.getEnhancedAnalytics(scopeFilters),
      ]);

      if (proResponse.error || !proResponse.data || enhancedResponse.error || !enhancedResponse.data) {
        toast.error(proResponse.error || enhancedResponse.error || "Failed to load analytics workspace");
        setTimelinessData(null);
        setEnhancedData(null);
        return;
      }

      setTimelinessData(proResponse.data);
      setEnhancedData(enhancedResponse.data);
    } catch (error) {
      console.error("Failed to fetch analytics workspace:", error);
      toast.error("Failed to load analytics workspace");
      setTimelinessData(null);
      setEnhancedData(null);
    } finally {
      setLoading(false);
    }
  }, [scopeFilters]);

  useEffect(() => {
    if (!authLoading && user) {
      void fetchAnalyticsBundle();
    }
  }, [authLoading, user, fetchAnalyticsBundle]);

  const applyFilters = () => {
    if (filters.fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(filters.fromDate)) {
      toast.error("From date must be in YYYY-MM-DD format");
      return;
    }
    if (filters.toDate && !/^\d{4}-\d{2}-\d{2}$/.test(filters.toDate)) {
      toast.error("To date must be in YYYY-MM-DD format");
      return;
    }
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      toast.error("From date cannot be later than To date");
      return;
    }

    setAppliedFilters(filters);
  };

  const rankingRows = useMemo(() => {
    if (!timelinessData) return [];
    return timelinessData.scope.viewLevel === "state" ? timelinessData.districtRanking : timelinessData.stationRanking;
  }, [timelinessData]);

  const timeBucketAnalysis = useMemo(() => buildTimeBucketAnalysis(enhancedData?.timeAnalysis || []), [enhancedData?.timeAnalysis]);
  const dayNightSplit = useMemo(() => buildDayNightSplit(timeBucketAnalysis), [timeBucketAnalysis]);
  const causeCategoryMix = useMemo(() => groupCauseCategories(enhancedData?.causeAnalysis || []), [enhancedData?.causeAnalysis]);

  const gpsCoverage = findCoverage(enhancedData?.fieldCompleteness, "GPS Coordinates");
  const vehicleCoverage = findCoverage(enhancedData?.fieldCompleteness, "Vehicle Details");
  const driverCoverage = findCoverage(enhancedData?.fieldCompleteness, "Driver Details");
  const driverCauseCoverage = findCoverage(enhancedData?.fieldCompleteness, "Driver Cause Details");
  const vehicleCauseCoverage = findCoverage(enhancedData?.fieldCompleteness, "Vehicle Condition Details");
  const roadCoverage = findCoverage(enhancedData?.fieldCompleteness, "Road Engineering Details");
  const documentationCoverage = average([
    gpsCoverage.coverage,
    vehicleCoverage.coverage,
    driverCoverage.coverage,
    driverCauseCoverage.coverage,
    vehicleCauseCoverage.coverage,
    roadCoverage.coverage,
  ]);
  const topPerformer = rankingRows[0] || null;
  const watchlistPerformer = rankingRows[rankingRows.length - 1] || null;
  const topHotspot = enhancedData?.hotspotsLocations[0] || null;
  const topComparison = enhancedData?.comparisonData[0] || null;
  const topRoadBySeverity = enhancedData?.roadTypeInsights.highestSeverityIndex || null;
  const topVehicleType = enhancedData?.vehicleAnalysis[0] || null;
  const topCauseCategory = causeCategoryMix[0] || null;
  const peakTimeBucket = [...timeBucketAnalysis].sort((a, b) => b.accidents - a.accidents)[0] || null;
  const riskSummary = enhancedData?.summary || {
    totalAccidents: 0,
    totalDeaths: 0,
    totalInjuries: 0,
    averageDeathsPerAccident: 0,
    averageFatalityRate: 0,
    totalVehicles: 0,
    totalDrivers: 0,
    averageVehiclesPerAccident: 0,
    peakAccidentHour: "",
    peakAccidentMonth: "",
    mostDangerousRoadType: "",
    signedCopyUploaded: 0,
    signedCopyPending: 0,
  };
  const timeSummary = timelinessData?.summary || {
    totalSubmissions: 0,
    timelySubmissions: 0,
    delayedSubmissions: 0,
    timelyRate: 0,
    averageLagHours: 0,
    signedCopyUploaded: 0,
    signedCopyPending: 0,
    districtsCovered: 0,
    activeStations: 0,
  };
  const topFiveHotspotShare =
    riskSummary.totalAccidents > 0
      ? ((enhancedData?.hotspotsLocations.slice(0, 5).reduce((sum, item) => sum + item.accidents, 0) || 0) / riskSummary.totalAccidents) * 100
      : 0;
  const nightSummary = dayNightSplit.find((item) => item.label === "Night") || { label: "Night", accidents: 0, deaths: 0, injuries: 0 };
  const nightShare = riskSummary.totalAccidents ? (nightSummary.accidents / riskSummary.totalAccidents) * 100 : 0;
  const delayPressure = timeSummary.totalSubmissions ? (timeSummary.delayedSubmissions / timeSummary.totalSubmissions) * 100 : 0;
  const casualtyDensity = riskSummary.totalAccidents
    ? (riskSummary.totalDeaths + riskSummary.totalInjuries) / riskSummary.totalAccidents
    : 0;
  const documentationGap = Math.max(0, 100 - documentationCoverage);
  const fatalCasesCount = enhancedData?.severityBreakdown.find((item) => item.name === "Fatal")?.count || 0;
  const severeDelayCount = timelinessData?.delayBands.find((item) => item.band === "More Than 7 Days")?.count || 0;
  const rankingTitle = timelinessData?.scope.viewLevel === "state"
    ? "District Submission Timeliness"
    : "Police Station Submission Timeliness";
  const rankingDescription = timelinessData?.scope.viewLevel === "state"
    ? "Districts are ranked by on-time submission rate, then by volume and average lag."
    : "Police stations are ranked within the current district scope using on-time rate and delay profile.";
  const leadershipSignals = useMemo(
    () => [
      {
        label: "Hotspot Concentration",
        value: formatPercent(topFiveHotspotShare),
        description: `Top 5 hotspots account for ${compact(enhancedData?.hotspotsLocations.slice(0, 5).reduce((sum, item) => sum + item.accidents, 0) || 0)} crashes in scope.`,
      },
      {
        label: "Night Burden",
        value: formatPercent(nightShare),
        description: `${compact(nightSummary.accidents)} crashes and ${compact(nightSummary.deaths)} deaths occurred in the night window.`,
      },
      {
        label: "Response Friction",
        value: formatPercent(delayPressure),
        description: `${compact(timeSummary.delayedSubmissions)} submissions missed the 24-hour response line.`,
      },
      {
        label: "Casualty Density",
        value: `${casualtyDensity.toFixed(2)}`,
        description: "Deaths and injuries combined per accident, useful for severity prioritisation.",
      },
      {
        label: "Documentation Gap",
        value: formatPercent(documentationGap),
        description: "Average missing share across geo, vehicle, driver, cause, and engineering fields.",
      },
      {
        label: "High-Risk Road",
        value: topRoadBySeverity?.roadType || "Not available",
        description: topRoadBySeverity
          ? `${topRoadBySeverity.severityIndex.toFixed(2)} severity index with ${compact(topRoadBySeverity.accidents)} crashes.`
          : "No road severity pattern available.",
      },
    ],
    [
      casualtyDensity,
      delayPressure,
      documentationGap,
      enhancedData?.hotspotsLocations,
      nightShare,
      nightSummary.accidents,
      nightSummary.deaths,
      timeSummary.delayedSubmissions,
      topFiveHotspotShare,
      topRoadBySeverity,
    ]
  );
  const roadResponseMatrix = useMemo(() => {
    const roadTimelinessMap = new Map((timelinessData?.roadTimeliness || []).map((item) => [item.name, item]));

    return (enhancedData?.roadTypeAnalysis || [])
      .map((item) => {
        const ops = roadTimelinessMap.get(item.roadType);
        return {
          roadType: item.roadType,
          accidents: item.accidents,
          severityIndex: item.severityIndex,
          timelyRate: ops?.timelyRate || 0,
          averageLagHours: ops?.averageLagHours || 0,
          signedCopyPending: ops?.signedCopyPending || 0,
        };
      })
      .filter((item) => item.accidents > 0)
      .sort((a, b) => b.severityIndex - a.severityIndex || b.accidents - a.accidents)
      .slice(0, 6);
  }, [enhancedData?.roadTypeAnalysis, timelinessData?.roadTimeliness]);
  const chatScopes = useMemo<ChatStudioScope[]>(
    () => [
      {
        key: "hotspot",
        label: "Hotspot Cluster",
        description: topHotspot ? `${topHotspot.place}, ${topHotspot.district}` : "Highest concentration location in current scope",
        helper: "Use this when DIG needs a location-specific narrative on repeat crash pressure, local causes, and immediate interventions.",
        badge: topHotspot ? `${compact(topHotspot.accidents)} crashes` : "Awaiting hotspot data",
        count: topHotspot?.accidents || 0,
        mode: "classic",
        filters: topHotspot ? { hotspotPlace: topHotspot.place, hotspotDistrict: topHotspot.district } : {},
        sortBy: "deaths",
        maxSubmissions: 10,
        emptyMessage: "No hotspot-linked submissions are available for the current selection.",
      },
      {
        key: "fatal",
        label: "Fatal Cases",
        description: "Deaths-linked submissions across the active command window",
        helper: "Best for casualty-heavy review notes, cause synthesis, and leadership talking points on fatal crash reduction.",
        badge: `${compact(fatalCasesCount)} fatal submissions`,
        count: fatalCasesCount,
        mode: "classic",
        filters: { metric: "deaths" },
        sortBy: "deaths",
        maxSubmissions: 10,
        emptyMessage: "No fatal submissions are available for the current selection.",
      },
      {
        key: "delayed",
        label: "Critical Delays",
        description: "Submissions delayed by more than seven days",
        helper: "Use this to investigate operational friction, documentation lag, and supervisory bottlenecks.",
        badge: `${compact(severeDelayCount)} severe delays`,
        count: severeDelayCount,
        mode: "pro",
        filters: { delayBand: "More Than 7 Days" },
        sortBy: "lagHours",
        maxSubmissions: 8,
        emptyMessage: "No severe-delay submissions are available for the current selection.",
      },
      {
        key: "road",
        label: "High Severity Road",
        description: topRoadBySeverity?.roadType || "Road type with the highest severity index",
        helper: "Useful for a systemic road-safety discussion that ties severity, engineering, and enforcement response together.",
        badge: topRoadBySeverity ? `${topRoadBySeverity.severityIndex.toFixed(2)} severity index` : "Awaiting road severity",
        count: topRoadBySeverity?.accidents || 0,
        mode: "classic",
        filters: topRoadBySeverity ? { roadType: topRoadBySeverity.roadType } : {},
        sortBy: "deaths",
        maxSubmissions: 10,
        emptyMessage: "No high-severity road submissions are available for the current selection.",
      },
      {
        key: "time",
        label: "Peak Risk Window",
        description: peakTimeBucket?.label || "Highest-pressure time bucket in the current scope",
        helper: "Use this for staffing, patrol placement, and time-window intervention reviews.",
        badge: peakTimeBucket ? `${compact(peakTimeBucket.accidents)} crashes` : "Awaiting time-pattern data",
        count: peakTimeBucket?.accidents || 0,
        mode: "classic",
        filters: peakTimeBucket ? { timeBucket: peakTimeBucket.label } : {},
        sortBy: "deaths",
        maxSubmissions: 10,
        emptyMessage: "No peak-window submissions are available for the current selection.",
      },
      {
        key: "watchlist",
        label: "Watchlist Unit",
        description: watchlistPerformer?.name || "Lowest-performing operational unit in the active scope",
        helper: "Focus this when DIG needs a direct conversation on why the weakest unit is slipping on timeliness or documentation quality.",
        badge: watchlistPerformer ? `${formatPercent(watchlistPerformer.timelyRate)} timely rate` : "Awaiting unit watchlist",
        count: watchlistPerformer?.totalSubmissions || 0,
        mode: "pro",
        filters: timelinessData?.scope.viewLevel === "state"
          ? { submissionDistrict: watchlistPerformer?.name || undefined }
          : { policeStation: watchlistPerformer?.name || undefined },
        sortBy: "lagHours",
        maxSubmissions: 8,
        emptyMessage: "No watchlist-unit submissions are available for the current selection.",
      },
    ],
    [
      fatalCasesCount,
      peakTimeBucket,
      severeDelayCount,
      timelinessData?.scope.viewLevel,
      topHotspot,
      topRoadBySeverity,
      watchlistPerformer,
    ]
  );
  const selectedChatScope = chatScopes.find((scope) => scope.key === chatScope) || chatScopes[0];

  useEffect(() => {
    if (!user || !timelinessData || !enhancedData || !selectedChatScope) return;

    let active = true;
    setChatLoading(true);
    setChatError(null);

    if (selectedChatScope.count === 0) {
      setChatData({
        title: selectedChatScope.label,
        scope: {
          viewLevel: timelinessData.scope.viewLevel,
          district: timelinessData.scope.district,
          scopeLabel: timelinessData.scope.scopeLabel,
          rangeStart: timelinessData.scope.rangeStart,
          rangeEnd: timelinessData.scope.rangeEnd,
        },
        count: 0,
        submissions: [],
      });
      setChatLoading(false);
      return;
    }

    const request =
      selectedChatScope.mode === "classic"
        ? api.analytics.getEnhancedAnalyticsDrilldown({
            ...scopeFilters,
            ...(selectedChatScope.filters as AnalyticsClassicDrilldownFilters),
          })
        : api.analytics.getAnalyticsProDrilldown({
            ...scopeFilters,
            ...(selectedChatScope.filters as AnalyticsProDrilldownFilters),
          });

    request
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setChatData(null);
          setChatError(error || "Failed to load AI studio context");
          return;
        }

        const orderedSubmissions = sortChatSubmissions(data.submissions, selectedChatScope.sortBy);
        setChatData({
          ...data,
          submissions: orderedSubmissions.slice(0, selectedChatScope.maxSubmissions),
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("Failed to load AI studio scope:", error);
        setChatData(null);
        setChatError("Failed to load AI studio context");
      })
      .finally(() => {
        if (active) setChatLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enhancedData, scopeFilters, selectedChatScope, timelinessData, user]);
  const chatSubmissions = useMemo(
    () =>
      (chatData?.submissions || []).map((submission) => ({
        id: submission.id,
        fir_number: submission.firNumber,
        district: submission.district,
        place_of_accident: submission.placeOfAccident,
        mandal: submission.mandal,
      })),
    [chatData?.submissions]
  );

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7fafe_0%,#edf3fb_100%)]">
        <GovHeader />
        <div className="container mx-auto px-4 py-10">
          <Card className="border-slate-200">
            <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4">
              <RefreshCw className="h-9 w-9 animate-spin text-primary" />
              <p className="text-lg font-semibold text-slate-900">Loading Analytics Pro</p>
              <p className="text-sm text-slate-500">Preparing command analytics, hotspot intelligence, and submission drilldowns.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!timelinessData || !enhancedData) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7fafe_0%,#edf3fb_100%)]">
        <GovHeader />
        <div className="container mx-auto px-4 py-10">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-12 text-center">
              <TriangleAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
              <p className="text-lg font-semibold text-red-700">Analytics Pro could not be loaded</p>
              <div className="mt-5 flex justify-center gap-3">
                <Button variant="outline" onClick={() => navigate("/analytics")}>Classic Analytics</Button>
                <Button onClick={() => void fetchAnalyticsBundle()}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-vfx-stage min-h-screen bg-[radial-gradient(circle_at_top_left,#eef6ff_0%,transparent_34%),radial-gradient(circle_at_top_right,#fff4e6_0%,transparent_24%),linear-gradient(180deg,#f7fbff_0%,#eef4fb_52%,#f6fbff_100%)]">
      <GovHeader />

      <div className="pointer-events-none absolute inset-x-0 top-[86px] -z-10 h-[760px] overflow-hidden">
        <div className="analytics-orb analytics-orb--blue left-[-8%] top-8 h-80 w-80" />
        <div className="analytics-orb analytics-orb--gold right-[4%] top-16 h-72 w-72" />
        <div className="analytics-orb analytics-orb--teal left-[32%] top-[280px] h-64 w-64" />
      </div>

      <div className="sticky top-[86px] z-40 border-b border-white/70 bg-white/68 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.38)] backdrop-blur-xl">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate(goBack)} className="border-white/75 bg-white/82 shadow-sm backdrop-blur">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button variant="outline" onClick={() => navigate("/analytics")} className="border-white/75 bg-white/82 shadow-sm backdrop-blur">
              <BarChart3 className="mr-2 h-4 w-4" />
              Classic Analytics
            </Button>
            <Button className="bg-[linear-gradient(135deg,#163a70_0%,#2b5c8f_100%)] text-white shadow-[0_18px_36px_-24px_rgba(22,58,112,0.82)] hover:opacity-95">
              <Sparkles className="mr-2 h-4 w-4" />
              Analytics Pro
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <Badge variant="outline" className="analytics-chip border-white/80 bg-white/70 px-3 py-1 text-slate-700">
              {timelinessData.scope.scopeLabel}
            </Badge>
            <span>Operational counts and charts can open matching submissions.</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto space-y-7 px-4 py-6">
        <Card className="analytics-liquid-panel analytics-sheen overflow-hidden border border-white/60 bg-white/20 shadow-[0_34px_95px_-52px_rgba(15,23,42,0.56)] backdrop-blur-xl">
          <div className="bg-[linear-gradient(135deg,rgba(10,33,71,0.98)_0%,rgba(22,58,112,0.96)_48%,rgba(31,138,112,0.9)_100%)] px-6 py-6 text-white">
            <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-white/20 bg-white/10 text-white">Accident Intelligence Mode</Badge>
                  <Badge variant="outline" className="border-white/25 text-white">{timelinessData.scope.scopeLabel}</Badge>
                  <Badge variant="outline" className="border-white/25 text-white">{timelinessData.scope.rangeStart} to {timelinessData.scope.rangeEnd}</Badge>
                </div>

                <div>
                  <h1 className="analytics-display-font text-4xl font-bold tracking-tight xl:text-[3.6rem]">Analytics Pro Command Center</h1>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200">
                    A premium command view for ADGP, DGP, PRISM, and DIG review that connects crash outcomes, hotspot pressure, systemic road risk, operational delays, data quality, and AI-assisted briefing in one polished workspace.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="analytics-liquid-panel rounded-[24px] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">Top Hotspot</p>
                    <p className="mt-2 text-base font-semibold text-white">{topHotspot ? `${topHotspot.place}, ${topHotspot.district}` : "Not available"}</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {topHotspot ? `${compact(topHotspot.accidents)} crashes and ${topHotspot.riskScore} risk score` : "No hotspot record available"}
                    </p>
                  </div>
                  <div className="analytics-liquid-panel rounded-[24px] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">Highest Severity Road</p>
                    <p className="mt-2 text-base font-semibold text-white">{topRoadBySeverity?.roadType || "Not available"}</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {topRoadBySeverity ? `${topRoadBySeverity.severityIndex.toFixed(2)} severity index` : "No road-type pattern available"}
                    </p>
                  </div>
                  <div className="analytics-liquid-panel rounded-[24px] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">Peak Risk Window</p>
                    <p className="mt-2 text-base font-semibold text-white">{peakTimeBucket?.label || "Not available"}</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {peakTimeBucket ? `${compact(peakTimeBucket.accidents)} crashes in this DSR bucket` : "No time pattern available"}
                    </p>
                  </div>
                  <div className="analytics-liquid-panel rounded-[24px] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">Dominant Cause Group</p>
                    <p className="mt-2 text-base font-semibold text-white">{topCauseCategory?.category || "Not available"}</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {topCauseCategory ? `${compact(topCauseCategory.count)} recorded mentions` : "No cause distribution available"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="analytics-liquid-panel rounded-[32px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Filter Window</p>
                    <p className="mt-1 text-xs text-slate-200">Control the analytics scope and submission monitoring range.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => void fetchAnalyticsBundle()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-200">District</Label>
                    <Select
                      value={isAdmin ? filters.district : timelinessData.scope.district || profile?.district || "all"}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, district: value }))}
                      disabled={!isAdmin}
                    >
                      <SelectTrigger className="h-11 border-white/20 bg-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Districts</SelectItem>
                        {AP_DISTRICTS.map((district) => (
                          <SelectItem key={district} value={district}>{district}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-200">Year</Label>
                    <Select
                      value={filters.year}
                      onValueChange={(value) => setFilters((prev) => ({ ...prev, year: value }))}
                      disabled={hasCustomDateRange}
                    >
                      <SelectTrigger className="h-11 border-white/20 bg-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year}>{year}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-200">From Date</Label>
                    <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-11 w-full justify-start border-white/20 bg-white/10 px-3 text-left font-normal text-white hover:bg-white/20">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.fromDate ? formatDateLabel(filters.fromDate) : "Select From Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseIsoDate(filters.fromDate)}
                          onSelect={(selectedDate) => {
                            const nextValue = toIsoDate(selectedDate);
                            setFilters((prev) => ({
                              ...prev,
                              fromDate: nextValue,
                              toDate: prev.toDate && nextValue && prev.toDate < nextValue ? "" : prev.toDate,
                            }));
                            if (selectedDate) setFromDateOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-200">To Date</Label>
                    <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-11 w-full justify-start border-white/20 bg-white/10 px-3 text-left font-normal text-white hover:bg-white/20">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.toDate ? formatDateLabel(filters.toDate) : "Select To Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={parseIsoDate(filters.toDate)}
                          onSelect={(selectedDate) => {
                            setFilters((prev) => ({ ...prev, toDate: toIsoDate(selectedDate) }));
                            if (selectedDate) setToDateOpen(false);
                          }}
                          disabled={(date) => Boolean(filters.fromDate) && date < (parseIsoDate(filters.fromDate) || date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={applyFilters} className="bg-white text-[#163a70] hover:bg-slate-100">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Apply Filters
                  </Button>
                  {(filters.fromDate || filters.toDate) && (
                    <Button
                      variant="outline"
                      className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => setFilters((prev) => ({ ...prev, year: currentYear, fromDate: "", toDate: "" }))}
                    >
                      Clear Dates
                    </Button>
                  )}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="analytics-liquid-panel rounded-[24px] border border-white/15 bg-white/10 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">Scope View</p>
                    <p className="mt-2 text-lg font-semibold text-white">{timelinessData.scope.viewLevel === "state" ? "State Command" : "District Command"}</p>
                    <p className="mt-1 text-sm text-slate-200">Comparison layer: {enhancedData.scope.comparisonLabel}</p>
                  </div>
                  <div className="analytics-liquid-panel rounded-[24px] border border-white/15 bg-white/10 px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">Top 5 Hotspot Share</p>
                    <p className="mt-2 text-lg font-semibold text-white">{formatPercent(topFiveHotspotShare)}</p>
                    <p className="mt-1 text-sm text-slate-200">Share of total crashes carried by the current top 5 hotspots.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <MetricCard
            title="Total Accidents"
            value={compact(riskSummary.totalAccidents)}
            description={`${compact(riskSummary.totalVehicles)} vehicles involved and ${compact(riskSummary.totalDrivers)} driver records in scope.`}
            accent="bg-[linear-gradient(90deg,#163a70_0%,#2b5c8f_100%)]"
            icon={MapPinned}
            onClick={() => openClassicInspector({})}
          />
          <MetricCard
            title="Total Deaths"
            value={compact(riskSummary.totalDeaths)}
            description={`${compact(enhancedData.severityBreakdown.find((item) => item.name === "Fatal")?.count || 0)} fatal crashes recorded in this scope.`}
            accent="bg-[linear-gradient(90deg,#b42318_0%,#d95d39_100%)]"
            icon={TriangleAlert}
            onClick={() => openClassicInspector({ metric: "deaths" })}
          />
          <MetricCard
            title="Total Injuries"
            value={compact(riskSummary.totalInjuries)}
            description={`${compact(enhancedData.severityBreakdown.find((item) => item.name === "Injury")?.count || 0)} injury-linked crashes recorded.`}
            accent="bg-[linear-gradient(90deg,#d97706_0%,#f59e0b_100%)]"
            icon={Users}
            onClick={() => openClassicInspector({ metric: "injuries" })}
          />
          <MetricCard
            title="Fatality Rate"
            value={formatRatioPercent(riskSummary.averageFatalityRate)}
            description={`${riskSummary.averageDeathsPerAccident.toFixed(2)} average deaths per recorded accident.`}
            accent="bg-[linear-gradient(90deg,#7f1d1d_0%,#b91c1c_100%)]"
            icon={ShieldCheck}
          />
          <MetricCard
            title="Timely Submission Rate"
            value={formatPercent(timeSummary.timelyRate)}
            description={`${compact(timeSummary.timelySubmissions)} timely and ${compact(timeSummary.delayedSubmissions)} delayed submissions. Avg lag ${formatLagHours(timeSummary.averageLagHours)}.`}
            accent="bg-[linear-gradient(90deg,#1f8a70_0%,#2ca58d_100%)]"
            icon={Clock3}
            onClick={() => openProInspector({ timelinessStatus: "Timely" })}
          />
          <MetricCard
            title="Signed Copies Uploaded"
            value={compact(timeSummary.signedCopyUploaded)}
            description={`${formatPercent(riskSummary.totalAccidents > 0 ? (timeSummary.signedCopyUploaded / riskSummary.totalAccidents) * 100 : 0)} coverage with ${compact(timeSummary.signedCopyPending)} pending records.`}
            accent="bg-[linear-gradient(90deg,#0f766e_0%,#14b8a6_100%)]"
            icon={FileCheck}
            onClick={() => openProInspector({ signedCopyStatus: "Uploaded" })}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <Card className="analytics-liquid-panel analytics-elevate analytics-sheen overflow-hidden border border-white/75 bg-white/78 shadow-[0_28px_80px_-44px_rgba(15,23,42,0.46)] backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="analytics-display-font text-xl">Leadership Signal Deck</CardTitle>
              <CardDescription>Six high-signal readings that compress crash intensity, operational friction, and data readiness into one review strip.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {leadershipSignals.map((signal) => (
                <div key={signal.label} className="analytics-elevate rounded-[24px] border border-white/80 bg-white/82 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.32)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{signal.label}</p>
                  <p className="analytics-display-font mt-3 text-2xl font-semibold text-slate-900">{signal.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{signal.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="analytics-liquid-panel analytics-elevate analytics-sheen overflow-hidden border border-white/75 bg-white/78 shadow-[0_28px_80px_-44px_rgba(15,23,42,0.46)] backdrop-blur">
            <CardHeader className="pb-3">
              <CardTitle className="analytics-display-font text-xl">Risk-to-Response Matrix</CardTitle>
              <CardDescription>Joins road severity with submission timeliness so leadership can see where network risk and operational drag intersect.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {roadResponseMatrix.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 px-4 py-5 text-sm text-slate-500">
                  No joined road-risk and response data is available for the current selection.
                </div>
              ) : (
                roadResponseMatrix.map((item) => (
                  <div key={item.roadType} className="analytics-elevate rounded-[24px] border border-white/80 bg-white/84 p-4 shadow-[0_20px_55px_-40px_rgba(15,23,42,0.32)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-900">{item.roadType}</p>
                        <p className="mt-1 text-sm text-slate-600">{compact(item.accidents)} crashes with average lag {formatLagHours(item.averageLagHours)}</p>
                      </div>
                      <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                        Severity {item.severityIndex.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[18px] bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Timely Rate</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{formatPercent(item.timelyRate)}</p>
                      </div>
                      <div className="rounded-[18px] bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pending Signed</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">{compact(item.signedCopyPending)}</p>
                      </div>
                      <div className="rounded-[18px] bg-slate-50 px-3 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Action Cue</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">
                          {item.timelyRate < 70 ? "Escalate supervision" : item.severityIndex > 1 ? "Prioritise corridor fixes" : "Maintain watch"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="analytics-liquid-panel analytics-elevate analytics-sheen overflow-hidden border border-white/75 bg-white/78 shadow-[0_30px_84px_-44px_rgba(15,23,42,0.46)] backdrop-blur">
          <div className="h-1.5 bg-[linear-gradient(90deg,#163a70_0%,#2b5c8f_38%,#1f8a70_100%)]" />
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="analytics-chip border-white/80 bg-white/70 px-3 py-1 text-slate-700">AI Briefing Studio</Badge>
                  <Badge variant="outline" className="border-slate-300 bg-white/80 text-slate-700">
                    {chatLoading ? "Refreshing context" : `${compact(chatData?.count || 0)} matched submissions`}
                  </Badge>
                </div>
                <CardTitle className="analytics-display-font mt-4 text-2xl text-slate-900">Conversation Studio</CardTitle>
                <CardDescription className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Switch AI context instantly between hotspot clusters, fatal cases, delayed submissions, high-severity roads, peak risk windows, and the watchlist unit. The conversation panel then auto-builds a briefing from those submissions.
                </CardDescription>
              </div>
              <div className="rounded-[22px] border border-white/80 bg-white/82 px-4 py-3 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.26)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Active Context</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{selectedChatScope?.label || "AI Studio"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{selectedChatScope?.badge}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {chatScopes.map((scope) => {
                const isActive = selectedChatScope?.key === scope.key;
                return (
                  <button
                    key={scope.key}
                    type="button"
                    onClick={() => setChatScope(scope.key)}
                    className={cn(
                      "analytics-elevate rounded-[24px] border px-4 py-4 text-left shadow-[0_20px_55px_-40px_rgba(15,23,42,0.3)] transition-all",
                      isActive
                        ? "border-[#163a70]/30 bg-[linear-gradient(135deg,rgba(22,58,112,0.09)_0%,rgba(31,138,112,0.08)_100%)]"
                        : "border-white/80 bg-white/82"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{scope.label}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{scope.description}</p>
                      </div>
                      <Badge variant="outline" className={cn("border-slate-300 bg-white text-slate-700", isActive && "border-[#163a70]/30 text-[#163a70]")}>
                        {compact(scope.count)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-600">{scope.helper}</p>
                  </button>
                );
              })}
            </div>

            <div className="rounded-[28px] border border-white/80 bg-white/84 p-5 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.3)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Briefing Prompt</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{selectedChatScope?.label || "AI Studio"}</p>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{selectedChatScope?.helper}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {chatData?.scope.scopeLabel && (
                    <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">{chatData.scope.scopeLabel}</Badge>
                  )}
                  {selectedChatScope?.badge && (
                    <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">{selectedChatScope.badge}</Badge>
                  )}
                </div>
              </div>
              {chatData?.submissions.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {chatData.submissions.slice(0, 4).map((submission) => (
                    <Badge key={submission.id} variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                      {submission.firNumber} - {submission.placeOfAccident}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {chatError || selectedChatScope?.emptyMessage || "No AI context is available for this selection."}
                </p>
              )}
            </div>

            {chatError && (
              <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {chatError}
              </div>
            )}

            {chatLoading && (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Preparing AI context for the selected briefing mode...
              </div>
            )}

            <AccidentChat
              isOpen={!chatLoading}
              variant="panel"
              title={selectedChatScope ? `${selectedChatScope.label} AI Briefing` : "AI Briefing"}
              submissions={chatLoading ? [] : chatSubmissions}
              className="min-h-[780px] border-white/70 bg-white/65"
            />
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-4">
          <Card className="analytics-liquid-panel analytics-elevate overflow-hidden border border-white/75 bg-white/78 shadow-[0_28px_80px_-44px_rgba(15,23,42,0.46)] backdrop-blur xl:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Executive Pulse</CardTitle>
              <CardDescription>Immediate command indicators from the current selection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[24px] border border-white/80 bg-white p-4 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.3)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Most Exposed Road Type</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{enhancedData.roadTypeInsights.highestVolume?.roadType || "Not available"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {enhancedData.roadTypeInsights.highestVolume ? `${formatPercent(enhancedData.roadTypeInsights.highestVolume.accidentShare)} of crashes in scope` : "No road share available"}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white p-4 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.3)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Most Active Comparison Unit</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{topComparison?.name || "Not available"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {topComparison ? `${compact(topComparison.accidents)} crashes and ${formatPercent(topComparison.fatalityRate)}` : "No comparison record"}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white p-4 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.3)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Most Involved Vehicle Type</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{topVehicleType?.type || "Not available"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {topVehicleType ? `${compact(topVehicleType.count)} records with ${compact(topVehicleType.deaths)} deaths` : "No vehicle mix available"}
                </p>
              </div>
              <div className="rounded-[24px] border border-white/80 bg-white p-4 shadow-[0_20px_55px_-42px_rgba(15,23,42,0.3)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Documentation Coverage</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{formatPercent(documentationCoverage)}</p>
                <p className="mt-1 text-sm text-slate-600">Average of geo-tagging, vehicle, driver, cause, and engineering coverage.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="analytics-liquid-panel analytics-elevate overflow-hidden border border-white/75 bg-white/78 shadow-[0_28px_80px_-44px_rgba(15,23,42,0.46)] backdrop-blur xl:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Analytics Pro Workspace</CardTitle>
              <CardDescription>Switch between network risk, operations, cause intelligence, and data quality views.</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Tabs defaultValue="overview" className="w-full">
                <div className="px-6 pb-2">
                  <TabsList className="grid h-auto w-full grid-cols-2 rounded-[20px] border border-white/75 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.88)_100%)] p-1 md:grid-cols-4">
                    <TabsTrigger value="overview" className="rounded-[16px] py-2.5">Network Risk</TabsTrigger>
                    <TabsTrigger value="operations" className="rounded-[16px] py-2.5">Operations</TabsTrigger>
                    <TabsTrigger value="causes" className="rounded-[16px] py-2.5">Causes</TabsTrigger>
                    <TabsTrigger value="quality" className="rounded-[16px] py-2.5">Quality</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview" className="mt-0 space-y-5 px-6 pb-6">
                  <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Accident Trend and Casualty Load</CardTitle>
                        <CardDescription>Monthly crash volume with deaths and injuries for the selected scope.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                          <ComposedChart data={enhancedData.trendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="month" stroke="#64748b" />
                            <YAxis stroke="#64748b" allowDecimals={false} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar
                              dataKey="accidents"
                              fill={CHART_COLORS.accidents}
                              name="Accidents"
                              radius={[8, 8, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ month?: string }>(entry);
                                if (!payload?.month) return;
                                openClassicInspector({ month: payload.month });
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="deaths"
                              stroke={CHART_COLORS.deaths}
                              strokeWidth={3}
                              name="Deaths"
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ month?: string }>(entry);
                                if (!payload?.month) return;
                                openClassicInspector({ month: payload.month, metric: "deaths" });
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="injuries"
                              stroke={CHART_COLORS.injuries}
                              strokeWidth={3}
                              name="Injuries"
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ month?: string }>(entry);
                                if (!payload?.month) return;
                                openClassicInspector({ month: payload.month, metric: "injuries" });
                              }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Severity and Day/Night Split</CardTitle>
                        <CardDescription>Crash consequence mix with operating-time split.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={enhancedData.severityBreakdown}
                              dataKey="count"
                              nameKey="name"
                              outerRadius={88}
                              innerRadius={52}
                              onClick={(entry) => {
                                const payload = getChartPayload<{ name?: string }>(entry);
                                if (!payload?.name) return;
                                openClassicInspector({ severity: payload.name });
                              }}
                            >
                              {enhancedData.severityBreakdown.map((item, index) => (
                                <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>

                        <div className="grid gap-3 sm:grid-cols-2">
                          {dayNightSplit.map((item) => (
                            <div key={item.label} className="rounded-[24px] border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                                <Badge variant="outline" className="border-slate-300 text-slate-700">
                                  {formatPercent(riskSummary.totalAccidents > 0 ? (item.accidents / riskSummary.totalAccidents) * 100 : 0)}
                                </Badge>
                              </div>
                              <p className="mt-3 text-2xl font-bold text-slate-900">{compact(item.accidents)}</p>
                              <p className="mt-1 text-sm text-slate-600">{compact(item.deaths)} deaths and {compact(item.injuries)} injuries</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">DSR Time Buckets</CardTitle>
                        <CardDescription>Eight operational time windows aligned to road-safety review practice.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                          <BarChart data={timeBucketAnalysis}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" stroke="#64748b" angle={-18} textAnchor="end" height={84} />
                            <YAxis stroke="#64748b" allowDecimals={false} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar
                              dataKey="accidents"
                              fill={CHART_COLORS.accidents}
                              name="Accidents"
                              radius={[8, 8, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ label?: string }>(entry);
                                if (!payload?.label) return;
                                openClassicInspector({ timeBucket: payload.label });
                              }}
                            />
                            <Bar
                              dataKey="deaths"
                              fill={CHART_COLORS.deaths}
                              name="Deaths"
                              radius={[8, 8, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ label?: string }>(entry);
                                if (!payload?.label) return;
                                openClassicInspector({ timeBucket: payload.label, metric: "deaths" });
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Road-Type Severity Ladder</CardTitle>
                        <CardDescription>Where exposure is highest and where each crash is most severe.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                          <ComposedChart data={enhancedData.roadTypeAnalysis.slice(0, 6)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="roadType" stroke="#64748b" />
                            <YAxis yAxisId="left" stroke="#64748b" allowDecimals={false} />
                            <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                            <RechartsTooltip />
                            <Legend />
                            <Bar
                              yAxisId="left"
                              dataKey="accidents"
                              fill={CHART_COLORS.accidents}
                              name="Accidents"
                              radius={[8, 8, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ roadType?: string }>(entry);
                                if (!payload?.roadType) return;
                                openClassicInspector({ roadType: payload.roadType });
                              }}
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="severityIndex"
                              stroke={CHART_COLORS.severity}
                              strokeWidth={3}
                              name="Severity Index"
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ roadType?: string }>(entry);
                                if (!payload?.roadType) return;
                                openClassicInspector({ roadType: payload.roadType });
                              }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {enhancedData.roadTypeAnalysis.slice(0, 4).map((item) => (
                            <div key={item.roadType} className="rounded-[24px] border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-slate-900">{item.roadType}</p>
                                <Badge variant="outline" className="border-slate-300 text-slate-700">{formatPercent(item.accidentShare)}</Badge>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">
                                {formatPercent(item.fatalityRate)} fatality rate and {item.casualtiesPerAccident.toFixed(2)} casualties per crash
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Top Hotspots</CardTitle>
                        <CardDescription>High-risk places ranked by combined volume and casualty severity.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {enhancedData.hotspotsLocations.slice(0, 8).map((hotspot) => (
                          <div key={`${hotspot.place}-${hotspot.district}`} className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{hotspot.place}</p>
                                  <Badge className={severityClasses[hotspot.severity] || "border-slate-200 bg-slate-50 text-slate-700"}>
                                    {hotspot.severity}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">{hotspot.district}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <CountBadgeButton
                                  value={hotspot.accidents}
                                  variant="outline"
                                  className="border-slate-300 bg-white text-slate-800"
                                  onClick={() => openClassicInspector({ hotspotPlace: hotspot.place, hotspotDistrict: hotspot.district })}
                                />
                                <CountBadgeButton
                                  value={hotspot.deaths}
                                  variant="outline"
                                  className="border-red-200 bg-red-50 text-red-700"
                                  onClick={() => openClassicInspector({ hotspotPlace: hotspot.place, hotspotDistrict: hotspot.district, metric: "deaths" })}
                                />
                                <Badge variant="outline" className="border-slate-300 text-slate-700">
                                  Risk {hotspot.riskScore}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">{enhancedData.scope.comparisonLabel} Risk Ranking</CardTitle>
                        <CardDescription>Priority units based on crash volume and casualty burden in the current scope.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {enhancedData.comparisonData.slice(0, 8).map((item) => (
                          <div key={item.name} className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                                  <Badge className={severityClasses[item.severity] || "border-slate-200 bg-slate-50 text-slate-700"}>
                                    {item.severity}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">{formatPercent(item.fatalityRate)} fatality rate</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <CountBadgeButton
                                  value={item.accidents}
                                  variant="outline"
                                  className="border-slate-300 bg-white text-slate-800"
                                  onClick={() => openClassicInspector({ comparisonName: item.name })}
                                />
                                <CountBadgeButton
                                  value={item.deaths}
                                  variant="outline"
                                  className="border-red-200 bg-red-50 text-red-700"
                                  onClick={() => openClassicInspector({ comparisonName: item.name, metric: "deaths" })}
                                />
                                <CountBadgeButton
                                  value={item.injuries}
                                  variant="outline"
                                  className="border-amber-200 bg-amber-50 text-amber-700"
                                  onClick={() => openClassicInspector({ comparisonName: item.name, metric: "injuries" })}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="operations" className="mt-0 space-y-5 px-6 pb-6">
                  <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">{rankingTitle}</CardTitle>
                        <CardDescription>{rankingDescription}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {rankingRows.slice(0, 10).map((row) => (
                          <div key={row.name} className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                                  <Badge variant="outline" className="border-slate-300 text-slate-700">{formatPercent(row.timelyRate)}</Badge>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  {compact(row.deaths)} deaths and {compact(row.injuries)} injuries with {formatLagHours(row.averageLagHours)} average lag
                                </p>
                                <div className="mt-3 h-2.5 rounded-full bg-slate-100">
                                  <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,#1f8a70_0%,#2ca58d_100%)]" style={{ width: `${Math.max(6, row.timelyRate)}%` }} />
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <CountBadgeButton
                                  value={row.totalSubmissions}
                                  variant="outline"
                                  className="border-slate-300 bg-white text-slate-800"
                                  onClick={() =>
                                    openProInspector(
                                      timelinessData.scope.viewLevel === "state" ? { submissionDistrict: row.name } : { policeStation: row.name }
                                    )
                                  }
                                />
                                <CountBadgeButton
                                  value={row.timelySubmissions}
                                  variant="outline"
                                  className="border-emerald-200 bg-emerald-50 text-emerald-700"
                                  onClick={() =>
                                    openProInspector(
                                      timelinessData.scope.viewLevel === "state"
                                        ? { submissionDistrict: row.name, timelinessStatus: "Timely" }
                                        : { policeStation: row.name, timelinessStatus: "Timely" }
                                    )
                                  }
                                />
                                <CountBadgeButton
                                  value={row.delayedSubmissions}
                                  variant="outline"
                                  className="border-rose-200 bg-rose-50 text-rose-700"
                                  onClick={() =>
                                    openProInspector(
                                      timelinessData.scope.viewLevel === "state"
                                        ? { submissionDistrict: row.name, timelinessStatus: "Delayed" }
                                        : { policeStation: row.name, timelinessStatus: "Delayed" }
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Submission Cadence</CardTitle>
                        <CardDescription>Monthly creation trend split into timely and delayed submissions.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={320}>
                          <AreaChart data={timelinessData.submissionCadence}>
                            <defs>
                              <linearGradient id="timelyFillPro" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.timely} stopOpacity={0.35} />
                                <stop offset="95%" stopColor={CHART_COLORS.timely} stopOpacity={0.05} />
                              </linearGradient>
                              <linearGradient id="delayedFillPro" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.delayed} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={CHART_COLORS.delayed} stopOpacity={0.04} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" stroke="#64748b" />
                            <YAxis stroke="#64748b" allowDecimals={false} />
                            <RechartsTooltip />
                            <Legend />
                            <Area type="monotone" dataKey="timely" stroke={CHART_COLORS.timely} fill="url(#timelyFillPro)" strokeWidth={2.5} name="Timely" />
                            <Area type="monotone" dataKey="delayed" stroke={CHART_COLORS.delayed} fill="url(#delayedFillPro)" strokeWidth={2.5} name="Delayed" />
                          </AreaChart>
                        </ResponsiveContainer>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {timelinessData.submissionCadence.map((bucket) => (
                            <Button key={bucket.key} size="sm" variant="outline" className="rounded-full border-slate-300 bg-white text-slate-700" onClick={() => openProInspector({ createdMonth: bucket.key })}>
                              {bucket.label}: {compact(bucket.total)}
                            </Button>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Delay Bands</CardTitle>
                        <CardDescription>Where the current submission backlog is sitting across delay windows.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={timelinessData.delayBands} layout="vertical" margin={{ left: 12 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" stroke="#64748b" allowDecimals={false} />
                            <YAxis dataKey="band" type="category" width={130} stroke="#64748b" />
                            <RechartsTooltip />
                            <Bar
                              dataKey="count"
                              fill={CHART_COLORS.delayed}
                              radius={[0, 12, 12, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ band?: string }>(entry);
                                if (!payload?.band) return;
                                openProInspector({ delayBand: payload.band });
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Road-Type Submission Timeliness</CardTitle>
                        <CardDescription>Road categories where reporting discipline is strongest or slipping.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={timelinessData.roadTimeliness.slice(0, 6)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" />
                            <YAxis stroke="#64748b" allowDecimals={false} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar
                              dataKey="timelySubmissions"
                              fill={CHART_COLORS.timely}
                              name="Timely"
                              radius={[6, 6, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ name?: string }>(entry);
                                if (!payload?.name) return;
                                openProInspector({ roadType: payload.name, timelinessStatus: "Timely" });
                              }}
                            />
                            <Bar
                              dataKey="delayedSubmissions"
                              fill={CHART_COLORS.delayed}
                              name="Delayed"
                              radius={[6, 6, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ name?: string }>(entry);
                                if (!payload?.name) return;
                                openProInspector({ roadType: payload.name, timelinessStatus: "Delayed" });
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Weekday Submission Rhythm</CardTitle>
                        <CardDescription>Operational flow of timely and delayed submissions across the week.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={timelinessData.weekdayPattern}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="day" stroke="#64748b" />
                            <YAxis stroke="#64748b" allowDecimals={false} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar
                              dataKey="timely"
                              fill={CHART_COLORS.timely}
                              name="Timely"
                              radius={[6, 6, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ day?: string }>(entry);
                                if (!payload?.day) return;
                                openProInspector({ createdWeekday: payload.day, timelinessStatus: "Timely" });
                              }}
                            />
                            <Bar
                              dataKey="delayed"
                              fill={CHART_COLORS.delayed}
                              name="Delayed"
                              radius={[6, 6, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ day?: string }>(entry);
                                if (!payload?.day) return;
                                openProInspector({ createdWeekday: payload.day, timelinessStatus: "Delayed" });
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Late Submission Watchlist</CardTitle>
                        <CardDescription>Most delayed records ready for immediate review.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {timelinessData.recentLateSubmissions.length === 0 && (
                          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-14 text-center text-slate-500">
                            No delayed submissions are present in the current selection.
                          </div>
                        )}

                        {timelinessData.recentLateSubmissions.map((submission) => (
                          <div key={submission.id} className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{submission.firNumber}</p>
                                  <Badge className="border-rose-200 bg-rose-50 text-rose-700">{submission.delayBand}</Badge>
                                  <Badge variant="outline" className="border-slate-300 text-slate-700">{submission.district}</Badge>
                                </div>
                                <p className="mt-2 text-sm text-slate-600">{submission.placeOfAccident}, {submission.policeStation}</p>
                                <p className="mt-1 text-xs text-slate-500">{submission.createdAt ? formatDateLabel(submission.createdAt.slice(0, 10)) : ""}</p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-slate-300 text-slate-700">{formatLagHours(submission.lagHours)}</Badge>
                                <Button size="sm" variant="outline" onClick={() => openProInspector({ submissionDistrict: submission.district, timelinessStatus: "Delayed" })}>
                                  View Related
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="causes" className="mt-0 space-y-5 px-6 pb-6">
                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Driver-Related Causes</CardTitle>
                        <CardDescription>Most frequent driver-side contributors across the selected submissions.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {enhancedData.driverCauses.slice(0, 8).map((entry, index) => (
                          <div key={entry.cause} className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">{index + 1}. {formatCauseLabel(entry.cause)}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{entry.cause}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0 rounded-full border-slate-300 px-3 text-[#163a70]"
                                onClick={() => openClassicInspector({ driverCause: entry.cause })}
                              >
                                {compact(entry.count)}
                              </Button>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-slate-100">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${Math.max(entry.percentage, 8)}%`,
                                  backgroundColor:
                                    entry.severity === "high"
                                      ? "#aa3d47"
                                      : entry.severity === "medium"
                                        ? "#c75b12"
                                        : "#d39d11",
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Vehicle Condition Issues</CardTitle>
                        <CardDescription>Mechanical or fitness factors captured by field officers.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={360}>
                          <BarChart data={enhancedData.vehicleCauses.slice(0, 8)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="cause" stroke="#64748b" angle={-18} textAnchor="end" height={92} tickFormatter={(value) => formatCauseLabel(String(value), 24)} />
                            <YAxis stroke="#64748b" allowDecimals={false} />
                            <RechartsTooltip formatter={(value: number, _name, props: { payload?: { cause?: string } }) => [value, props?.payload?.cause || "Cause"]} />
                            <Bar
                              dataKey="count"
                              fill="#267fa3"
                              radius={[8, 8, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ cause?: string }>(entry);
                                if (!payload?.cause) return;
                                openClassicInspector({ vehicleCause: payload.cause });
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Engineering and Road Environment Factors</CardTitle>
                        <CardDescription>Category-wise road and junction deficiencies referenced in submissions.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {enhancedData.roadEngineeringCauses.map((group) => (
                          <div key={group.category} className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h3 className="font-semibold text-slate-900">{group.category}</h3>
                              <Badge variant="outline" className="border-slate-300 text-slate-700">{group.totalIncidents} mentions</Badge>
                            </div>
                            <div className="space-y-3">
                              {group.causes.map((cause) => (
                                <div key={cause.name}>
                                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                                    <span className="text-slate-700">{cause.name}</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-auto px-0 py-0 font-medium text-[#163a70] hover:bg-transparent"
                                      onClick={() =>
                                        openClassicInspector({
                                          roadEngineeringCategory: group.category,
                                          roadEngineeringCause: cause.name,
                                        })
                                      }
                                    >
                                      {compact(cause.count)}
                                    </Button>
                                  </div>
                                  <div className="h-2 rounded-full bg-slate-100">
                                    <div className="h-2 rounded-full bg-[#163a70]" style={{ width: `${Math.min(cause.percentage, 100)}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Vehicle Mix in Crashes</CardTitle>
                        <CardDescription>Vehicle categories most frequently involved in reported cases.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={380}>
                          <BarChart data={enhancedData.vehicleAnalysis.slice(0, 8)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="type" stroke="#64748b" angle={-15} textAnchor="end" height={84} />
                            <YAxis stroke="#64748b" allowDecimals={false} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar
                              dataKey="count"
                              fill={CHART_COLORS.accidents}
                              name="Vehicles"
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ type?: string }>(entry);
                                if (!payload?.type) return;
                                openClassicInspector({ vehicleType: payload.type });
                              }}
                            />
                            <Bar
                              dataKey="deaths"
                              fill={CHART_COLORS.deaths}
                              name="Deaths"
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ type?: string }>(entry);
                                if (!payload?.type) return;
                                openClassicInspector({ vehicleType: payload.type, metric: "deaths" });
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="quality" className="mt-0 space-y-5 px-6 pb-6">
                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Field Completeness Coverage</CardTitle>
                        <CardDescription>How consistently officers are capturing the critical submission details.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[gpsCoverage, vehicleCoverage, driverCoverage, driverCauseCoverage, vehicleCauseCoverage, roadCoverage].map((item) => (
                          <div key={item.field} className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{item.field}</p>
                                <p className="mt-1 text-xs text-slate-500">{compact(item.available)} available and {compact(item.missing)} missing</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  item.coverage >= 80
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : item.coverage >= 55
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
                                      : "border-rose-200 bg-rose-50 text-rose-700"
                                )}
                              >
                                {formatPercent(item.coverage)}
                              </Badge>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-slate-100">
                              <div className="h-2 rounded-full bg-[linear-gradient(90deg,#163a70_0%,#2b5c8f_100%)]" style={{ width: `${Math.max(item.coverage, 5)}%` }} />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Police Station Load and Weekly Crash Rhythm</CardTitle>
                        <CardDescription>Operational stress signals by station and by weekday.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={enhancedData.policeStationAnalysis.slice(0, 6)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" stroke="#64748b" angle={-16} textAnchor="end" height={82} />
                            <YAxis stroke="#64748b" allowDecimals={false} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar
                              dataKey="accidents"
                              fill={CHART_COLORS.accidents}
                              name="Accidents"
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ name?: string }>(entry);
                                if (!payload?.name) return;
                                openClassicInspector({ policeStation: payload.name });
                              }}
                            />
                            <Bar
                              dataKey="deaths"
                              fill={CHART_COLORS.deaths}
                              name="Deaths"
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ name?: string }>(entry);
                                if (!payload?.name) return;
                                openClassicInspector({ policeStation: payload.name, metric: "deaths" });
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>

                        <ResponsiveContainer width="100%" height={220}>
                          <ComposedChart data={enhancedData.dayOfWeekAnalysis}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="day" stroke="#64748b" />
                            <YAxis stroke="#64748b" allowDecimals={false} />
                            <RechartsTooltip />
                            <Legend />
                            <Bar
                              dataKey="accidents"
                              fill="#2b5c8f"
                              name="Accidents"
                              radius={[8, 8, 0, 0]}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ day?: string }>(entry);
                                if (!payload?.day) return;
                                openClassicInspector({ weekday: payload.day });
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="deaths"
                              stroke={CHART_COLORS.deaths}
                              strokeWidth={3}
                              name="Deaths"
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                              onClick={(entry: unknown) => {
                                const payload = getChartPayload<{ day?: string }>(entry);
                                if (!payload?.day) return;
                                openClassicInspector({ weekday: payload.day, metric: "deaths" });
                              }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">AI Analytical Brief</CardTitle>
                        <CardDescription>Supplementary executive summary generated from the current accident pattern.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <p className="text-sm leading-7 text-slate-700">{enhancedData.geminiInsights.overallAssessment}</p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900">Key Findings</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-600">
                              {enhancedData.geminiInsights.keyFindings.slice(0, 4).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <p className="text-sm font-semibold text-slate-900">Recommendations</p>
                            <ul className="mt-3 space-y-2 text-sm text-slate-600">
                              {enhancedData.geminiInsights.recommendations.slice(0, 4).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="analytics-elevate border-white/75 bg-white/86 shadow-[0_26px_72px_-46px_rgba(15,23,42,0.38)]">
                      <CardHeader>
                        <CardTitle className="text-lg">Submission Readiness Snapshot</CardTitle>
                        <CardDescription>Documentation and command-quality indicators for the current scope.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Geo-Tagged Records</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{compact(gpsCoverage.available)}</p>
                            <p className="mt-1 text-sm text-slate-600">{formatPercent(gpsCoverage.coverage)} of all crashes in scope.</p>
                          </div>
                          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Active Stations</p>
                            <p className="mt-2 text-2xl font-bold text-slate-900">{compact(timeSummary.activeStations)}</p>
                            <p className="mt-1 text-sm text-slate-600">{compact(timeSummary.districtsCovered)} districts contributing data.</p>
                          </div>
                          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Peak Submission Unit</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">{topPerformer?.name || "Not available"}</p>
                            <p className="mt-1 text-sm text-slate-600">{topPerformer ? `${formatPercent(topPerformer.timelyRate)} timely rate` : "No ranking row available"}</p>
                          </div>
                          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Watchlist Unit</p>
                            <p className="mt-2 text-lg font-semibold text-slate-900">{watchlistPerformer?.name || "Not available"}</p>
                            <p className="mt-1 text-sm text-slate-600">{watchlistPerformer ? `${formatPercent(watchlistPerformer.timelyRate)} timely rate` : "No watchlist row available"}</p>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Dominant Cause Categories</p>
                              <p className="mt-1 text-xs text-slate-500">Combined reading of driver, vehicle, and infrastructure-related signals.</p>
                            </div>
                            <Badge variant="outline" className="border-slate-300 text-slate-700">{causeCategoryMix.length} active categories</Badge>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            {causeCategoryMix.slice(0, 3).map((item) => (
                              <div key={item.category} className="rounded-[20px] bg-slate-50 px-4 py-3">
                                <p className="text-sm font-semibold text-slate-900">{item.category}</p>
                                <p className="mt-1 text-sm text-slate-600">{compact(item.count)} mentions</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <AnalyticsSubmissionInspector
          open={inspectorOpen}
          onOpenChange={(nextOpen) => {
            setInspectorOpen(nextOpen);
            if (!nextOpen) setInspectorRequest(null);
          }}
          scopeFilters={scopeFilters}
          drilldownFilters={inspectorRequest?.filters || null}
          mode={inspectorRequest?.mode || "pro"}
        />
      </div>
    </div>
  );
};

export default AnalyticsPro;

