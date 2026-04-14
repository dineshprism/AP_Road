import { type ComponentType, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import GovHeader from "@/components/GovHeader";
import AnalyticsSubmissionInspector, {
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
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Calendar as CalendarIcon,
  Clock3,
  Eye,
  FileCheck,
  MapPinned,
  RefreshCw,
  Route,
  Sparkles,
  TimerReset,
  TriangleAlert,
  TrendingUp,
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

const CHART_COLORS = {
  timely: "#1f8a70",
  delayed: "#d95d39",
  total: "#163a70",
  accent: "#c48a15",
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

function formatLagHours(value: number) {
  return `${value.toFixed(1)} hrs`;
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
      <Badge
        variant={variant}
        className={cn("rounded-full px-3 py-1 text-sm font-semibold", className)}
      >
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
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className={cn("h-1.5", accent)} />
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
            {onClick ? (
              <Button
                variant="ghost"
                className="mt-2 h-auto px-0 py-0 text-left hover:bg-transparent"
                onClick={onClick}
              >
                <span className="text-3xl font-bold tracking-tight text-slate-900">{value}</span>
                <ArrowUpRight className="ml-2 h-4 w-4 text-slate-400" />
              </Button>
            ) : (
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
            )}
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

const AnalyticsPro = () => {
  const navigate = useNavigate();
  const { user, isAdmin, roles, profile, loading: authLoading } = useAuth();
  const currentYear = new Date().getFullYear().toString();

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
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsProData | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorFilters, setInspectorFilters] = useState<AnalyticsProDrilldownFilters | null>(null);

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

  const openInspector = (nextFilters: AnalyticsProDrilldownFilters) => {
    setInspectorFilters(nextFilters);
    setInspectorOpen(true);
  };

  const fetchAnalyticsPro = async () => {
    try {
      setLoading(true);
      const { data: response, error } = await api.analytics.getAnalyticsPro(scopeFilters);
      if (error || !response) {
        toast.error(error || "Failed to load analytics pro");
        setData(null);
        return;
      }
      setData(response);
    } catch (error) {
      console.error("Failed to fetch analytics pro:", error);
      toast.error("Failed to load analytics pro");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchAnalyticsPro();
    }
  }, [authLoading, user, scopeFilters]);

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

  const rankingRows = data?.scope.viewLevel === "state" ? data.districtRanking : data?.stationRanking || [];
  const rankingTitle = data?.scope.viewLevel === "state" ? "District Timeliness Ranking" : "Police Station Timeliness Ranking";
  const rankingDescription =
    data?.scope.viewLevel === "state"
      ? "Districts are ranked by on-time submission rate, then by timely submission count and average lag."
      : "Stations are ranked by on-time submission rate within the selected district submission window.";
  const topPerformer = rankingRows[0];
  const watchlistPerformer = [...rankingRows].reverse()[0];

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f7fafe_0%,#edf3fb_100%)]">
        <GovHeader />
        <div className="container mx-auto px-4 py-10">
          <Card className="border-slate-200">
            <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4">
              <RefreshCw className="h-9 w-9 animate-spin text-primary" />
              <p className="text-lg font-semibold text-slate-900">Loading Analytics Pro</p>
              <p className="text-sm text-slate-500">Preparing timeliness rankings and connected submission drilldowns.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) {
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
                <Button onClick={() => void fetchAnalyticsPro()}>Retry</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef6ff_0%,transparent_36%),radial-gradient(circle_at_top_right,#fff5e8_0%,transparent_24%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_52%,#f7fbff_100%)]">
      <GovHeader />

      <div className="sticky top-[86px] z-40 border-b border-slate-200 bg-white/85 shadow-sm backdrop-blur">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => navigate(goBack)} className="bg-white shadow-sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button variant="outline" onClick={() => navigate("/analytics")} className="bg-white shadow-sm">
              <BarChart3 className="mr-2 h-4 w-4" />
              Classic Analytics
            </Button>
            <Button className="bg-[#163a70] text-white hover:bg-[#214b85]">
              <Sparkles className="mr-2 h-4 w-4" />
              Analytics Pro
            </Button>
          </div>

          <p className="text-xs font-medium text-slate-500">
            Every visible count on this page can open its related submissions.
          </p>
        </div>
      </div>

      <div className="container mx-auto space-y-6 px-4 py-6">
        <Card className="overflow-hidden border-slate-200 shadow-[0_24px_64px_-38px_rgba(15,23,42,0.45)]">
          <div className="bg-[linear-gradient(135deg,#0f274d_0%,#173c73_55%,#2b5c8f_100%)] px-6 py-6 text-white">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-white/20 bg-white/10 text-white">Submission Ops Mode</Badge>
                  <Badge variant="outline" className="border-white/25 text-white">{data.scope.scopeLabel}</Badge>
                  <Badge variant="outline" className="border-white/25 text-white">{data.scope.rangeStart} to {data.scope.rangeEnd}</Badge>
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Analytics Pro</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">
                    A smoother command view focused on submission timeliness, operational ranking, and direct case drilldowns from every important count.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[24px] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">Top Performer</p>
                    <p className="mt-2 text-lg font-semibold text-white">{topPerformer?.name || "Not available"}</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {topPerformer ? `${formatPercent(topPerformer.timelyRate)} on-time submissions` : "No ranked unit available"}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">Watchlist Unit</p>
                    <p className="mt-2 text-lg font-semibold text-white">{watchlistPerformer?.name || "Not available"}</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {watchlistPerformer ? `${formatPercent(watchlistPerformer.timelyRate)} on-time rate` : "No delayed pattern found"}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">Scope</p>
                    <p className="mt-2 text-lg font-semibold text-white">{data.scope.viewLevel === "state" ? "State Ranking" : "District Control"}</p>
                    <p className="mt-1 text-sm text-slate-200">Filters use submission creation dates for this workspace.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/15 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Filter Window</p>
                    <p className="mt-1 text-xs text-slate-200">Refine the submission monitoring range.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => void fetchAnalyticsPro()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
                  <div>
                    <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-200">District</Label>
                    <Select
                      value={isAdmin ? filters.district : data.scope.district || profile?.district || "all"}
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
                      disabled={Boolean(filters.fromDate || filters.toDate)}
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
                        <Button
                          variant="outline"
                          className="h-11 w-full justify-start border-white/20 bg-white/10 px-3 text-left font-normal text-white hover:bg-white/20"
                        >
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
                        <Button
                          variant="outline"
                          className="h-11 w-full justify-start border-white/20 bg-white/10 px-3 text-left font-normal text-white hover:bg-white/20"
                        >
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
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Apply Filters
                  </Button>
                  {(filters.fromDate || filters.toDate) && (
                    <Button
                      variant="outline"
                      className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                      onClick={() => {
                        const cleared = {
                          district: isAdmin ? filters.district : profile?.district || filters.district,
                          year: currentYear,
                          fromDate: "",
                          toDate: "",
                        };
                        setFilters(cleared);
                        setAppliedFilters(cleared);
                      }}
                    >
                      Clear Custom Range
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Total Submissions"
            value={compact(data.summary.totalSubmissions)}
            description="All submissions created in the selected monitoring window."
            accent="bg-red-500"
            icon={BarChart3}
            onClick={() => openInspector({})}
          />
          <MetricCard
            title="Timely Submissions"
            value={compact(data.summary.timelySubmissions)}
            description="Submitted within 24 hours of the recorded accident time."
            accent="bg-emerald-500"
            icon={TimerReset}
            onClick={() => openInspector({ timelinessStatus: "Timely" })}
          />
          <MetricCard
            title="Delayed Submissions"
            value={compact(data.summary.delayedSubmissions)}
            description="Cases submitted after the first 24-hour response window."
            accent="bg-orange-500"
            icon={TriangleAlert}
            onClick={() => openInspector({ timelinessStatus: "Delayed" })}
          />
          <MetricCard
            title="Timely Rate"
            value={formatPercent(data.summary.timelyRate)}
            description="The on-time share currently achieved by the filtered submission pool."
            accent="bg-blue-700"
            icon={TrendingUp}
          />
          <MetricCard
            title="Average Submission Lag"
            value={formatLagHours(data.summary.averageLagHours)}
            description="Average time taken to submit after the accident date and time."
            accent="bg-amber-500"
            icon={Clock3}
          />
          <MetricCard
            title="Signed Copy Pending"
            value={compact(data.summary.signedCopyPending)}
            description="Submissions still waiting for the signed supporting record."
            accent="bg-slate-700"
            icon={FileCheck}
            onClick={() => openInspector({ signedCopyStatus: "Pending" })}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-white/80">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <CardTitle className="text-xl text-slate-900">{rankingTitle}</CardTitle>
                  <CardDescription className="mt-2 text-slate-600">{rankingDescription}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    {data.scope.viewLevel === "state" ? `${compact(data.summary.districtsCovered)} districts` : `${compact(data.summary.activeStations)} stations`}
                  </Badge>
                  <Badge variant="outline" className="border-slate-300 text-slate-700">
                    Click any count to inspect its submissions
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-[78px_1.4fr_repeat(3,120px)_120px_132px] gap-0 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <div>Rank</div>
                <div>{data.scope.viewLevel === "state" ? "District" : "Station"}</div>
                <div>Total</div>
                <div>Timely</div>
                <div>Delayed</div>
                <div>Timely %</div>
                <div>Avg Lag</div>
              </div>
              <div className="space-y-0">
                {rankingRows.slice(0, 12).map((row, index) => (
                  <div
                    key={row.name}
                    className="grid grid-cols-[78px_1.4fr_repeat(3,120px)_120px_132px] gap-0 border-b border-slate-100 px-4 py-4 last:border-b-0"
                  >
                    <div className="flex items-center">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-800">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="pr-4">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {compact(row.deaths)} deaths • {compact(row.injuries)} injuries
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 h-2.5 rounded-full bg-slate-100">
                        <div
                          className="h-2.5 rounded-full bg-[linear-gradient(90deg,#1f8a70_0%,#2ca58d_100%)]"
                          style={{ width: `${Math.max(6, row.timelyRate)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center">
                      <CountBadgeButton
                        value={row.totalSubmissions}
                        variant="outline"
                        className="border-slate-300 bg-white text-slate-800"
                        onClick={() =>
                          openInspector(
                            data.scope.viewLevel === "state"
                              ? { submissionDistrict: row.name }
                              : { policeStation: row.name }
                          )
                        }
                      />
                    </div>
                    <div className="flex items-center">
                      <CountBadgeButton
                        value={row.timelySubmissions}
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        onClick={() =>
                          openInspector(
                            data.scope.viewLevel === "state"
                              ? { submissionDistrict: row.name, timelinessStatus: "Timely" }
                              : { policeStation: row.name, timelinessStatus: "Timely" }
                          )
                        }
                      />
                    </div>
                    <div className="flex items-center">
                      <CountBadgeButton
                        value={row.delayedSubmissions}
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-rose-700"
                        onClick={() =>
                          openInspector(
                            data.scope.viewLevel === "state"
                              ? { submissionDistrict: row.name, timelinessStatus: "Delayed" }
                              : { policeStation: row.name, timelinessStatus: "Delayed" }
                          )
                        }
                      />
                    </div>
                    <div className="flex items-center text-sm font-semibold text-slate-900">{formatPercent(row.timelyRate)}</div>
                    <div className="flex items-center text-sm font-semibold text-slate-900">{formatLagHours(row.averageLagHours)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Submission Cadence</CardTitle>
                <CardDescription>Monthly creation trend split into timely and delayed submissions.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.submissionCadence}>
                    <defs>
                      <linearGradient id="timelyFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.timely} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={CHART_COLORS.timely} stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="delayedFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.delayed} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_COLORS.delayed} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" stroke="#64748b" />
                    <YAxis stroke="#64748b" allowDecimals={false} />
                    <RechartsTooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="timely"
                      stroke={CHART_COLORS.timely}
                      fill="url(#timelyFill)"
                      strokeWidth={2.5}
                      name="Timely"
                    />
                    <Area
                      type="monotone"
                      dataKey="delayed"
                      stroke={CHART_COLORS.delayed}
                      fill="url(#delayedFill)"
                      strokeWidth={2.5}
                      name="Delayed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.submissionCadence.map((bucket) => (
                    <Button
                      key={bucket.key}
                      size="sm"
                      variant="outline"
                      className="rounded-full border-slate-300 bg-white text-slate-700"
                      onClick={() => openInspector({ createdMonth: bucket.key })}
                    >
                      {bucket.label}: {compact(bucket.total)}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Delay Bands</CardTitle>
                <CardDescription>Where the current backlog is sitting across delay windows.</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.delayBands} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" allowDecimals={false} />
                    <YAxis dataKey="band" type="category" width={130} stroke="#64748b" />
                    <RechartsTooltip />
                    <Bar
                      dataKey="count"
                      fill={CHART_COLORS.delayed}
                      radius={[0, 12, 12, 0]}
                      onClick={(payload: any) => openInspector({ delayBand: payload.band })}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Road-Type Timeliness</CardTitle>
              <CardDescription>Shows which road categories are responding faster and which ones need escalation.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.roadTimeliness.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" angle={-18} textAnchor="end" height={72} />
                  <YAxis stroke="#64748b" allowDecimals={false} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar
                    dataKey="timelySubmissions"
                    fill={CHART_COLORS.timely}
                    name="Timely"
                    radius={[6, 6, 0, 0]}
                    onClick={(payload: any) => openInspector({ roadType: payload.name, timelinessStatus: "Timely" })}
                  />
                  <Bar
                    dataKey="delayedSubmissions"
                    fill={CHART_COLORS.delayed}
                    name="Delayed"
                    radius={[6, 6, 0, 0]}
                    onClick={(payload: any) => openInspector({ roadType: payload.name, timelinessStatus: "Delayed" })}
                  />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-5 space-y-3">
                {data.roadTimeliness.slice(0, 6).map((row) => (
                  <div key={row.name} className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatPercent(row.timelyRate)} on-time • {formatLagHours(row.averageLagHours)} avg lag</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <CountBadgeButton value={row.totalSubmissions} variant="outline" onClick={() => openInspector({ roadType: row.name })} />
                        <CountBadgeButton
                          value={row.timelySubmissions}
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          onClick={() => openInspector({ roadType: row.name, timelinessStatus: "Timely" })}
                        />
                        <CountBadgeButton
                          value={row.delayedSubmissions}
                          variant="outline"
                          className="border-rose-200 bg-rose-50 text-rose-700"
                          onClick={() => openInspector({ roadType: row.name, timelinessStatus: "Delayed" })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Weekday Submission Pattern</CardTitle>
              <CardDescription>Operational rhythm of timely and delayed submissions across the week.</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={data.weekdayPattern}>
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
                    onClick={(payload: any) => openInspector({ createdWeekday: payload.day, timelinessStatus: "Timely" })}
                  />
                  <Bar
                    dataKey="delayed"
                    fill={CHART_COLORS.delayed}
                    name="Delayed"
                    radius={[6, 6, 0, 0]}
                    onClick={(payload: any) => openInspector({ createdWeekday: payload.day, timelinessStatus: "Delayed" })}
                  />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.weekdayPattern.map((row) => (
                  <div key={row.day} className="rounded-[24px] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{row.day}</p>
                        <p className="mt-1 text-xs text-slate-500">{compact(row.total)} total submissions</p>
                      </div>
                      <Badge variant="outline" className="border-slate-300 text-slate-700">{formatPercent(row.total > 0 ? (row.timely / row.total) * 100 : 0)}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <CountBadgeButton
                        value={row.timely}
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                        onClick={() => openInspector({ createdWeekday: row.day, timelinessStatus: "Timely" })}
                      />
                      <CountBadgeButton
                        value={row.delayed}
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-rose-700"
                        onClick={() => openInspector({ createdWeekday: row.day, timelinessStatus: "Delayed" })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Operational Snapshot</CardTitle>
              <CardDescription>Quick reading for the current submission monitoring scope.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[26px] border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <MapPinned className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Districts Covered</p>
                    <p className="mt-1 text-xs text-slate-500">Units contributing submissions in the selected range.</p>
                  </div>
                </div>
                <p className="mt-4 text-2xl font-bold text-slate-900">{compact(data.summary.districtsCovered)}</p>
              </div>

              <div className="rounded-[26px] border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Route className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Active Stations</p>
                    <p className="mt-1 text-xs text-slate-500">Stations currently represented in the filtered submissions.</p>
                  </div>
                </div>
                <p className="mt-4 text-2xl font-bold text-slate-900">{compact(data.summary.activeStations)}</p>
              </div>

              <div className="rounded-[26px] border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FileCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Signed Copy Uploaded</p>
                    <p className="mt-1 text-xs text-slate-500">Supporting documents already attached to submissions.</p>
                  </div>
                </div>
                <div className="mt-4">
                  <CountBadgeButton
                    value={data.summary.signedCopyUploaded}
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                    onClick={() => openInspector({ signedCopyStatus: "Uploaded" })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Late Submission Watchlist</CardTitle>
              <CardDescription>The most delayed records in the current window, ready for immediate review or AI analysis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentLateSubmissions.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-14 text-center text-slate-500">
                  No delayed submissions are present in the current selection.
                </div>
              )}

              {data.recentLateSubmissions.map((submission) => (
                <div key={submission.id} className="rounded-[24px] border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{submission.firNumber}</p>
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200">{submission.delayBand}</Badge>
                        <Badge variant="outline" className="border-slate-300 text-slate-700">{submission.district}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{submission.placeOfAccident}, {submission.policeStation}</p>
                      <p className="mt-1 text-xs text-slate-500">{submission.createdAt ? formatDateLabel(submission.createdAt.slice(0, 10)) : ""}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-slate-300 text-slate-700">{formatLagHours(submission.lagHours)}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openInspector({ submissionDistrict: submission.district, timelinessStatus: "Delayed" })}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Related
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        onClick={() => openInspector({ submissionDistrict: submission.district, timelinessStatus: "Delayed" })}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Investigate
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <AnalyticsSubmissionInspector
          open={inspectorOpen}
          onOpenChange={setInspectorOpen}
          scopeFilters={scopeFilters}
          drilldownFilters={inspectorFilters}
        />
      </div>
    </div>
  );
};

export default AnalyticsPro;
