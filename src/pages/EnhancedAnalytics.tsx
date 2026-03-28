import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GovHeader from "@/components/GovHeader";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { AP_DISTRICTS } from "@/lib/constants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { AlertTriangle, BarChart3, Brain, Calendar, Car, ChevronDown, ChevronUp, Clock, FileCheck, Filter, Gauge, RefreshCw, ShieldCheck, Target, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

function formatPercent(value: number, divideBy100 = false) {
  const actual = divideBy100 ? value * 100 : value;
  return `${actual.toFixed(1)}%`;
}

function compact(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function findRoadTypeEntry(
  roadTypes: EnhancedAnalyticsData["roadTypeAnalysis"],
  roadType: string
) {
  return roadTypes.find((entry) => entry.roadType.toUpperCase() === roadType.toUpperCase()) || null;
}

function formatDateLabel(value: string) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  const [analyticsData, setAnalyticsData] = useState<EnhancedAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [filterDistrict, setFilterDistrict] = useState("all");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [filterFromDate, setFilterFromDate] = useState("");
  const [filterToDate, setFilterToDate] = useState("");
  const [showAnalyticalBrief, setShowAnalyticalBrief] = useState(false);
  const [showOperationalSnapshot, setShowOperationalSnapshot] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      toast.error("Please login to access analytics");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!isAdmin && profile?.district) {
      setFilterDistrict(profile.district);
    }
  }, [isAdmin, profile?.district]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchEnhancedAnalytics();
    }
  }, [authLoading, user, filterDistrict, filterYear, filterFromDate, filterToDate]);

  const fetchEnhancedAnalytics = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const requestedDistrict = isAdmin ? filterDistrict : profile?.district || filterDistrict;
      const { data, error } = await api.analytics.getEnhancedAnalytics({
        district: requestedDistrict,
        year: filterYear,
        fromDate: filterFromDate || undefined,
        toDate: filterToDate || undefined,
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
  const hasCustomDateRange = Boolean(filterFromDate || filterToDate);
  const dateRangeLabel = hasCustomDateRange
    ? `${filterFromDate ? formatDateLabel(filterFromDate) : "Start"} - ${filterToDate ? formatDateLabel(filterToDate) : "Today"}`
    : null;

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
  const chartPoliceStations = analyticsData.policeStationAnalysis.slice(0, 10);
  const chartMandals = analyticsData.mandalAnalysis.slice(0, 8);
  const chartRoadTypes = analyticsData.roadTypeAnalysis.slice(0, 8);
  const chartHotspots = analyticsData.hotspotsLocations.slice(0, 8);
  const chartCoverage = analyticsData.fieldCompleteness;
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
  const vehicleCauseChartData = analyticsData.vehicleCauses.map((entry) => ({
    ...entry,
    shortCause: shortenCauseLabel(entry.cause),
  }));
  const goBack = () => navigate(isAdmin ? "/admin" : "/dashboard");

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f8fc_0%,#eef3fb_100%)]">
      <GovHeader />

      <div className="container mx-auto space-y-6 px-4 py-6">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-[#163a70] via-[#2f5d97] to-[#c75b12]" />
          <CardContent className="pt-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
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
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Comprehensive accident monitoring for {analyticsData.scope.scopeLabel}. This workspace compares
                    {analyticsData.scope.viewLevel === "state" ? " districts across the state" : " police stations within the district"},
                    highlights hotspots, reviews field completeness, and surfaces operational safety priorities.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <div className="min-w-[150px]">
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Filter className="mr-1 inline h-3.5 w-3.5" />
                    District
                  </Label>
                  <Select
                    value={isAdmin ? filterDistrict : analyticsData.scope.district || profile?.district || "all"}
                    onValueChange={setFilterDistrict}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="bg-white">
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

                <div className="min-w-[130px]">
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <Calendar className="mr-1 inline h-3.5 w-3.5" />
                    Year
                  </Label>
                  <Select value={filterYear} onValueChange={setFilterYear} disabled={hasCustomDateRange}>
                    <SelectTrigger className="bg-white">
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
                    From Date
                  </Label>
                  <input
                    type="date"
                    value={filterFromDate}
                    onChange={(e) => setFilterFromDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="min-w-[150px]">
                  <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    To Date
                  </Label>
                  <input
                    type="date"
                    value={filterToDate}
                    min={filterFromDate || undefined}
                    onChange={(e) => setFilterToDate(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <Button variant="outline" onClick={fetchEnhancedAnalytics} className="flex-1 bg-white">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  {(filterFromDate || filterToDate) && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setFilterFromDate("");
                        setFilterToDate("");
                      }}
                      className="border border-slate-200"
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
          <Card className="border-l-4 border-l-red-600 shadow-sm"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Accidents</p><p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.totalAccidents)}</p></div><AlertTriangle className="h-9 w-9 text-red-600/80" /></div></CardContent></Card>
          <Card className="border-l-4 border-l-orange-600 shadow-sm"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deaths</p><p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.totalDeaths)}</p></div><Target className="h-9 w-9 text-orange-600/80" /></div></CardContent></Card>
          <Card className="border-l-4 border-l-amber-500 shadow-sm"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Injuries</p><p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.totalInjuries)}</p></div><Users className="h-9 w-9 text-amber-500/80" /></div></CardContent></Card>
          <Card className="border-l-4 border-l-blue-700 shadow-sm"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fatality Rate</p><p className="mt-2 text-3xl font-bold text-slate-900">{formatPercent(analyticsData.summary.averageFatalityRate, true)}</p></div><Gauge className="h-9 w-9 text-blue-700/80" /></div></CardContent></Card>
          <Card className="border-l-4 border-l-emerald-600 shadow-sm"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed Copy Uploaded</p><p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.signedCopyUploaded)}</p></div><FileCheck className="h-9 w-9 text-emerald-600/80" /></div></CardContent></Card>
          <Card className="border-l-4 border-l-slate-700 shadow-sm"><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed Copy Pending</p><p className="mt-2 text-3xl font-bold text-slate-900">{compact(analyticsData.summary.signedCopyPending)}</p></div><Clock className="h-9 w-9 text-slate-700/80" /></div></CardContent></Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <Button
                variant="ghost"
                className="h-auto justify-between px-0 py-0 hover:bg-transparent"
                onClick={() => setShowAnalyticalBrief((prev) => !prev)}
              >
                <div className="text-left">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Brain className="h-5 w-5 text-primary" />
                    Analytical Brief
                  </CardTitle>
                  <CardDescription className="mt-1">AI-supported summary based on the filtered records and comparison metrics</CardDescription>
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
                className="h-auto justify-between px-0 py-0 hover:bg-transparent"
                onClick={() => setShowOperationalSnapshot((prev) => !prev)}
              >
                <div className="text-left">
                  <CardTitle className="text-xl">Operational Snapshot</CardTitle>
                  <CardDescription className="mt-1">Quick reading for monitoring, enforcement, and reporting</CardDescription>
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
                      <Area type="monotone" dataKey="accidents" stackId="1" stroke="#163a70" fill="#8ea7cb" name="Accidents" />
                      <Area type="monotone" dataKey="injuries" stackId="2" stroke="#c75b12" fill="#f4c29c" name="Injuries" />
                      <Line type="monotone" dataKey="deaths" stroke="#aa3d47" strokeWidth={3} name="Deaths" />
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
                      <Bar dataKey="accidents" fill="#163a70" radius={[4, 4, 0, 0]} name="Accidents" />
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
                      <Bar dataKey="accidents" fill="#163a70" name="Accidents" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="deaths" fill="#c75b12" name="Deaths" radius={[0, 4, 4, 0]} />
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
                      <Pie data={analyticsData.severityBreakdown} dataKey="count" nameKey="name" innerRadius={65} outerRadius={105} paddingAngle={3}>
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
                      <Bar dataKey="accidents" fill="#163a70" name="Accidents" />
                      <Bar dataKey="injuries" fill="#d39d11" name="Injuries" />
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

                  <ResponsiveContainer width="100%" height={340}>
                    <RadarChart data={chartRoadTypes}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="roadType" />
                      <PolarRadiusAxis />
                      <Radar name="Accidents" dataKey="accidents" stroke="#163a70" fill="#163a70" fillOpacity={0.35} />
                      <Radar name="Deaths" dataKey="deaths" stroke="#c75b12" fill="#c75b12" fillOpacity={0.2} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>

                  <div className="space-y-3">
                    {analyticsData.roadTypeAnalysis.slice(0, 6).map((item) => (
                      <div key={item.roadType} className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{item.roadType}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {compact(item.accidents)} accidents, {compact(item.casualties)} total casualties
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
                            <Bar yAxisId="left" dataKey="accidentShare" fill="#163a70" name="Accident Share %" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="left" dataKey="fatalityRate" fill="#c75b12" name="Fatality Rate %" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="severityIndex" stroke="#aa3d47" strokeWidth={3} name="Severity Index" />
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
                          <Bar yAxisId="left" dataKey="accidents" fill="#163a70" name="Accidents" radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="left" dataKey="deaths" fill="#aa3d47" name="Deaths" radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey="casualtiesPerAccident" stroke="#2a7c4a" strokeWidth={3} name="Casualties Per Accident" />
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
                        <div><span className="font-semibold">{hotspot.accidents}</span> accidents</div>
                        <div><span className="font-semibold">{hotspot.deaths}</span> deaths</div>
                        <div><span className="font-semibold">{hotspot.injured}</span> injured</div>
                        <div><span className="font-semibold">{hotspot.riskScore}</span> risk score</div>
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
                          <Badge variant="outline" className="shrink-0">
                            {entry.count}
                          </Badge>
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
                      <Pie data={vehicleCauseChartData} dataKey="count" nameKey="shortCause" outerRadius={110}>
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
                              <span className="font-medium text-slate-900">{cause.count}</span>
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
                      <Bar dataKey="count" fill="#163a70" name="Vehicles" />
                      <Bar dataKey="deaths" fill="#aa3d47" name="Deaths" />
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
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    Documentation & Submission Compliance
                  </CardTitle>
                  <CardDescription>Signed copies, GPS availability, and supporting record completeness</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={analyticsData.signedCopyAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" />
                      <YAxis stroke="#64748b" allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#2a7c4a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Field Completeness Coverage</CardTitle>
                  <CardDescription>Availability of major investigation inputs across the submission pool</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartCoverage} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#64748b" domain={[0, 100]} />
                      <YAxis dataKey="field" type="category" width={150} stroke="#64748b" />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Bar dataKey="coverage" fill="#163a70" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

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
                      <Bar dataKey="accidents" fill="#163a70" name="Accidents" />
                      <Bar dataKey="deaths" fill="#c75b12" name="Deaths" />
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
                      <Line type="monotone" dataKey="accidents" stroke="#163a70" strokeWidth={3} name="Accidents" />
                      <Line type="monotone" dataKey="deaths" stroke="#aa3d47" strokeWidth={2} name="Deaths" />
                      <Line type="monotone" dataKey="injuries" stroke="#d39d11" strokeWidth={2} name="Injuries" />
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
                        <div><span className="font-semibold">{item.accidents}</span> accidents</div>
                        <div><span className="font-semibold">{item.deaths}</span> deaths</div>
                        <div><span className="font-semibold">{item.injuries}</span> injuries</div>
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
      </div>
    </div>
  );
};

export default EnhancedAnalytics;
