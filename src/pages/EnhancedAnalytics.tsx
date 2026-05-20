import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import GovHeader from "@/components/GovHeader";
import AnalyticsSubmissionInspector, { AnalyticsClassicDrilldownFilters } from "@/components/analytics/AnalyticsSubmissionInspector";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { AP_DISTRICTS } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { AlertTriangle, BarChart3, Brain, Calculator, Calendar as CalendarIcon, Car, ChevronDown, ChevronUp, Clock, FileCheck, Filter, Gauge, Home, RefreshCw, Target, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
  mandalAnalysis: Array<{ name: string; accidents: number; deaths: number; injuries: number }>;
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
    highestVolume: {
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
    } | null;
    highestDeaths: {
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
    } | null;
    highestFatalityRate: {
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
    } | null;
    highestSeverityIndex: {
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
    } | null;
  };
  hotspotsLocations: Array<{ place: string; district: string; accidents: number; deaths: number; injured: number; severity: string; riskScore: number }>;
  driverCauses: Array<{ cause: string; count: number; percentage: number; severity: "high" | "medium" | "low" }>;
  vehicleCauses: Array<{ cause: string; count: number; percentage: number; severity: "high" | "medium" | "low" }>;
  roadEngineeringCauses: Array<{ category: string; causes: Array<{ name: string; count: number; percentage: number }>; totalIncidents: number }>;
  vehicleAnalysis: Array<{ type: string; count: number; deaths: number; injuries: number }>;
  signedCopyAnalysis: Array<{ name: string; count: number }>;
  policeStationAnalysis: Array<{ name: string; accidents: number; deaths: number; injuries: number; fatalityRate: number }>;
  dayOfWeekAnalysis: Array<{ day: string; accidents: number; deaths: number; injuries: number }>;
  severityBreakdown: Array<{ name: string; count: number; percentage: number }>;
  fieldCompleteness: Array<{ field: string; available: number; missing: number; coverage: number }>;
  mapPoints: Array<{ id: string; district: string; place_of_accident: string; lat_long?: string; persons_died: number; persons_injured: number; accident_date: string; accident_time: string; fir_number: string }>;
  geminiInsights: {
    overallAssessment: string;
    keyFindings: string[];
    recommendations: string[];
    predictiveAnalysis: string;
    riskFactors: string[];
  };
}

const CHART_COLORS = ["#163a70", "#c75b12", "#d39d11", "#2a7c4a", "#267fa3", "#7a4cc2", "#aa3d47", "#4f6fad"];

const severityColors: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border-red-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const analyticsFormulaReference = [
  {
    label: "Fatality Rate",
    formula: "(Deaths / (Deaths + Injuries)) x 100",
    note: "Used for summary, road type comparisons, police station comparisons, and trend views.",
  },
  {
    label: "Average Deaths Per Accident",
    formula: "Deaths / Total Accidents",
    note: "Shows the average number of deaths associated with each accident record.",
  },
  {
    label: "Accident Share",
    formula: "(Road Type Accidents / Total Accidents) x 100",
    note: "Shows how much each road category contributes to all accidents in the filtered view.",
  },
  {
    label: "Death Share",
    formula: "(Road Type Deaths / Total Deaths) x 100",
    note: "Shows how much each road category contributes to all reported deaths.",
  },
  {
    label: "Injury Share",
    formula: "(Road Type Injuries / Total Injuries) x 100",
    note: "Shows how much each road category contributes to all reported injuries.",
  },
  {
    label: "Casualties Per Accident",
    formula: "(Deaths + Injuries) / Accidents",
    note: "Measures how many casualties are associated with each accident on average.",
  },
  {
    label: "Severity Index",
    formula: "((Deaths x 2) + Injuries) / Accidents",
    note: "Deaths are given double weight so high-fatality road types stand out more clearly.",
  },
  {
    label: "Risk Score",
    formula: "min(100, (Accidents x 12) + (Deaths x 18) + (Injuries x 5))",
    note: "Used for hotspot ranking. The score is capped at 100.",
  },
  {
    label: "Hotspot Severity Band",
    formula: "Critical: score >= 80 | High: score >= 60 | Medium: score >= 35 | Low: score < 35",
    note: "Converts the hotspot risk score into an operational priority band.",
  },
];

function getChartPayload<T>(entry: T | { payload?: T } | undefined | null): T | null {
  if (!entry) return null;
  if (typeof entry === "object" && entry !== null && "payload" in entry && entry.payload) {
    return entry.payload as T;
  }
  return entry as T;
}

function formatPercent(value: number, divideBy100 = false) {
  const actual = divideBy100 ? value * 100 : value;
  return `${actual.toFixed(1)}%`;
}

