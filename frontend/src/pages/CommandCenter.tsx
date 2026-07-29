import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import GovHeader from "@/components/GovHeader";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { AP_DISTRICTS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  Brain,
  Gauge,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

interface CommandCenterData {
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
    averageFatalityRate: number;
    peakAccidentHour: string;
    peakAccidentMonth: string;
    mostDangerousRoadType: string;
    signedCopyUploaded: number;
    signedCopyPending: number;
  };
  comparisonData: Array<{
    name: string;
    accidents: number;
    deaths: number;
    injuries: number;
    fatalityRate: number;
    severity: string;
  }>;
  hotspotsLocations: Array<{
    place: string;
    district: string;
    accidents: number;
    deaths: number;
    injured: number;
    severity: string;
    riskScore: number;
  }>;
  driverCauses: Array<{
    cause: string;
    count: number;
    percentage: number;
    severity: "high" | "medium" | "low";
  }>;
  fieldCompleteness: Array<{
    field: string;
    available: number;
    missing: number;
    coverage: number;
  }>;
  geminiInsights: {
    overallAssessment: string;
    keyFindings: string[];
    recommendations: string[];
    predictiveAnalysis: string;
    riskFactors: string[];
  };
}

function compact(value: number) {
  return new Intl.NumberFormat("en-IN").format(value);
}

function percent(value: number, multiply = false) {
  const actual = multiply ? value * 100 : value;
  return `${actual.toFixed(1)}%`;
}

