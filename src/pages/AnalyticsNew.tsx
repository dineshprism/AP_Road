import { useCallback, useEffect, useMemo, useState } from "react";
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
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Brain,
  Building2,
  Calendar as CalendarIcon,
  Car,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileCheck,
  Filter,
  Flame,
  Gauge,
  Layers,
  MapPin,
  RefreshCw,
  Route,
  Search,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import GovHeader from "@/components/GovHeader";
import AccidentMap from "@/components/AccidentMap";
import {
  ChartPanel,
  InsightStrip,
  KpiTile,
  MapPointRow,
  QuickFilterChip,
  RankRow,
  SectionHero,
  getChartClickHandler,
} from "@/components/analytics-new/AnalyticsNewUI";
import AnalyticsSubmissionInspector, {
  type AnalyticsClassicDrilldownFilters,
  type AnalyticsProDrilldownFilters,
} from "@/components/analytics/AnalyticsSubmissionInspector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import {
  ANALYTICS_CHART_COLORS,
  formatDateLabel,
  formatPercent,
  getChartPayload,
  getInteractiveProps,
  isIsoDate,
  shortenCauseLabel,
} from "@/lib/analytics-shared";
import {
  buildCasualtyIndex,
  buildDataQualityScore,
  buildExecutiveAlerts,
  buildNhShComparison,
  buildNightDaySplit,
  buildRiskMatrix,
} from "@/lib/analytics-new-derived";
import { AP_DISTRICTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type EnhancedPayload = NonNullable<Awaited<ReturnType<typeof api.analytics.getEnhancedAnalytics>>["data"]>;
type ProPayload = NonNullable<Awaited<ReturnType<typeof api.analytics.getAnalyticsPro>>["data"]>;

const AnalyticsNew = () => {
  const navigate = useNavigate();
  const { user, isAdmin, profile, roles, loading: authLoading } = useAuth();
  const currentYear = new Date().getFullYear().toString();

  const [enhanced, setEnhanced] = useState<EnhancedPayload | null>(null);
  const [pro, setPro] = useState<ProPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("command");
  const [listSearch, setListSearch] = useState("");
  const [drillLabel, setDrillLabel] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [filters, setFilters] = useState({ district: "all", year: currentYear, fromDate: "", toDate: "" });
  const [appliedFilters, setAppliedFilters] = useState({ district: "all", year: currentYear, fromDate: "", toDate: "" });
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorMode, setInspectorMode] = useState<"classic" | "pro">("classic");
  const [classicFilters, setClassicFilters] = useState<AnalyticsClassicDrilldownFilters | null>(null);
  const [proFilters, setProFilters] = useState<AnalyticsProDrilldownFilters | null>(null);

  const goBack = useCallback(() => {
    if (roles.includes("dgp")) navigate("/admin");
    else if (roles.includes("adgp")) navigate("/adgp-dashboard");
    else navigate("/dashboard");
  }, [navigate, roles]);

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

  const districtParam = isAdmin ? appliedFilters.district : profile?.district || appliedFilters.district;

  const inspectorScope = useMemo(
    () => ({
      district: districtParam,
      year: appliedFilters.year,
      fromDate: appliedFilters.fromDate || undefined,
      toDate: appliedFilters.toDate || undefined,
    }),
    [appliedFilters, districtParam]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const payload = {
        district: districtParam,
        year: appliedFilters.year,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
      };
      const [enhancedRes, proRes] = await Promise.all([
        api.analytics.getEnhancedAnalytics(payload),
        api.analytics.getAnalyticsPro(payload),
      ]);
      if (enhancedRes.error || proRes.error) {
        setLoadError(enhancedRes.error || proRes.error || "Failed to load analytics");
        setEnhanced(null);
        setPro(null);
        return;
      }
      setEnhanced(enhancedRes.data);
      setPro(proRes.data);
      setLastRefresh(new Date());
    } catch {
      setLoadError("Failed to load analytics");
      setEnhanced(null);
      setPro(null);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, districtParam]);

  useEffect(() => {
    if (!authLoading && user) fetchData();
  }, [authLoading, user, fetchData]);

  const applyFilters = () => {
    if (filters.fromDate && !isIsoDate(filters.fromDate)) {
      toast.error("From date must be YYYY-MM-DD");
      return;
    }
    if (filters.toDate && !isIsoDate(filters.toDate)) {
      toast.error("To date must be YYYY-MM-DD");
      return;
    }
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      toast.error("From date cannot be later than To date");
      return;
    }
    setAppliedFilters(filters);
    setDrillLabel(null);
  };

  const openClassic = (next: AnalyticsClassicDrilldownFilters = {}, label?: string) => {
    setInspectorMode("classic");
    setClassicFilters(next);
    setProFilters(null);
    setDrillLabel(label || "Accident-scope selection");
    setInspectorOpen(true);
  };

  const openPro = (next: AnalyticsProDrilldownFilters = {}, label?: string) => {
    setInspectorMode("pro");
    setProFilters(next);
    setClassicFilters(null);
    setDrillLabel(label || "Reporting-scope selection");
    setInspectorOpen(true);
  };

  const openSubmission = (id: string) => navigate(`/submission/${id}`);

  const years = useMemo(
    () => Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString()),
    []
  );

  const derived = useMemo(() => {
    if (!enhanced || !pro) return null;
    return {
      nightDay: buildNightDaySplit(enhanced.timeAnalysis),
      dataQuality: buildDataQualityScore(enhanced.fieldCompleteness),
      casualtyIndex: buildCasualtyIndex(enhanced.summary),
      nhSh: buildNhShComparison(enhanced.roadTypeAnalysis),
      alerts: buildExecutiveAlerts(enhanced, pro),
      riskMatrix: buildRiskMatrix(enhanced.comparisonData),
      signedCopyRate:
        enhanced.summary.totalAccidents > 0
          ? (enhanced.summary.signedCopyUploaded / enhanced.summary.totalAccidents) * 100
          : 0,
    };
  }, [enhanced, pro]);

  const filteredComparison = useMemo(() => {
    if (!enhanced) return [];
    const q = listSearch.trim().toLowerCase();
    if (!q) return enhanced.comparisonData;
    return enhanced.comparisonData.filter((row) => row.name.toLowerCase().includes(q));
  }, [enhanced, listSearch]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0f1c33]">
        <GovHeader />
        <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <p className="font-semibold text-white">Loading grant analytics workspace…</p>
          <p className="text-sm text-white/60">Accident intelligence · timeliness · compliance</p>
        </div>
      </div>
    );
  }

  if (!enhanced || !pro || !derived) {
    return (
      <div className="min-h-screen bg-slate-50">
        <GovHeader />
        <div className="container mx-auto px-4 py-10">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-10 text-center">
              <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-red-500" />
              <p className="text-lg font-semibold text-red-800">Unable to load analytics_new</p>
              <p className="mt-2 text-sm text-red-600">{loadError}</p>
              <Button className="mt-6" variant="outline" onClick={goBack}>
                Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const summary = enhanced.summary;
  const comparisonClick = (name: string) =>
    openClassic(
      enhanced.scope.viewLevel === "state" ? { comparisonName: name } : { policeStation: name },
      `${name} — submissions`
    );

  return (
    <div className="min-h-screen bg-[#f0f4fa]">
      <GovHeader />

      {/* Grant-style command bar */}
      <div className="sticky top-[86px] z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="gov-tricolor-top h-1" />
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={goBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/analytics")}>
              Classic
            </Button>
            <Button variant="outline" size="sm" onClick={() => void fetchData()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastRefresh && (
              <span className="text-xs text-slate-500">
                Updated {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <Badge id="analytics_new" className="bg-gradient-to-r from-[#163a70] via-[#7a4cc2] to-[#138808] px-3 py-1 text-white">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              analytics_new · Grant Analytics
            </Badge>
          </div>
        </div>
        {drillLabel && (
          <div className="border-t border-slate-100 bg-[#163a70]/5 px-4 py-2">
            <p className="container mx-auto text-xs font-medium text-[#163a70]">
              Active drill-down: <span className="font-bold">{drillLabel}</span> — inspector lists matching FIR submissions
            </p>
          </div>
        )}
      </div>

      <div className="container mx-auto space-y-5 px-4 py-6">
        {/* Filters */}
        <Card className="overflow-hidden border-slate-200 shadow-md">
          <div className="h-1.5 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" />
          <CardContent className="space-y-5 pt-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge className="bg-[#163a70]">{enhanced.scope.viewLevel === "state" ? "State" : "District"} view</Badge>
                  <Badge variant="outline">{enhanced.scope.scopeLabel}</Badge>
                  <Badge variant="outline">CY {enhanced.scope.year}</Badge>
                </div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  Road Safety Analytics Command Center
                </h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-600">
                  In-depth, grant-ready analytics for DGP, ADGP, and district officers. Every chart, KPI, and row opens the originating FIR submissions.
                </p>
              </div>
              <div className="grid w-full max-w-3xl gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {isAdmin && (
                  <div>
                    <Label className="text-xs font-bold uppercase text-slate-500">District</Label>
                    <Select value={filters.district} onValueChange={(v) => setFilters((p) => ({ ...p, district: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All districts</SelectItem>
                        {AP_DISTRICTS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">Year</Label>
                  <Select value={filters.year} onValueChange={(v) => setFilters((p) => ({ ...p, year: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={y}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">From</Label>
                  <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-9 w-full justify-start text-xs">
                        <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                        {filters.fromDate ? formatDateLabel(filters.fromDate) : "—"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`) : undefined}
                        onSelect={(d) => {
                          setFilters((p) => ({ ...p, fromDate: d ? format(d, "yyyy-MM-dd") : "" }));
                          setFromDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase text-slate-500">To</Label>
                  <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-9 w-full justify-start text-xs">
                        <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                        {filters.toDate ? formatDateLabel(filters.toDate) : "—"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={filters.toDate ? new Date(`${filters.toDate}T00:00:00`) : undefined}
                        onSelect={(d) => {
                          setFilters((p) => ({ ...p, toDate: d ? format(d, "yyyy-MM-dd") : "" }));
                          setToDateOpen(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button className="h-9" onClick={applyFilters}>
                  <Filter className="mr-2 h-4 w-4" />
                  Apply
                </Button>
              </div>
            </div>

            {/* Quick filters */}
            <div className="flex flex-wrap gap-2">
              <QuickFilterChip label="All accidents" onClick={() => openClassic({}, "All accidents in scope")} />
              <QuickFilterChip label="Fatal" onClick={() => openClassic({ severity: "Fatal" }, "Fatal accidents")} />
              <QuickFilterChip label="Injury" onClick={() => openClassic({ severity: "Injury" }, "Injury accidents")} />
              <QuickFilterChip label="Delayed FIRs" onClick={() => openPro({ timelinessStatus: "Delayed" }, "Delayed submissions")} />
              <QuickFilterChip label="Pending signed copy" onClick={() => openClassic({ signedCopyStatus: "Pending" }, "Pending signed copies")} />
              <QuickFilterChip label="Peak hour" onClick={() => openClassic({ hour: summary.peakAccidentHour?.split(":")[0] ? `${summary.peakAccidentHour}` : undefined }, "Peak accident hour")} />
            </div>

            {/* Primary KPIs */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-12">
              <KpiTile label="Accidents" value={summary.totalAccidents} icon={BarChart3} onClick={() => openClassic({}, "All accidents")} />
              <KpiTile label="Deaths" value={summary.totalDeaths} tone="danger" icon={AlertTriangle} onClick={() => openClassic({ metric: "deaths" }, "Deaths")} />
              <KpiTile label="Injuries" value={summary.totalInjuries} tone="warning" icon={Users} onClick={() => openClassic({ metric: "injuries" }, "Injuries")} />
              <KpiTile label="Fatality rate" value={formatPercent(summary.averageFatalityRate * 100)} tone="danger" icon={Flame} onClick={() => openClassic({ severity: "Fatal" }, "Fatal severity")} />
              <KpiTile label="Casualty index" value={derived.casualtyIndex} hint="Per accident" tone="violet" icon={Gauge} onClick={() => openClassic({ metric: "deaths" }, "High casualty load")} />
              <KpiTile label="Vehicles" value={summary.totalVehicles} hint={`${summary.averageVehiclesPerAccident.toFixed(1)} / accident`} icon={Car} onClick={() => openClassic({ metric: "vehicles" }, "Vehicle records")} />
              <KpiTile label="Drivers" value={summary.totalDrivers} icon={Users} onClick={() => openClassic({ metric: "drivers" }, "Driver records")} />
              <KpiTile label="Timely %" value={formatPercent(pro.summary.timelyRate)} tone="success" icon={Clock3} onClick={() => openPro({ timelinessStatus: "Timely" }, "Timely submissions")} />
              <KpiTile label="Signed copies" value={formatPercent(derived.signedCopyRate)} hint={`${summary.signedCopyPending} pending`} icon={FileCheck} onClick={() => openClassic({ signedCopyStatus: "Uploaded" }, "Uploaded signed copies")} />
              <KpiTile label="Data quality" value={`${derived.dataQuality}%`} icon={Shield} tone="info" onClick={() => setActiveTab("compliance")} />
              <KpiTile label="Peak hour" value={summary.peakAccidentHour} icon={Zap} onClick={() => openClassic({ hour: summary.peakAccidentHour }, "Peak hour")} />
              <KpiTile label="Hotspots" value={enhanced.hotspotsLocations.length} icon={MapPin} onClick={() => setActiveTab("geography")} />
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="sticky top-[calc(86px+52px)] z-30 flex h-auto w-full flex-wrap justify-start gap-1 border border-slate-200 bg-white p-1.5 shadow-md">
            <TabsTrigger value="command">Command</TabsTrigger>
            <TabsTrigger value="overview">Trends</TabsTrigger>
            <TabsTrigger value="geography">Geography</TabsTrigger>
            <TabsTrigger value="causes">Causes</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="risk">Risk matrix</TabsTrigger>
            <TabsTrigger value="insights">AI brief</TabsTrigger>
          </TabsList>

          {/* COMMAND */}
          <TabsContent value="command" className="mt-4 space-y-4">
            <SectionHero title="Executive command view" subtitle="Priority signals for grant reporting and field action — all clickable to source FIRs">
              <Button variant="outline" size="sm" onClick={() => openClassic({}, "Full scope")}>
                View all in scope
              </Button>
            </SectionHero>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InsightStrip title="Peak month" value={summary.peakAccidentMonth} onClick={() => openClassic({ month: summary.peakAccidentMonth }, summary.peakAccidentMonth)} />
              <InsightStrip title="Dangerous road type" value={summary.mostDangerousRoadType} onClick={() => openClassic({ roadType: summary.mostDangerousRoadType }, summary.mostDangerousRoadType)} />
              <InsightStrip title="Night share" value={derived.nightDay.total ? formatPercent((derived.nightDay.night / derived.nightDay.total) * 100) : "0%"} onClick={() => openClassic({ timeBucket: "18.00 to 21.00 (Night)" }, "Night accidents")} />
              <InsightStrip title="Reporting lag" value={`${pro.summary.averageLagHours.toFixed(1)}h`} onClick={() => openPro({ timelinessStatus: "Delayed" }, "Delayed reporting")} />
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {derived.alerts.map((alert) => (
                <Card
                  key={alert.id}
                  className={cn(
                    "cursor-pointer border-l-4 transition hover:shadow-md",
                    alert.tone === "danger" && "border-l-red-600",
                    alert.tone === "warning" && "border-l-amber-500",
                    alert.tone === "info" && "border-l-blue-600",
                    alert.tone === "success" && "border-l-emerald-600"
                  )}
                  onClick={() => {
                    if (alert.id === "hotspot" && enhanced.hotspotsLocations[0]) {
                      const h = enhanced.hotspotsLocations[0];
                      openClassic({ hotspotPlace: h.place, hotspotDistrict: h.district }, alert.title);
                    } else if (alert.id === "district" && enhanced.comparisonData[0]) {
                      comparisonClick(enhanced.comparisonData[0].name);
                    } else if (alert.id === "delayed") openPro({ timelinessStatus: "Delayed" }, alert.title);
                    else if (alert.id === "signed") openClassic({ signedCopyStatus: "Pending" }, alert.title);
                    else if (alert.id === "timeliness" && pro.districtRanking[0]) {
                      openPro({ submissionDistrict: pro.districtRanking[pro.districtRanking.length - 1]?.name }, alert.title);
                    }
                  }}
                >
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-bold text-slate-900">{alert.title}</p>
                      <p className="text-sm text-slate-600">{alert.detail}</p>
                      <p className="mt-2 text-xs font-semibold text-primary">{alert.actionLabel} →</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartPanel title="Top unified causes" description="Click any bar — driver, vehicle, or road factors">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={enhanced.causeAnalysis.slice(0, 10)}
                    onClick={getChartClickHandler<{ cause?: string; category?: string }>((p) => {
                      if (p.category?.toLowerCase().includes("driver") && p.cause) openClassic({ driverCause: p.cause }, p.cause);
                      else if (p.category?.toLowerCase().includes("vehicle") && p.cause) openClassic({ vehicleCause: p.cause }, p.cause);
                      else openClassic({}, p.cause || "Cause");
                    })}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="cause" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={70} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#163a70" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="NH · SH · MDR · Other" description="National corridor comparison — click segment">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={derived.nhSh}
                    onClick={getChartClickHandler<{ roadType?: string }>((p) => {
                      if (p.roadType) openClassic({ roadType: p.roadType }, p.roadType);
                    })}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="roadType" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="accidents" fill="#163a70" />
                    <Bar dataKey="deaths" fill="#c62828" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>
          </TabsContent>

          {/* TRENDS */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <ChartPanel title="Accident & casualty trend" description="Click month on chart" className="lg:col-span-2" height="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={enhanced.trendData}
                    onClick={(state) => {
                      const payload = getChartPayload<{ month?: string }>(state?.activePayload?.[0]);
                      if (payload?.month) openClassic({ month: payload.month }, payload.month);
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="accidents" fill="#163a70" name="Accidents" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="deaths" stroke="#c62828" strokeWidth={2} name="Deaths" />
                    <Line type="monotone" dataKey="injuries" stroke="#c75b12" strokeWidth={2} name="Injuries" />
                  </ComposedChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Severity distribution" description="Click slice">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={enhanced.severityBreakdown}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      onClick={(_, i) => {
                        const item = enhanced.severityBreakdown[i];
                        if (item) openClassic({ severity: item.name }, item.name);
                      }}
                    >
                      {enhanced.severityBreakdown.map((_, i) => (
                        <Cell key={i} fill={ANALYTICS_CHART_COLORS[i % ANALYTICS_CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ChartPanel title="Weekday pattern" description="Click day" height="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={enhanced.dayOfWeekAnalysis}
                    onClick={getChartClickHandler<{ day?: string }>((p) => p.day && openClassic({ weekday: p.day }, p.day))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="accidents" fill="#163a70" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Hourly density" description="Click hour" height="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={enhanced.timeAnalysis}
                    onClick={(state) => {
                      const payload = getChartPayload<{ hour?: string }>(state?.activePayload?.[0]);
                      if (payload?.hour) openClassic({ hour: payload.hour }, payload.hour);
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="accidents" stroke="#7a4cc2" fill="#7a4cc233" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartPanel>

              <Card className="border-slate-200 md:col-span-2">
                <CardHeader className="pb-2"><CardTitle className="text-base">Day vs night</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <div {...getInteractiveProps(() => openClassic({ timeBucket: "12.00 to 15.00 (Day)" }, "Day accidents"))}>
                    <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center">
                      <p className="text-4xl font-extrabold text-amber-900">{derived.nightDay.day}</p>
                      <p className="text-sm font-medium text-amber-800">Daytime accidents</p>
                    </div>
                  </div>
                  <div {...getInteractiveProps(() => openClassic({ timeBucket: "21.00 to 24.00 (Night)" }, "Night accidents"))}>
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-100 p-5 text-center">
                      <p className="text-4xl font-extrabold text-indigo-900">{derived.nightDay.night}</p>
                      <p className="text-sm font-medium text-indigo-800">Night-time accidents</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <ChartPanel title="Signed copy status" description="Click segment" height="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={enhanced.signedCopyAnalysis}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    onClick={(_, i) => {
                      const item = enhanced.signedCopyAnalysis[i];
                      if (item) openClassic({ signedCopyStatus: item.name === "Uploaded" ? "Uploaded" : "Pending" }, item.name);
                    }}
                  >
                    {enhanced.signedCopyAnalysis.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#138808" : "#c75b12"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartPanel>
          </TabsContent>

          {/* GEOGRAPHY */}
          <TabsContent value="geography" className="mt-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder={`Search ${enhanced.scope.comparisonLabel.toLowerCase()}…`}
                  className="pl-9"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-5 w-5" />
                    {enhanced.scope.comparisonLabel} rankings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-2">
                      {filteredComparison.slice(0, 15).map((row, i) => (
                        <RankRow
                          key={row.name}
                          rank={i + 1}
                          title={row.name}
                          metric={`${row.accidents} acc`}
                          secondary={`${row.deaths} deaths · ${row.fatalityRate.toFixed(1)}% fatal`}
                          badge={row.severity}
                          onClick={() => comparisonClick(row.name)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-5 w-5" />
                    Accident hotspots
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-2">
                      {enhanced.hotspotsLocations.slice(0, 15).map((h, i) => (
                        <RankRow
                          key={`${h.place}-${h.district}`}
                          rank={i + 1}
                          title={h.place}
                          subtitle={h.district}
                          metric={`Score ${h.riskScore}`}
                          badge={h.severity}
                          onClick={() => openClassic({ hotspotPlace: h.place, hotspotDistrict: h.district }, h.place)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartPanel title="Mandal concentration" description="Click mandal" height="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={enhanced.mandalAnalysis.slice(0, 10)}
                    onClick={getChartClickHandler<{ name?: string }>((p) => p.name && openClassic({ mandal: p.name }, p.name))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="accidents" fill="#2a7c4a" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Police station load" description="Click station" height="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={enhanced.policeStationAnalysis.slice(0, 10)}
                    onClick={getChartClickHandler<{ name?: string }>((p) => p.name && openClassic({ policeStation: p.name }, p.name))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="accidents" fill="#163a70" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Geospatial accident layer
                </CardTitle>
                <CardDescription>Scroll list to open individual FIR records</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-[1fr_280px]">
                <AccidentMap
                  accidents={enhanced.mapPoints}
                  userDistrict={enhanced.scope.district || undefined}
                  height="440px"
                  showHeatmap
                  showDistrictBoundaries
                />
                <ScrollArea className="h-[440px] rounded-xl border border-slate-200 bg-slate-50/50 p-2">
                  <div className="space-y-2">
                    {enhanced.mapPoints.slice(0, 40).map((pt) => (
                      <MapPointRow
                        key={pt.id}
                        fir={pt.fir_number}
                        place={pt.place_of_accident}
                        district={pt.district}
                        casualties={`${pt.persons_died}D / ${pt.persons_injured}I`}
                        date={pt.accident_date}
                        onClick={() => openSubmission(pt.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CAUSES */}
          <TabsContent value="causes" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartPanel title="Driver-related causes" description="Click cause bar">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={enhanced.driverCauses.slice(0, 10).map((c) => ({ ...c, short: shortenCauseLabel(c.cause) }))}
                    onClick={getChartClickHandler<{ cause?: string }>((p) => p.cause && openClassic({ driverCause: p.cause }, p.cause))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="short" type="category" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#c75b12" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Vehicle condition causes" description="Click cause bar">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={(enhanced.vehicleCauses || []).slice(0, 10).map((c) => ({ ...c, short: shortenCauseLabel(c.cause) }))}
                    onClick={getChartClickHandler<{ cause?: string }>((p) => p.cause && openClassic({ vehicleCause: p.cause }, p.cause))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="short" type="category" width={130} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#aa3d47" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartPanel title="Vehicle type mix" description="Click vehicle class">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={enhanced.vehicleAnalysis.slice(0, 10)}
                    onClick={getChartClickHandler<{ type?: string }>((p) => p.type && openClassic({ vehicleType: p.type }, p.type))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#267fa3" />
                    <Bar dataKey="deaths" fill="#c62828" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Road type casualty profile" description="Click road type">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={enhanced.roadTypeAnalysis}
                    onClick={getChartClickHandler<{ roadType?: string }>((p) => p.roadType && openClassic({ roadType: p.roadType }, p.roadType))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="roadType" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="accidents" fill="#163a70" />
                    <Bar dataKey="deaths" fill="#c62828" />
                    <Bar dataKey="injuries" fill="#c75b12" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {enhanced.roadEngineeringCauses.map((group) => (
                <Card key={group.category} className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-1 text-sm">
                      <Route className="h-4 w-4" />
                      {group.category}
                    </CardTitle>
                    <CardDescription>{group.totalIncidents} incidents</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {group.causes.slice(0, 5).map((cause) => (
                      <button
                        key={cause.name}
                        type="button"
                        className="flex w-full items-center justify-between rounded-lg border border-slate-100 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
                        onClick={() =>
                          openClassic(
                            { roadEngineeringCategory: group.category, roadEngineeringCause: cause.name },
                            cause.name
                          )
                        }
                      >
                        <span className="truncate pr-1">{shortenCauseLabel(cause.name, 18)}</span>
                        <Badge variant="secondary" className="shrink-0 text-xs">{cause.count}</Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* OPERATIONS */}
          <TabsContent value="operations" className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <KpiTile label="Delayed" value={pro.summary.delayedSubmissions} tone="warning" icon={Clock3} onClick={() => openPro({ timelinessStatus: "Delayed" }, "Delayed")} />
              <KpiTile label="Avg lag (hrs)" value={pro.summary.averageLagHours.toFixed(1)} icon={Activity} onClick={() => openPro({}, "All reporting")} />
              <KpiTile label="Active PS" value={pro.summary.activeStations} icon={Building2} onClick={() => openPro({}, "Stations")} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartPanel title="Delay bands" description="Click band">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pro.delayBands}
                    onClick={getChartClickHandler<{ band?: string }>((p) => p.band && openPro({ delayBand: p.band }, p.band))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="band" tick={{ fontSize: 9 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#267fa3" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Reporting weekday (timely vs delayed)" description="Click day — pro scope">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pro.weekdayPattern}
                    onClick={getChartClickHandler<{ day?: string }>((p) => p.day && openPro({ createdWeekday: p.day }, p.day))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="timely" stackId="a" fill="#138808" />
                    <Bar dataKey="delayed" stackId="a" fill="#c75b12" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="border-slate-200">
                <CardHeader><CardTitle className="text-sm">District timeliness</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[260px]">
                    <div className="space-y-2">
                      {pro.districtRanking.slice(0, 12).map((row, i) => (
                        <RankRow
                          key={row.name}
                          rank={i + 1}
                          title={row.name}
                          metric={`${row.timelyRate.toFixed(0)}% timely`}
                          secondary={`${row.delayedSubmissions} delayed`}
                          onClick={() => openPro({ submissionDistrict: row.name }, row.name)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader><CardTitle className="text-sm">Station timeliness</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[260px]">
                    <div className="space-y-2">
                      {pro.stationRanking.slice(0, 12).map((row, i) => (
                        <RankRow
                          key={row.name}
                          rank={i + 1}
                          title={row.name}
                          metric={`${row.timelyRate.toFixed(0)}%`}
                          onClick={() => openPro({ policeStation: row.name }, row.name)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader><CardTitle className="text-sm">Road-type reporting</CardTitle></CardHeader>
                <CardContent>
                  <ScrollArea className="h-[260px]">
                    <div className="space-y-2">
                      {pro.roadTimeliness.slice(0, 12).map((row, i) => (
                        <RankRow
                          key={row.name}
                          rank={i + 1}
                          title={row.name}
                          metric={`${row.timelyRate.toFixed(0)}%`}
                          onClick={() => openPro({ roadType: row.name }, row.name)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle>Recent delayed submissions — open FIR</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2">
                {pro.recentLateSubmissions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openSubmission(item.id)}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-primary/40 hover:shadow-sm"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{item.firNumber}</p>
                      <p className="text-xs text-slate-500">{item.district} · lag {item.lagHours}h</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-primary" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMPLIANCE */}
          <TabsContent value="compliance" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="h-5 w-5" />
                    Field completeness matrix
                  </CardTitle>
                  <CardDescription>Click any row to audit missing data in source FIRs</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {enhanced.fieldCompleteness.map((field) => (
                    <button
                      key={field.field}
                      type="button"
                      className="block w-full space-y-1.5 text-left"
                      onClick={() => openClassic({ metric: field.field }, field.field)}
                    >
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-800">{field.field}</span>
                        <span className="text-slate-600">{formatPercent(field.coverage)}</span>
                      </div>
                      <Progress value={field.coverage} className="h-2.5" />
                    </button>
                  ))}
                </CardContent>
              </Card>

              <ChartPanel title="Signed copy pipeline" description="Uploaded vs pending">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Uploaded", count: summary.signedCopyUploaded },
                      { name: "Pending", count: summary.signedCopyPending },
                    ]}
                    onClick={getChartClickHandler<{ name?: string }>((p) =>
                      openClassic({ signedCopyStatus: p.name === "Uploaded" ? "Uploaded" : "Pending" }, p.name || "")
                    )}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#138808" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            </div>
          </TabsContent>

          {/* RISK MATRIX */}
          <TabsContent value="risk" className="mt-4 space-y-4">
            <SectionHero
              title="Comparative risk matrix"
              subtitle="Volume vs casualty load — click a bubble to open that unit's submissions"
            />
            <ChartPanel title="Accidents vs deaths (bubble size = risk index)" description="Click bubble" height="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                  onClick={(state) => {
                    const payload = getChartPayload<{ name?: string }>(state?.activePayload?.[0]);
                    if (payload?.name) comparisonClick(payload.name);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="accidents" name="Accidents" />
                  <YAxis type="number" dataKey="deaths" name="Deaths" />
                  <ZAxis type="number" dataKey="riskIndex" range={[80, 400]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={derived.riskMatrix} fill="#163a70" />
                </ScatterChart>
              </ResponsiveContainer>
            </ChartPanel>

            <Card className="border-slate-200">
              <CardHeader><CardTitle>Risk-ranked units (table)</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="p-2">#</th>
                        <th className="p-2">Unit</th>
                        <th className="p-2">Accidents</th>
                        <th className="p-2">Deaths</th>
                        <th className="p-2">Injuries</th>
                        <th className="p-2">Fatality %</th>
                        <th className="p-2">Risk index</th>
                      </tr>
                    </thead>
                    <tbody>
                      {derived.riskMatrix.map((row, i) => (
                        <tr
                          key={row.name}
                          className="cursor-pointer border-b hover:bg-[#f4f7fb]"
                          onClick={() => comparisonClick(row.name)}
                        >
                          <td className="p-2 font-bold">{i + 1}</td>
                          <td className="p-2 font-medium">{row.name}</td>
                          <td className="p-2">{row.accidents}</td>
                          <td className="p-2 text-red-700">{row.deaths}</td>
                          <td className="p-2">{row.injuries}</td>
                          <td className="p-2">{row.fatalityRate.toFixed(1)}%</td>
                          <td className="p-2 font-bold">{row.riskIndex}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI */}
          <TabsContent value="insights" className="mt-4 space-y-4">
            <Card className="border-0 bg-gradient-to-br from-[#163a70] to-[#2f5d97] text-white shadow-xl">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <Brain className="h-6 w-6" />
                  <h2 className="text-xl font-bold">AI analytical assessment</h2>
                </div>
                <p className="leading-relaxed text-white/90">{enhanced.geminiInsights.overallAssessment}</p>
                <p className="text-sm text-white/75">{enhanced.geminiInsights.predictiveAnalysis}</p>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader><CardTitle className="text-base">Key findings</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {enhanced.geminiInsights.keyFindings.map((item, i) => (
                    <button
                      key={item}
                      type="button"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => openClassic({}, `Finding ${i + 1}`)}
                    >
                      {item}
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader><CardTitle className="text-base">Recommendations</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {enhanced.geminiInsights.recommendations.map((item) => (
                    <div key={item} className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-900">
                      {item}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200">
              <CardHeader><CardTitle className="text-base">Risk factors (click to explore scope)</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {enhanced.geminiInsights.riskFactors.map((factor) => (
                  <Badge
                    key={factor}
                    variant="outline"
                    className="cursor-pointer px-3 py-1 hover:bg-[#163a70] hover:text-white"
                    onClick={() => openClassic({}, factor)}
                  >
                    {factor}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AnalyticsSubmissionInspector
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        scopeFilters={inspectorScope}
        drilldownFilters={inspectorMode === "classic" ? classicFilters : proFilters}
        mode={inspectorMode}
      />
    </div>
  );
};

export default AnalyticsNew;