function compact(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoToDate(value: string) {
  if (!isIsoDate(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function findRoadTypeEntry(
  roadTypes: EnhancedAnalyticsData["roadTypeAnalysis"],
  roadType: string
) {
  return roadTypes.find((entry) => entry.roadType.toUpperCase() === roadType.toUpperCase()) || null;
}

function parseDateValue(value: string) {
  if (!value) return null;

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const localMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (localMatch) {
    const [, day, month, year] = localMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateLabel(value: string) {
  if (!value) return "";
  const parsed = parseDateValue(value);
  if (!parsed) return value;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function toIsoDate(value: Date | undefined) {
  return value ? format(value, "yyyy-MM-dd") : "";
}

function shortenCauseLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();

  const replacements: Array<[RegExp, string]> = [
    [/The driver was over speeding\.?/i, "Over speeding"],
    [/Driver slept while driving\.?/i, "Driver fatigue or sleep"],
    [/The driver was under the influence of alcohol at the time of accident\.?/i, "Driving under alcohol influence"],
    [/The vehicle was being driven in the wrong direction\.?/i, "Wrong-side driving"],
    [/The vehicle was over loaded with goods ?\/ ?passengers\.?/i, "Vehicle overloading"],
    [/The vehicle is parked wrongly on the road\.?/i, "Wrong parking on roadway"],
    [/The vehicle lights and indicators not working\.?/i, "Lights or indicators not working"],
    [/Driver made an error of judgment during overtaking\.?/i, "Unsafe overtaking judgment"],
    [/The driver made an error of judgment during overtaking\.?/i, "Unsafe overtaking judgment"],
    [/The driver made an error of judgment of the position of the other vehicle\.?/i, "Misjudged position of other vehicle"],
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(normalized)) return replacement;
  }

  return normalized.length > 42 ? `${normalized.slice(0, 39)}...` : normalized;
}

const EnhancedAnalytics = () => {
  const navigate = useNavigate();
  const { user, isAdmin, profile, loading: authLoading } = useAuth();
  const currentYear = new Date().getFullYear().toString();
  const [analyticsData, setAnalyticsData] = useState<EnhancedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [filters, setFilters] = useState({
    district: "all",
    year: currentYear,
    fromDate: "",
    toDate: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    district: "all",
    year: currentYear,
    fromDate: "",
    toDate: "",
  });
  const [showAnalyticalBrief, setShowAnalyticalBrief] = useState(false);
  const [showOperationalSnapshot, setShowOperationalSnapshot] = useState(false);
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorFilters, setInspectorFilters] = useState<AnalyticsClassicDrilldownFilters | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      toast.error("Please login to access analytics");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin && profile?.district) {
      setFilters((prev) => ({ ...prev, district: profile.district }));
      setAppliedFilters((prev) => ({ ...prev, district: profile.district }));
    }
  }, [isAdmin, profile?.district]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchEnhancedAnalytics();
    }
  }, [authLoading, user, appliedFilters, isAdmin, profile?.district]);

  const applyFilters = () => {
    if (filters.fromDate && !isIsoDate(filters.fromDate)) {
      toast.error("From date must be in YYYY-MM-DD format");
      return;
    }
    if (filters.toDate && !isIsoDate(filters.toDate)) {
      toast.error("To date must be in YYYY-MM-DD format");
      return;
    }
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      toast.error("From date cannot be later than To date");
      return;
    }

    setAppliedFilters(filters);
  };

  const fetchEnhancedAnalytics = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const requestedDistrict = isAdmin ? appliedFilters.district : profile?.district || appliedFilters.district;
      const { data, error } = await api.analytics.getEnhancedAnalytics({
        district: requestedDistrict,
        year: appliedFilters.year,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
      });

      if (error) {
        setAnalyticsData(null);
        setLoadError(error);
        toast.error(error);
        return;
      }

      setAnalyticsData(data);
    } catch (error) {
      console.error("Failed to fetch enhanced analytics:", error);
      setAnalyticsData(null);
      setLoadError("Failed to load analytics data");
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const years = useMemo(
    () => Array.from({ length: 6 }, (_, index) => (new Date().getFullYear() - index).toString()),
    []
  );
  const hasCustomDateRange = Boolean(filters.fromDate || filters.toDate);
  const hasValidCustomDateRange = Boolean(
    (appliedFilters.fromDate && parseDateValue(appliedFilters.fromDate)) ||
    (appliedFilters.toDate && parseDateValue(appliedFilters.toDate))
  );
  const dateRangeLabel = hasValidCustomDateRange
    ? appliedFilters.fromDate && appliedFilters.toDate
      ? `${formatDateLabel(appliedFilters.fromDate)} - ${formatDateLabel(appliedFilters.toDate)}`
      : appliedFilters.fromDate
        ? `From ${formatDateLabel(appliedFilters.fromDate)}`
        : `Up to ${formatDateLabel(appliedFilters.toDate)}`
    : null;
  const inspectorScopeFilters = useMemo(
    () => ({
      district: isAdmin ? appliedFilters.district : profile?.district || appliedFilters.district,
      year: appliedFilters.year,
      fromDate: appliedFilters.fromDate || undefined,
      toDate: appliedFilters.toDate || undefined,
    }),
    [appliedFilters.district, appliedFilters.fromDate, appliedFilters.toDate, appliedFilters.year, isAdmin, profile?.district]
  );

  const openClassicDrilldown = (nextFilters: AnalyticsClassicDrilldownFilters = {}) => {
    setInspectorFilters(nextFilters);
    setInspectorOpen(true);
  };
  const getInteractiveCardProps = (nextFilters: AnalyticsClassicDrilldownFilters = {}) => ({
    role: "button" as const,
    tabIndex: 0,
    onClick: () => openClassicDrilldown(nextFilters),
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openClassicDrilldown(nextFilters);
      }
    },
  });

  if (loading || authLoading) {
    return <div className="min-h-screen bg-slate-50"><GovHeader /><div className="container mx-auto px-4 py-10"><Card className="border-slate-200"><CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-3"><RefreshCw className="h-10 w-10 animate-spin text-primary" /><p className="text-lg font-semibold text-slate-800">Loading analytics workspace</p><p className="text-sm text-slate-500">Preparing visual summaries and comparison metrics</p></CardContent></Card></div></div>;
  }

  if (!analyticsData) {
    return <div className="min-h-screen bg-slate-50"><GovHeader /><div className="container mx-auto px-4 py-10"><Card className="border-red-200 bg-red-50"><CardContent className="py-10 text-center"><AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" /><p className="text-lg font-semibold text-red-700">Analytics data could not be loaded</p><p className="mt-2 text-sm text-red-600">{loadError || "Please ensure submissions exist for the selected year and access scope."}</p><div className="mt-6"><Button variant="outline" onClick={() => navigate(isAdmin ? "/admin" : "/dashboard")}>Back</Button></div></CardContent></Card></div></div>;
  }

  const comparisonHeadline = analyticsData.scope.comparisonLabel;
  const topComparison = analyticsData.comparisonData[0];
  const topHotspot = analyticsData.hotspotsLocations[0];
  const topMandal = analyticsData.mandalAnalysis[0];
  const chartComparisonData = analyticsData.comparisonData.slice(0, 10);
  const chartPoliceStations = (analyticsData.policeStationAnalysis || []).slice(0, 10);
  const chartMandals = analyticsData.mandalAnalysis.slice(0, 8);
  const chartHotspots = analyticsData.hotspotsLocations.slice(0, 8);
  const topRoadTypeByVolume = analyticsData.roadTypeInsights.highestVolume;
  const topRoadTypeBySeverity = analyticsData.roadTypeInsights.highestSeverityIndex;
  const topRoadTypeByFatalityRate = analyticsData.roadTypeInsights.highestFatalityRate;
  const nhVsShComparison = ["NH", "SH", "MDR", "Other"].map((roadType) => {
    const entry = findRoadTypeEntry(analyticsData.roadTypeAnalysis, roadType);
    return {
      roadType,
      accidents: entry?.accidents || 0,
      deaths: entry?.deaths || 0,
      injuries: entry?.injuries || 0,
      accidentShare: entry?.accidentShare || 0,
      fatalityRate: entry?.fatalityRate || 0,
      severityIndex: entry?.severityIndex || 0,
      casualtiesPerAccident: entry?.casualtiesPerAccident || 0,
    };
  });
  const roadTypeShareChartData = analyticsData.roadTypeAnalysis.map((item) => ({
    name: item.roadType,
    value: item.accidentShare,
    accidents: item.accidents,
  }));
  const driverCauseChartData = analyticsData.driverCauses.slice(0, 10).map((entry) => ({
    ...entry,
    shortCause: shortenCauseLabel(entry.cause),
  }));
  const vehicleCauseChartData = (analyticsData.vehicleCauses || []).map((entry) => ({
    ...entry,
    shortCause: shortenCauseLabel(entry.cause),
  }));
  const goBack = () => navigate(isAdmin ? "/admin" : "/dashboard");
  const getComparisonFilters = (comparisonName: string, metric?: string): AnalyticsClassicDrilldownFilters => ({
    comparisonName,
    ...(metric ? { metric } : {}),
  });
  const getRoadTypeFilters = (roadType: string, metric?: string): AnalyticsClassicDrilldownFilters => ({
    roadType,
    ...(metric ? { metric } : {}),
  });
  const handleTrendClick = (entry: any, metric?: string) => {
    const payload = getChartPayload<{ month?: string }>(entry);
    if (!payload?.month) return;
    openClassicDrilldown({
      month: payload.month,
      ...(metric ? { metric } : {}),
    });
  };
  const handleHourClick = (entry: any) => {
    const payload = getChartPayload<{ hour?: string }>(entry);
    if (!payload?.hour) return;
    openClassicDrilldown({ hour: payload.hour });
  };
  const handleComparisonChartClick = (entry: any, metric?: string) => {
    const payload = getChartPayload<{ name?: string }>(entry);
    if (!payload?.name) return;
    openClassicDrilldown(getComparisonFilters(payload.name, metric));
  };
  const handleMandalClick = (entry: any, metric?: string) => {
    const payload = getChartPayload<{ name?: string }>(entry);
    if (!payload?.name) return;
    openClassicDrilldown({
      mandal: payload.name,
      ...(metric ? { metric } : {}),
    });
  };
  const handleRoadTypeChartClick = (entry: any, metric?: string) => {
    const payload = getChartPayload<{ roadType?: string; name?: string }>(entry);
    const roadType = payload?.roadType || payload?.name;
    if (!roadType) return;
    openClassicDrilldown(getRoadTypeFilters(roadType, metric));
  };
  const handleHotspotClick = (place: string, districtName: string, metric?: string) => {
    openClassicDrilldown({
      hotspotPlace: place,
      hotspotDistrict: districtName,
      ...(metric ? { metric } : {}),
    });
  };
  const handleCauseClick = (filters: AnalyticsClassicDrilldownFilters) => {
    openClassicDrilldown(filters);
  };
  const handleVehicleMixClick = (entry: any, metric?: string) => {
    const payload = getChartPayload<{ type?: string }>(entry);
    if (!payload?.type) return;
    openClassicDrilldown({
      vehicleType: payload.type,
      ...(metric ? { metric } : {}),
    });
  };
  const handlePoliceStationClick = (entry: any, metric?: string) => {
    const payload = getChartPayload<{ name?: string }>(entry);
    if (!payload?.name) return;
    openClassicDrilldown({
      policeStation: payload.name,
      ...(metric ? { metric } : {}),
    });
  };
  const handleWeekdayClick = (entry: any, metric?: string) => {
    const payload = getChartPayload<{ day?: string }>(entry);
    if (!payload?.day) return;
    openClassicDrilldown({
      weekday: payload.day,
      ...(metric ? { metric } : {}),
    });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fc_0%,#eef3fb_100%)]">
      <GovHeader />

      <div className="sticky top-[86px] z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="bg-white shadow-sm"
            >
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-[#163a70]/20 bg-[#f4f7fb] text-[#163a70] shadow-sm hover:bg-[#e7eef8] hover:text-[#163a70]"
                >
                  <Calculator className="mr-2 h-4 w-4" />
                  Formulas
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto border-slate-200">
                <DialogHeader>
                  <DialogTitle className="text-xl text-slate-900">Analytics Formula Reference</DialogTitle>
                  <DialogDescription className="text-slate-600">
                    These formulas match the metrics currently shown in the analytics dashboard for the selected filters.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  {analyticsFormulaReference.map((item) => (
                    <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <code className="rounded-md bg-white px-3 py-2 font-mono text-sm text-[#163a70]">
                          {item.formula}
                        </code>
                        <p className="text-sm leading-6 text-slate-600">{item.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <p className="hidden text-xs font-medium text-slate-500 sm:block">
            Quick access while reviewing analytics
          </p>
        </div>
      </div>

      <div className="container mx-auto space-y-6 px-4 py-6">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-[#163a70] via-[#2f5d97] to-[#c75b12]" />
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-primary text-white">
                    {analyticsData.scope.viewLevel === "state" ? "State Control View" : "District Control View"}
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 text-slate-700">{analyticsData.scope.scopeLabel}</Badge>
                  <Badge variant="outline" className="border-slate-300 text-slate-700">{analyticsData.scope.year}</Badge>
                  {dateRangeLabel && (
                    <Badge variant="outline" className="border-slate-300 text-slate-700">{dateRangeLabel}</Badge>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900">Road Accident Analytics</h1>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5 xl:gap-6">
                <div className="min-w-[170px]">
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Filter className="mr-1 inline h-3.5 w-3.5" />
                    District
                  </Label>
                  <Select
                    value={isAdmin ? filters.district : analyticsData.scope.district || profile?.district || "all"}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, district: value }))}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="h-11 border-slate-300 bg-slate-50 text-slate-800 shadow-sm transition-colors focus:border-[#163a70] focus:ring-[#163a70]">
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

                <div className="min-w-[140px]">
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <CalendarIcon className="mr-1 inline h-3.5 w-3.5" />
                    Year
                  </Label>
                  <Select
                    value={filters.year}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, year: value }))}
                    disabled={hasCustomDateRange}
                  >
                    <SelectTrigger className="h-11 border-slate-300 bg-slate-50 text-slate-800 shadow-sm transition-colors focus:border-[#163a70] focus:ring-[#163a70]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-[150px]">
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <CalendarIcon className="mr-1 inline h-3.5 w-3.5" />
                    From Date
                  </Label>
                  <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-11 w-full justify-start border-slate-300 bg-slate-50 px-3 text-left font-normal text-slate-800 shadow-sm hover:bg-slate-100"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                        {filters.fromDate ? formatDateLabel(filters.fromDate) : "Select From Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={isoToDate(filters.fromDate)}
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

                <div className="min-w-[170px]">
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <CalendarIcon className="mr-1 inline h-3.5 w-3.5" />
                    To Date
                  </Label>
                  <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-11 w-full justify-start border-slate-300 bg-slate-50 px-3 text-left font-normal text-slate-800 shadow-sm hover:bg-slate-100"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                        {filters.toDate ? formatDateLabel(filters.toDate) : "Select To Date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={isoToDate(filters.toDate)}
                        onSelect={(selectedDate) => {
                          setFilters((prev) => ({ ...prev, toDate: toIsoDate(selectedDate) }));
                          if (selectedDate) setToDateOpen(false);
                        }}
                        disabled={(date) => Boolean(filters.fromDate) && date < (isoToDate(filters.fromDate) || date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-end gap-3 pt-1">
                  <Button
                    onClick={applyFilters}
                    className="h-11 flex-1 border border-[#163a70] bg-[#163a70] text-white shadow-sm transition-colors hover:bg-[#224d8c]"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Apply Filters
                  </Button>
                  {(filters.fromDate || filters.toDate) && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        const clearedFilters = {
                          district: isAdmin ? filters.district : profile?.district || filters.district,
                          year: currentYear,
                          fromDate: "",
                          toDate: "",
                        };
                        setFilters(clearedFilters);
                        setAppliedFilters(clearedFilters);
                      }}
                      className="h-11 border border-[#c75b12]/20 bg-[#fff7f0] text-[#c75b12] shadow-sm hover:bg-[#fee8d6] hover:text-[#a54910]"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card
            {...getInteractiveCardProps()}
            className="cursor-pointer border-l-4 border-l-red-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Accidents</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.totalAccidents)}</p>
                </div>
                <AlertTriangle className="h-9 w-9 text-red-600/80" />
              </div>
            </CardContent>
          </Card>
          <Card
            {...getInteractiveCardProps({ metric: "deaths" })}
            className="cursor-pointer border-l-4 border-l-orange-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deaths</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.totalDeaths)}</p>
                </div>
                <Target className="h-9 w-9 text-orange-600/80" />
              </div>
            </CardContent>
          </Card>
          <Card
            {...getInteractiveCardProps({ metric: "injuries" })}
            className="cursor-pointer border-l-4 border-l-amber-500 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Injuries</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.totalInjuries)}</p>
                </div>
                <Users className="h-9 w-9 text-amber-500/80" />
              </div>
            </CardContent>
          </Card>
          <Card
            {...getInteractiveCardProps({ metric: "deaths" })}
            className="cursor-pointer border-l-4 border-l-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fatality Rate</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{formatPercent(analyticsData.summary.averageFatalityRate, true)}</p>
                </div>
                <Gauge className="h-9 w-9 text-blue-700/80" />
              </div>
            </CardContent>
          </Card>
          <Card
            {...getInteractiveCardProps({ signedCopyStatus: "Uploaded", metric: "signedUploaded" })}
            className="cursor-pointer border-l-4 border-l-emerald-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed Copy Uploaded</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.signedCopyUploaded)}</p>
                </div>
                <FileCheck className="h-9 w-9 text-emerald-600/80" />
              </div>
            </CardContent>
          </Card>
          <Card
            {...getInteractiveCardProps({ signedCopyStatus: "Pending", metric: "signedPending" })}
            className="cursor-pointer border-l-4 border-l-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed Copy Pending</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.signedCopyPending)}</p>
                </div>
                <Clock className="h-9 w-9 text-slate-700/80" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <Button
                variant="ghost"
                className="h-auto w-full items-start justify-between px-0 py-0 text-slate-900 hover:bg-transparent hover:text-slate-900"
                onClick={() => setShowAnalyticalBrief((prev) => !prev)}
              >
                <div className="text-left">
                  <CardTitle className="flex items-center gap-2 text-xl text-slate-900">
                    <Brain className="h-5 w-5 text-primary" />
                    Analytical Brief
                  </CardTitle>
                  <CardDescription className="mt-1 text-slate-600">AI-supported summary based on the filtered records and comparison metrics</CardDescription>
                </div>
                {showAnalyticalBrief ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
              </Button>
            </CardHeader>
            {showAnalyticalBrief && (
              <CardContent className="space-y-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm leading-6 text-slate-700">{analyticsData.geminiInsights.overallAssessment}</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-900">Key Findings</h3>
                    <div className="space-y-2">
                      {analyticsData.geminiInsights.keyFindings.map((item, index) => (
                        <div key={`${item}-${index}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{item}</div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-slate-900">Priority Actions</h3>
                    <div className="space-y-2">
                      {analyticsData.geminiInsights.recommendations.map((item, index) => (
                        <div key={`${item}-${index}`} className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{item}</div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Forward View</p>
                  <p className="mt-2 text-sm leading-6 text-amber-900">{analyticsData.geminiInsights.predictiveAnalysis}</p>
                </div>
              </CardContent>
            )}
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <Button
                variant="ghost"
                className="h-auto w-full items-start justify-between px-0 py-0 text-slate-900 hover:bg-transparent hover:text-slate-900"
                onClick={() => setShowOperationalSnapshot((prev) => !prev)}
              >
                <div className="text-left">
                  <CardTitle className="text-xl text-slate-900">Operational Snapshot</CardTitle>
                  <CardDescription className="mt-1 text-slate-600">Quick reading for monitoring, enforcement, and reporting</CardDescription>
                </div>
                {showOperationalSnapshot ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
              </Button>
            </CardHeader>
            {showOperationalSnapshot && (
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Peak Accident Hour</p><p className="mt-1 text-lg font-bold text-slate-900">{analyticsData.summary.peakAccidentHour}</p></div>
                <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Peak Accident Month</p><p className="mt-1 text-lg font-bold text-slate-900">{analyticsData.summary.peakAccidentMonth}</p></div>
                <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Highest Risk Road Type</p><p className="mt-1 text-lg font-bold text-slate-900">{analyticsData.summary.mostDangerousRoadType}</p></div>
                <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Leading {comparisonHeadline}</p><p className="mt-1 text-lg font-bold text-slate-900">{topComparison?.name || "Not available"}</p>{topComparison && <p className="mt-1 text-sm text-slate-600">{topComparison.accidents} accidents, {topComparison.deaths} deaths</p>}</div>
                <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Hotspot</p><p className="mt-1 text-lg font-bold text-slate-900">{topHotspot?.place || "Not available"}</p>{topHotspot && <p className="mt-1 text-sm text-slate-600">Risk score {topHotspot.riskScore} in {topHotspot.district}</p>}</div>
                <div className="rounded-lg border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Mandal</p><p className="mt-1 text-lg font-bold text-slate-900">{topMandal?.name || "Not available"}</p>{topMandal && <p className="mt-1 text-sm text-slate-600">{topMandal.accidents} accidents, {topMandal.deaths} deaths</p>}</div>
              </CardContent>
            )}
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 gap-2 rounded-lg bg-slate-200/80 p-1 md:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="geography">Geography</TabsTrigger>
            <TabsTrigger value="causes">Cause Analysis</TabsTrigger>
            <TabsTrigger value="quality">Coverage & Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Accident Trend by Month</CardTitle>
                  <CardDescription>Accidents, deaths, injuries, and fatality rate across the selected year</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <AreaChart data={analyticsData.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" />
                      <YAxis stroke="#64748b" allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="accidents"
                        stackId="1"
                        stroke="#163a70"
                        fill="#8ea7cb"
                        name="Accidents"
                        onClick={(entry) => handleTrendClick(entry)}
                      />
                      <Area
                        type="monotone"
                        dataKey="injuries"
                        stackId="2"
                        stroke="#c75b12"
                        fill="#f4c29c"
                        name="Injuries"
                        onClick={(entry) => handleTrendClick(entry, "injuries")}
                      />
                      <Line
                        type="monotone"
                        dataKey="deaths"
                        stroke="#aa3d47"
                        strokeWidth={3}
                        name="Deaths"
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        onClick={(entry) => handleTrendClick(entry, "deaths")}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Hourly Risk Profile</CardTitle>
                  <CardDescription>Hour-wise accident load to support focused enforcement and patrol planning</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={analyticsData.timeAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="hour" stroke="#64748b" interval={2} />
                      <YAxis stroke="#64748b" allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="accidents"
                        fill="#163a70"
                        radius={[4, 4, 0, 0]}
                        name="Accidents"
                        onClick={(entry) => handleHourClick(entry)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{comparisonHeadline} Comparison</CardTitle>
                  <CardDescription>
                    {analyticsData.scope.viewLevel === "state"
                      ? "Comparative view of districts across the state"
                      : "Comparative view of police stations within the district"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={360}>
                    <BarChart data={chartComparisonData} layout="vertical" margin={{ left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={120} stroke="#64748b" />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="accidents"
                        fill="#163a70"
                        name="Accidents"
                        radius={[0, 4, 4, 0]}
                        onClick={(entry) => handleComparisonChartClick(entry)}
                      />
                      <Bar
                        dataKey="deaths"
                        fill="#c75b12"
                        name="Deaths"
                        radius={[0, 4, 4, 0]}
                        onClick={(entry) => handleComparisonChartClick(entry, "deaths")}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Severity Distribution</CardTitle>
                  <CardDescription>Fatal, injury, and damage-only case mix</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={360}>
                    <PieChart>
                      <Pie
                        data={analyticsData.severityBreakdown}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={3}
                        onClick={(entry) => {
                          const payload = getChartPayload<{ name?: string }>(entry);
                          if (!payload?.name) return;
                          openClassicDrilldown({ severity: payload.name });
                        }}
                      >
                        {analyticsData.severityBreakdown.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, _name, props: any) => [`${value} (${formatPercent(props?.payload?.percentage || 0)})`, props?.payload?.name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="geography" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Mandal Comparison</CardTitle>
                  <CardDescription>Top mandals by accidents, deaths, and injuries</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={chartMandals}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" angle={-20} textAnchor="end" height={70} />
                      <YAxis stroke="#64748b" allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="accidents" fill="#163a70" name="Accidents" onClick={(entry) => handleMandalClick(entry)} />
                      <Bar dataKey="injuries" fill="#d39d11" name="Injuries" onClick={(entry) => handleMandalClick(entry, "injuries")} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Road Type Comparison</CardTitle>
                  <CardDescription>Road category-wise volume, casualty burden, and severity comparison</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Highest Volume</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{topRoadTypeByVolume?.roadType || "N/A"}</p>
                      {topRoadTypeByVolume && (
                        <p className="mt-1 text-xs text-slate-600">
                          {compact(topRoadTypeByVolume.accidents)} accidents, {formatPercent(topRoadTypeByVolume.accidentShare)}
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Highest Severity</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{topRoadTypeBySeverity?.roadType || "N/A"}</p>
                      {topRoadTypeBySeverity && (
                        <p className="mt-1 text-xs text-slate-600">
                          Severity index {topRoadTypeBySeverity.severityIndex.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Highest Fatality Rate</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{topRoadTypeByFatalityRate?.roadType || "N/A"}</p>
                      {topRoadTypeByFatalityRate && (
                        <p className="mt-1 text-xs text-slate-600">
                          {formatPercent(topRoadTypeByFatalityRate.fatalityRate)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Road Type Priority View</p>
                        <p className="mt-1 text-xs text-slate-600">Simple comparison of the main road classes by accidents, deaths, and severity.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {nhVsShComparison.map((item) => (
                        <div key={item.roadType} className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-[90px]">
                              <p className="text-base font-semibold text-slate-900">{item.roadType}</p>
                              <p className="text-xs text-slate-500">Road class</p>
                            </div>
                            <div className="grid flex-1 gap-3 sm:grid-cols-3">
                              <div className="rounded-md bg-slate-50 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Accidents</p>
                                <button
                                  type="button"
                                  className="mt-1 text-lg font-bold text-[#163a70] transition hover:underline"
                                  onClick={() => openClassicDrilldown(getRoadTypeFilters(item.roadType))}
                                >
                                  {compact(item.accidents)}
                                </button>
                              </div>
                              <div className="rounded-md bg-red-50 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">Deaths</p>
                                <button
                                  type="button"
                                  className="mt-1 text-lg font-bold text-red-700 transition hover:underline"
                                  onClick={() => openClassicDrilldown(getRoadTypeFilters(item.roadType, "deaths"))}
                                >
                                  {compact(item.deaths)}
                                </button>
                              </div>
                              <div className="rounded-md bg-amber-50 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Severity</p>
                                <p className="mt-1 text-lg font-bold text-amber-800">{item.severityIndex.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {analyticsData.roadTypeAnalysis.slice(0, 6).map((item) => (
                      <div key={item.roadType} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{item.roadType}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              <button
                                type="button"
                                className="font-semibold text-[#163a70] transition hover:underline"
                                onClick={() => openClassicDrilldown(getRoadTypeFilters(item.roadType))}
                              >
                                {compact(item.accidents)} accidents
                              </button>
                              {", "}
                              <button
                                type="button"
                                className="font-semibold text-[#163a70] transition hover:underline"
                                onClick={() => openClassicDrilldown(getRoadTypeFilters(item.roadType, "casualties"))}
                              >
                                {compact(item.casualties)} total casualties
                              </button>
                            </p>
                          </div>
                          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-4">
                            <div><span className="font-semibold">{formatPercent(item.accidentShare)}</span> accident share</div>
                            <div><span className="font-semibold">{formatPercent(item.deathShare)}</span> death share</div>
                            <div><span className="font-semibold">{item.casualtiesPerAccident.toFixed(2)}</span> casualties per accident</div>
                            <div><span className="font-semibold">{item.severityIndex.toFixed(2)}</span> severity index</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <Card className="border border-slate-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">NH / SH Share Comparison</CardTitle>
                        <CardDescription>Accident share and fatality rate across the main road classes</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={nhVsShComparison}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="roadType" stroke="#64748b" />
                            <YAxis yAxisId="left" stroke="#64748b" />
                            <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                name.toLowerCase().includes("rate") || name.toLowerCase().includes("share")
                                  ? `${value.toFixed(1)}%`
                                  : value.toFixed(2),
                                name,
                              ]}
                            />
                            <Legend />
                            <Bar
                              yAxisId="left"
                              dataKey="accidentShare"
                              fill="#163a70"
                              name="Accident Share %"
                              radius={[4, 4, 0, 0]}
                              onClick={(entry) => handleRoadTypeChartClick(entry)}
                            />
                            <Bar
                              yAxisId="left"
                              dataKey="fatalityRate"
                              fill="#c75b12"
                              name="Fatality Rate %"
                              radius={[4, 4, 0, 0]}
                              onClick={(entry) => handleRoadTypeChartClick(entry, "deaths")}
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="severityIndex"
                              stroke="#aa3d47"
                              strokeWidth={3}
                              name="Severity Index"
                              dot={{ r: 3 }}
                              activeDot={{ r: 5 }}
                              onClick={(entry) => handleRoadTypeChartClick(entry)}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="border border-slate-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">Road Type Share Mix</CardTitle>
                        <CardDescription>How total accidents are distributed across NH, SH, MDR, and other roads</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={roadTypeShareChartData}
                              dataKey="value"
                              nameKey="name"
                              outerRadius={105}
                              innerRadius={55}
                              paddingAngle={3}
                              onClick={(entry) => handleRoadTypeChartClick(entry)}
                            >
                              {roadTypeShareChartData.map((entry, index) => (
                                <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number, _name, props: any) => [
                                `${value.toFixed(1)}% (${compact(props?.payload?.accidents || 0)} accidents)`,
                                props?.payload?.name,
                              ]}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="border border-slate-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base">Casualty Intensity by Road Type</CardTitle>
                      <CardDescription>Compares accidents with casualties per accident so NH and SH patterns stand out more clearly</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={nhVsShComparison}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="roadType" stroke="#64748b" />
                          <YAxis yAxisId="left" stroke="#64748b" allowDecimals={false} />
                          <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                          <Tooltip />
                          <Legend />
                          <Bar
                            yAxisId="left"
                            dataKey="accidents"
                            fill="#163a70"
                            name="Accidents"
                            radius={[4, 4, 0, 0]}
                            onClick={(entry) => handleRoadTypeChartClick(entry)}
                          />
                          <Bar
                            yAxisId="left"
                            dataKey="deaths"
                            fill="#aa3d47"
                            name="Deaths"
                            radius={[4, 4, 0, 0]}
                            onClick={(entry) => handleRoadTypeChartClick(entry, "deaths")}
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="casualtiesPerAccident"
                            stroke="#2a7c4a"
                            strokeWidth={3}
                            name="Casualties Per Accident"
                            dot={{ r: 3 }}
                            activeDot={{ r: 5 }}
                            onClick={(entry) => handleRoadTypeChartClick(entry)}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Top Hotspots</CardTitle>
                <CardDescription>High-risk places ranked by combined accident volume and casualty severity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {chartHotspots.map((hotspot) => (
                  <div key={`${hotspot.place}-${hotspot.district}`} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{hotspot.place}</h3>
                          <Badge className={severityColors[hotspot.severity] || "bg-slate-50 text-slate-700 border-slate-200"}>{hotspot.severity}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{hotspot.district}</p>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-4">
                        <div>
                          <button
                            type="button"
                            className="font-semibold text-[#163a70] transition hover:underline"
                            onClick={() => handleHotspotClick(hotspot.place, hotspot.district)}
                          >
                            {hotspot.accidents}
                          </button>{" "}
                          accidents
                        </div>
                        <div>
                          <button
                            type="button"
                            className="font-semibold text-[#163a70] transition hover:underline"
                            onClick={() => handleHotspotClick(hotspot.place, hotspot.district, "deaths")}
                          >
                            {hotspot.deaths}
                          </button>{" "}
                          deaths
                        </div>
                        <div>
                          <button
                            type="button"
                            className="font-semibold text-[#163a70] transition hover:underline"
                            onClick={() => handleHotspotClick(hotspot.place, hotspot.district, "injuries")}
                          >
                            {hotspot.injured}
                          </button>{" "}
                          injured
                        </div>
                        <div>
                          <button
                            type="button"
                            className="font-semibold text-[#163a70] transition hover:underline"
                            onClick={() => handleHotspotClick(hotspot.place, hotspot.district)}
                          >
                            {hotspot.riskScore}
                          </button>{" "}
                          risk score
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="causes" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Car className="h-5 w-5 text-orange-600" />
                    Driver-Related Causes
                  </CardTitle>
                  <CardDescription>Most frequent driver-side contributors across the selected records</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {driverCauseChartData.map((entry, index) => (
                      <div key={entry.cause} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {index + 1}. {entry.shortCause}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{entry.cause}</p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-[#163a70] transition hover:border-[#163a70] hover:bg-[#f4f7fb]"
                            onClick={() => handleCauseClick({ driverCause: entry.cause })}
                          >
                            {entry.count}
                          </button>
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
                    {driverCauseChartData.length === 0 && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                        No driver-related causes were recorded in the selected submissions.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Vehicle Condition Causes</CardTitle>
                  <CardDescription>Mechanical and vehicle fitness factors recorded in submissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={360}>
                    <PieChart>
                      <Pie
                        data={vehicleCauseChartData}
                        dataKey="count"
                        nameKey="shortCause"
                        outerRadius={110}
                        onClick={(entry) => {
                          const payload = getChartPayload<{ cause?: string }>(entry);
                          if (!payload?.cause) return;
                          handleCauseClick({ vehicleCause: payload.cause });
                        }}
                      >
                        {vehicleCauseChartData.map((entry, index) => (
                          <Cell key={entry.cause} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, _name, props: any) => [value, props?.payload?.cause || props?.payload?.shortCause]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Engineering and Road Environment Factors</CardTitle>
                  <CardDescription>Category-wise road and junction deficiencies referenced by field officers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analyticsData.roadEngineeringCauses.map((group) => (
                    <div key={group.category} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900">{group.category}</h3>
                        <Badge variant="outline">{group.totalIncidents} mentions</Badge>
                      </div>
                      <div className="space-y-2">
                        {group.causes.map((cause) => (
                          <div key={cause.name}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="text-slate-700">{cause.name}</span>
                              <button
                                type="button"
                                className="font-medium text-[#163a70] transition hover:underline"
                                onClick={() =>
                                  handleCauseClick({
                                    roadEngineeringCategory: group.category,
                                    roadEngineeringCause: cause.name,
                                  })
                                }
                              >
                                {cause.count}
                              </button>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100">
                              <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(cause.percentage, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Vehicle Mix in Accidents</CardTitle>
                  <CardDescription>Vehicle categories most frequently involved in reported cases</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={analyticsData.vehicleAnalysis.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="type" stroke="#64748b" angle={-15} textAnchor="end" height={70} />
                      <YAxis stroke="#64748b" allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#163a70" name="Vehicles" onClick={(entry) => handleVehicleMixClick(entry)} />
                      <Bar dataKey="deaths" fill="#aa3d47" name="Deaths" onClick={(entry) => handleVehicleMixClick(entry, "deaths")} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="quality" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{analyticsData.scope.viewLevel === "state" ? "Leading Police Stations" : "Police Station Performance"}</CardTitle>
                  <CardDescription>Police-station comparison for workload and casualty burden</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={chartPoliceStations}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" angle={-20} textAnchor="end" height={80} />
                      <YAxis stroke="#64748b" allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="accidents" fill="#163a70" name="Accidents" onClick={(entry) => handlePoliceStationClick(entry)} />
                      <Bar dataKey="deaths" fill="#c75b12" name="Deaths" onClick={(entry) => handlePoliceStationClick(entry, "deaths")} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    Day-wise Pattern
                  </CardTitle>
                  <CardDescription>Weekly accident rhythm for deployment planning and review meetings</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={analyticsData.dayOfWeekAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="day" stroke="#64748b" />
                      <YAxis stroke="#64748b" allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="accidents"
                        stroke="#163a70"
                        strokeWidth={3}
                        name="Accidents"
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        onClick={(entry) => handleWeekdayClick(entry)}
                      />
                      <Line
                        type="monotone"
                        dataKey="deaths"
                        stroke="#aa3d47"
                        strokeWidth={2}
                        name="Deaths"
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        onClick={(entry) => handleWeekdayClick(entry, "deaths")}
                      />
                      <Line
                        type="monotone"
                        dataKey="injuries"
                        stroke="#d39d11"
                        strokeWidth={2}
                        name="Injuries"
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        onClick={(entry) => handleWeekdayClick(entry, "injuries")}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Top Comparison Units</CardTitle>
                <CardDescription>Detailed ranking of the current comparison layer with severity status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {analyticsData.comparisonData.slice(0, 12).map((item) => (
                  <div key={item.name} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-sm text-slate-500">{comparisonHeadline} comparison row</p>
                        </div>
                        <Badge className={severityColors[item.severity] || "bg-slate-50 text-slate-700 border-slate-200"}>{item.severity}</Badge>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-4">
                        <div>
                          <button
                            type="button"
                            className="font-semibold text-[#163a70] transition hover:underline"
                            onClick={() => openClassicDrilldown(getComparisonFilters(item.name))}
                          >
                            {item.accidents}
                          </button>{" "}
                          accidents
                        </div>
                        <div>
                          <button
                            type="button"
                            className="font-semibold text-[#163a70] transition hover:underline"
                            onClick={() => openClassicDrilldown(getComparisonFilters(item.name, "deaths"))}
                          >
                            {item.deaths}
                          </button>{" "}
                          deaths
                        </div>
                        <div>
                          <button
                            type="button"
                            className="font-semibold text-[#163a70] transition hover:underline"
                            onClick={() => openClassicDrilldown(getComparisonFilters(item.name, "injuries"))}
                          >
                            {item.injuries}
                          </button>{" "}
                          injuries
                        </div>
                        <div><span className="font-semibold">{formatPercent(item.fatalityRate)}</span> fatality rate</div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
            Current scope: <span className="font-semibold text-slate-700">{analyticsData.scope.scopeLabel}</span> for {analyticsData.scope.year}. Visuals are computed directly from submission records for this access level.
          </p>
          <Button variant="outline" onClick={goBack}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <AnalyticsSubmissionInspector
          open={inspectorOpen}
          onOpenChange={(nextOpen) => {
            setInspectorOpen(nextOpen);
            if (!nextOpen) {
              setInspectorFilters(null);
            }
          }}
          scopeFilters={inspectorScopeFilters}
          drilldownFilters={inspectorFilters}
          mode="classic"
        />
      </div>
    </div>
  );
};

export default EnhancedAnalytics;