const CommandCenter = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const currentYear = new Date().getFullYear().toString();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      toast.error("Please login to access the AI command center");
    }
  }, [authLoading, navigate, user]);

  useEffect(() => {
    if (!isAdmin && profile?.district) {
      setFilters((prev) => ({ ...prev, district: profile.district }));
      setAppliedFilters((prev) => ({ ...prev, district: profile.district }));
    }
  }, [isAdmin, profile?.district]);

  useEffect(() => {
    if (!authLoading && user) {
      void fetchData();
    }
  }, [authLoading, user, appliedFilters]);

  const fetchData = async () => {
    setLoading(true);
    const { data: response, error } = await api.analytics.getEnhancedAnalytics(appliedFilters);

    if (error || !response) {
      toast.error(error || "Failed to load AI command center");
      setLoading(false);
      return;
    }

    setData(response);
    setLoading(false);
  };

  const readiness = useMemo(() => {
    if (!data?.fieldCompleteness?.length) return 0;
    return data.fieldCompleteness.reduce((sum, item) => sum + item.coverage, 0) / data.fieldCompleteness.length;
  }, [data]);

  const topHotspot = data?.hotspotsLocations?.[0];
  const topUnit = data?.comparisonData?.[0];
  const topCause = data?.driverCauses?.[0];
  const weakestField = data?.fieldCompleteness?.length
    ? [...data.fieldCompleteness].sort((left, right) => left.coverage - right.coverage)[0]
    : null;

  const actionCards = data
    ? [
        {
          title: "Deploy a hotspot response visit",
          body: topHotspot
            ? `${topHotspot.place}, ${topHotspot.district} is the highest-priority hotspot with ${topHotspot.accidents} accidents and ${topHotspot.deaths} deaths.`
            : "Use the hotspot watchlist to identify the highest-priority corridor.",
          owner: data.scope.viewLevel === "state" ? "District SP + Roads team" : "Local enforcement team",
        },
        {
          title: "Target the dominant driver behavior",
          body: topCause
            ? `"${topCause.cause}" appears most often in the current records and should drive the next awareness and enforcement push.`
            : "Review the leading driver causes and convert them into a focused campaign.",
          owner: "Traffic enforcement cell",
        },
        {
          title: "Improve decision quality by fixing weak data capture",
          body: weakestField
            ? `${weakestField.field} has only ${percent(weakestField.coverage)} coverage, so improving it will directly strengthen the AI briefings.`
            : "Review field completeness and raise reporting discipline.",
          owner: "District nodal officer",
        },
      ]
    : [];

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <GovHeader />
        <div className="container mx-auto px-4 py-10">
          <Card className="border-slate-800 bg-slate-900 text-white">
            <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4">
              <RefreshCw className="h-10 w-10 animate-spin text-cyan-300" />
              <p className="text-lg font-semibold">Preparing AI command center</p>
              <p className="text-sm text-slate-400">Loading operational signals and briefing notes.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950">
        <GovHeader />
        <div className="container mx-auto px-4 py-10">
          <Card className="border-red-900/50 bg-red-950/40 text-red-100">
            <CardContent className="py-10">
              <p className="text-lg font-semibold">The AI command center could not load.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#17345f_0%,#08111f_44%,#04070d_100%)] text-white">
      <GovHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 overflow-hidden rounded-3xl border border-cyan-500/20 bg-slate-950/70 shadow-2xl backdrop-blur">
          <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.45fr_0.95fr] lg:px-8">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100">
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  YC RFS: AI for Government
                </Badge>
                <Badge className="border-white/10 bg-white/10 text-white">
                  {data.scope.scopeLabel}
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">RoadSafe AI Command Center</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                A government copilot that turns accident submissions into executive briefings, hotspot priorities,
                and action-ready interventions for officers.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Peak Hour</p>
                  <p className="mt-2 text-xl font-bold">{data.summary.peakAccidentHour}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Top Risk Road</p>
                  <p className="mt-2 text-xl font-bold">{data.summary.mostDangerousRoadType}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Data Readiness</p>
                  <p className="mt-2 text-xl font-bold">{percent(readiness)}</p>
                </div>
              </div>
            </div>

            <Card className="border-white/10 bg-white/5 text-white shadow-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Mission Filters</CardTitle>
                <CardDescription className="text-slate-400">
                  Set the exact operational view you want to demo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-300">District</Label>
                  <Select
                    value={isAdmin ? filters.district : data.scope.district || profile?.district || "all"}
                    onValueChange={(value) => setFilters((prev) => ({ ...prev, district: value }))}
                    disabled={!isAdmin}
                  >
                    <SelectTrigger className="mt-2 border-white/10 bg-slate-900/70 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Districts</SelectItem>
                      {AP_DISTRICTS.map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-300">Year</Label>
                  <Select value={filters.year} onValueChange={(value) => setFilters((prev) => ({ ...prev, year: value }))}>
                    <SelectTrigger className="mt-2 border-white/10 bg-slate-900/70 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 5 }, (_, index) => (new Date().getFullYear() - index).toString()).map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-300">From Date</Label>
                    <Input type="date" value={filters.fromDate} onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))} className="mt-2 border-white/10 bg-slate-900/70 text-white" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-300">To Date</Label>
                    <Input type="date" value={filters.toDate} onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))} className="mt-2 border-white/10 bg-slate-900/70 text-white" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-cyan-400 text-slate-950 hover:bg-cyan-300" onClick={() => setAppliedFilters(filters)}>
                    <Brain className="mr-2 h-4 w-4" />
                    Generate Briefing
                  </Button>
                  <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={() => void fetchData()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-red-500/15 bg-white/5 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Accidents</p>
                  <p className="mt-2 text-3xl font-bold">{compact(data.summary.totalAccidents)}</p>
                </div>
                <AlertTriangle className="h-9 w-9 text-red-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-500/15 bg-white/5 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Deaths</p>
                  <p className="mt-2 text-3xl font-bold">{compact(data.summary.totalDeaths)}</p>
                </div>
                <Target className="h-9 w-9 text-orange-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/15 bg-white/5 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fatality Rate</p>
                  <p className="mt-2 text-3xl font-bold">{percent(data.summary.averageFatalityRate, true)}</p>
                </div>
                <Gauge className="h-9 w-9 text-blue-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/15 bg-white/5 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Signed Copies</p>
                  <p className="mt-2 text-3xl font-bold">{compact(data.summary.signedCopyUploaded)}</p>
                </div>
                <ShieldCheck className="h-9 w-9 text-emerald-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
          <Card className="border-white/10 bg-slate-950/70 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-cyan-300" />
                Executive Briefing
              </CardTitle>
              <CardDescription className="text-slate-400">
                AI-generated summary for the selected government scope
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-5">
                <p className="text-sm leading-7 text-slate-100">{data.geminiInsights.overallAssessment}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Key Findings</p>
                  <div className="mt-3 space-y-2">
                    {data.geminiInsights.keyFindings.slice(0, 4).map((item, index) => (
                      <div key={`${item}-${index}`} className="rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2 text-sm text-slate-200">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Risk Outlook</p>
                  <p className="mt-3 text-sm leading-7 text-slate-200">{data.geminiInsights.predictiveAnalysis}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {data.geminiInsights.riskFactors.slice(0, 4).map((item) => (
                      <Badge key={item} className="border-amber-400/20 bg-amber-400/10 text-amber-100">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-slate-950/70 text-white">
            <CardHeader>
              <CardTitle className="text-xl">Government Action Queue</CardTitle>
              <CardDescription className="text-slate-400">
                Concrete next steps that officers can act on immediately
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionCards.map((item, index) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <Badge className="border-white/10 bg-white/10 text-white">Action {index + 1}</Badge>
                    <span className="text-xs uppercase tracking-wide text-cyan-200">{item.owner}</span>
                  </div>
                  <p className="mt-3 text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-red-300" />
                Hotspot Watchlist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.hotspotsLocations.slice(0, 5).map((hotspot) => (
                <div key={`${hotspot.place}-${hotspot.district}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{hotspot.place}</p>
                      <p className="mt-1 text-sm text-slate-400">{hotspot.district}</p>
                    </div>
                    <Badge className="border-red-400/20 bg-red-400/10 text-red-100">{hotspot.severity}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-white/5 px-2 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Risk</p>
                      <p className="mt-1 text-lg font-bold">{hotspot.riskScore}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 px-2 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Accidents</p>
                      <p className="mt-1 text-lg font-bold">{hotspot.accidents}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 px-2 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Deaths</p>
                      <p className="mt-1 text-lg font-bold">{hotspot.deaths}</p>
                    </div>
                    <div className="rounded-xl bg-white/5 px-2 py-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Injuries</p>
                      <p className="mt-1 text-lg font-bold">{hotspot.injured}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-cyan-300" />
                Operational Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Top {data.scope.comparisonLabel}</p>
                <p className="mt-2 text-lg font-bold">{topUnit?.name || "N/A"}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {topUnit ? `${topUnit.accidents} accidents and ${percent(topUnit.fatalityRate)} fatality rate` : "No comparison data available"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Weakest Data Field</p>
                <p className="mt-2 text-lg font-bold">{weakestField?.field || "N/A"}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {weakestField ? `${percent(weakestField.coverage)} coverage in current records` : "No completeness data available"}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Top Driver Cause</p>
                <p className="mt-2 text-lg font-bold">{topCause?.cause || "N/A"}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {topCause ? `${topCause.count} linked records` : "No driver cause data available"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="bg-white text-slate-950 hover:bg-slate-200" onClick={() => navigate("/enhanced-analytics")}>
                  Open Full Analytics
                </Button>
                <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={() => navigate("/admin")}>
                  Open Ops Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CommandCenter;
