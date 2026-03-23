import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import GovHeader from "@/components/GovHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AP_DISTRICTS, MONTHS } from "@/lib/constants";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart,
  ScatterChart, Scatter
} from "recharts";
import {
  AlertTriangle, TrendingUp, Users, Heart, Activity, MapPin,
  Trophy, DownloadCloud, RotateCcw, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface AnalyticsData {
  summary: {
    totalAccidents: number;
    totalDeaths: number;
    totalInjuries: number;
    averageDeathsPerAccident: number;
    averageFatalityRate: number;
  };
  trendData: Array<{
    month: string;
    accidents: number;
    deaths: number;
    injuries: number;
  }>;
  causeAnalysis: Array<{
    cause: string;
    count: number;
    percentage: number;
  }>;
  districtComparison: Array<{
    district: string;
    accidents: number;
    deaths: number;
    injuries: number;
    deathRate: number;
  }>;
  roadTypeAnalysis: Array<{
    roadType: string;
    accidents: number;
    deaths: number;
  }>;
  hotspotsLocations: Array<{
    place: string;
    district: string;
    accidents: number;
    deaths: number;
    injured: number;
  }>;
  driverCauses: Array<{
    cause: string;
    count: number;
  }>;
  vehicleCauses: Array<{
    cause: string;
    count: number;
  }>;
  roadConditionCauses: Array<{
    cause: string;
    count: number;
  }>;
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e", "#06b6d4", "#0ea5e9", "#6366f1"];

const Analytics = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());

  // Auth check and redirect
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate("/auth");
        toast.error("Please login to access analytics");
        return;
      }
      if (!isAdmin) {
        navigate("/dashboard");
        toast.error("Admin access required");
        return;
      }
    }
  }, [authLoading, user, isAdmin, navigate]);

  // Fetch analytics when auth is ready
  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      fetchAnalytics();
    }
  }, [filterDistrict, filterYear, authLoading, user, isAdmin]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const { data, error } = await api.analytics.getAnalytics({
        district: filterDistrict,
        year: filterYear,
      });
      if (error) {
        toast.error(error);
      } else {
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <GovHeader />
        <div className="container mx-auto px-4 py-6 flex items-center justify-center">
          <Activity className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-background">
        <GovHeader />
        <div className="container mx-auto px-4 py-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-700">No analytics data available</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <GovHeader />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Road Safety Analytics</h1>
            <p className="text-slate-600">
              Real-time analysis of accident patterns and safety metrics
            </p>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mt-4 md:mt-0">
            <div className="w-40">
              <Label htmlFor="district-filter" className="text-sm font-medium mb-2 block">
                District
              </Label>
              <Select value={filterDistrict} onValueChange={setFilterDistrict}>
                <SelectTrigger id="district-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Districts</SelectItem>
                  {AP_DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-32">
              <Label htmlFor="year-filter" className="text-sm font-medium mb-2 block">
                Year
              </Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger id="year-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={fetchAnalytics} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="border-l-4 border-l-red-500 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Accidents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">
                    {analyticsData.summary.totalAccidents}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Incidents recorded</p>
                </div>
                <AlertTriangle className="w-10 h-10 text-red-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-600 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Deaths</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">
                    {analyticsData.summary.totalDeaths}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Lives lost</p>
                </div>
                <Heart className="w-10 h-10 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Total Injuries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">
                    {analyticsData.summary.totalInjuries}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">People injured</p>
                </div>
                <Users className="w-10 h-10 text-yellow-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Avg Deaths/Accident</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">
                    {analyticsData.summary.averageDeathsPerAccident.toFixed(2)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Per incident</p>
                </div>
                <TrendingUp className="w-10 h-10 text-purple-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-600 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">Fatality Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-3xl font-bold text-slate-900">
                    {(analyticsData.summary.averageFatalityRate * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Death rate</p>
                </div>
                <Zap className="w-10 h-10 text-red-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Trend Chart */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Accident Trends</CardTitle>
              <CardDescription>Accidents, deaths & injuries over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={analyticsData.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="accidents" fill="#ef4444" name="Accidents" />
                  <Line type="monotone" dataKey="deaths" stroke="#ea580c" name="Deaths" strokeWidth={2} />
                  <Line type="monotone" dataKey="injuries" stroke="#eab308" name="Injuries" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* District Comparison */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Top Districts by Accidents</CardTitle>
              <CardDescription>Districts with highest accident count</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={analyticsData.districtComparison.sort((a, b) => b.accidents - a.accidents).slice(0, 8)}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" />
                  <YAxis dataKey="district" type="category" width={100} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="accidents" fill="#ef4444" name="Accidents" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Road Type Analysis */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Accidents by Road Type</CardTitle>
              <CardDescription>Breakdown by road classification</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={analyticsData.roadTypeAnalysis}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="accidents"
                  >
                    {analyticsData.roadTypeAnalysis.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Driver Causes */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Driver-Related Causes</CardTitle>
              <CardDescription>Top factors involving drivers</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analyticsData.driverCauses.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="cause" angle={-45} textAnchor="end" height={80} stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="#f97316" name="Incidents" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Road Condition Causes */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Road Condition Issues</CardTitle>
              <CardDescription>Infrastructure-related causes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={analyticsData.roadConditionCauses.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="cause" angle={-45} textAnchor="end" height={80} stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="#06b6d4" name="Incidents" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Hotspots Table */}
        <Card className="shadow-lg mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Accident Hotspots
            </CardTitle>
            <CardDescription>Locations with multiple incidents - priority intervention areas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Location</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">District</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Incidents</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Deaths</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Injuries</th>
                    <th className="text-center py-3 px-4 font-semibold text-slate-700">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.hotspotsLocations.slice(0, 10).map((hotspot, idx) => {
                    const severity = hotspot.deaths / hotspot.accidents > 0.5 ? "Critical" : hotspot.deaths / hotspot.accidents > 0.2 ? "High" : "Medium";
                    const severityColor = severity === "Critical" ? "bg-red-100 text-red-800" : severity === "High" ? "bg-orange-100 text-orange-800" : "bg-yellow-100 text-yellow-800";

                    return (
                      <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-slate-900 font-medium">{hotspot.place}</td>
                        <td className="py-3 px-4 text-slate-600">{hotspot.district}</td>
                        <td className="py-3 px-4 text-center text-slate-900 font-semibold">{hotspot.accidents}</td>
                        <td className="py-3 px-4 text-center text-red-600 font-semibold">{hotspot.deaths}</td>
                        <td className="py-3 px-4 text-center text-yellow-600 font-semibold">{hotspot.injured}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={severityColor}>{severity}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex justify-center pb-8">
          <p className="text-slate-600 text-sm">
            Last updated: {new Date().toLocaleString("en-IN")} | Data is refreshed hourly
          </p>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
