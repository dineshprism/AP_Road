import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GovHeader from "@/components/GovHeader";
import AccidentMap from "@/components/AccidentMap";
import { AP_DISTRICTS, MONTHS } from "@/lib/constants";
import { Eye, Filter, RotateCcw, Download, FileText, FileDown, BarChart3, Map, MapPin } from "lucide-react";
import { exportSubmissionPDF, exportSubmissionDOCX } from "@/lib/exportReport";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Submission {
  id: string;
  district: string;
  place_of_accident: string;
  mandal: string;
  police_station: string;
  fir_number: string;
  road_type: string;
  accident_date: string;
  accident_time: string;
  lat_long?: string;
  persons_died: number;
  persons_injured: number;
  created_at: string;
  [key: string]: any;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "map">("list");

  // Filters
  const [filterDistrict, setFilterDistrict] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");

  useEffect(() => {
    fetchSubmissions();
  }, [filterDistrict, filterYear, filterMonth, filterDate]);

  const fetchSubmissions = async () => {
    setLoading(true);
    const { data } = await api.admin.submissions({
      district: filterDistrict,
      year: filterYear,
      month: filterMonth,
      date: filterDate || undefined,
    });
    setSubmissions(data || []);
    setLoading(false);
  };

  const resetFilters = () => {
    setFilterDistrict("all");
    setFilterYear(new Date().getFullYear().toString());
    setFilterMonth("all");
    setFilterDate("");
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  const totalDied = submissions.reduce((sum, s) => sum + s.persons_died, 0);
  const totalInjured = submissions.reduce((sum, s) => sum + s.persons_injured, 0);

  return (
    <div className="min-h-screen bg-background">
      <GovHeader />
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="gov-page-title mb-0">Admin Dashboard &mdash; All Submissions</h2>
          <Button 
            onClick={() => navigate("/analytics")} 
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-md flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics Dashboard
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="gov-stat-card"><div className="h-1 bg-[#132b5e]" /><CardContent className="py-4 text-center"><p className="text-3xl font-extrabold text-primary">{submissions.length}</p><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">Total Reports</p></CardContent></div>
          <div className="gov-stat-card"><div className="h-1 bg-[#c62828]" /><CardContent className="py-4 text-center"><p className="text-3xl font-extrabold text-destructive">{totalDied}</p><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">Persons Died</p></CardContent></div>
          <div className="gov-stat-card"><div className="h-1 bg-[#e8710a]" /><CardContent className="py-4 text-center"><p className="text-3xl font-extrabold text-secondary">{totalInjured}</p><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">Persons Injured</p></CardContent></div>
          <div className="gov-stat-card"><div className="h-1 bg-[#138808]" /><CardContent className="py-4 text-center"><p className="text-3xl font-extrabold text-accent">{new Set(submissions.map(s => s.district)).size}</p><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-1">Districts</p></CardContent></div>
        </div>

        {/* Filters */}
        <div className="gov-filter-panel mb-6">
          <div className="gov-filter-header flex items-center gap-2">
            <Filter className="w-5 h-5 text-[#f5a623]" />
            <span className="font-bold text-sm text-white tracking-wider uppercase">Filter Submissions</span>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <Label className="text-xs font-bold text-primary mb-1 block uppercase tracking-wide">District</Label>
                <Select value={filterDistrict} onValueChange={setFilterDistrict}>
                  <SelectTrigger className="bg-white border-border shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {AP_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold text-primary mb-1 block uppercase tracking-wide">Year</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="bg-white border-border shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold text-primary mb-1 block uppercase tracking-wide">Month</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="bg-white border-border shadow-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {MONTHS.map((m, i) => <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold text-primary mb-1 block uppercase tracking-wide">Date</Label>
                <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-white border-border shadow-sm" />
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={resetFilters} className="w-full bg-secondary hover:bg-secondary/90 text-white font-semibold shadow-md">
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs for List and Map View */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "list" | "map")} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              State Map View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Table */}
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Loading submissions...</p>
            ) : submissions.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No submissions found for the selected filters.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {submissions.map((s) => (
                  <Card key={s.id} className="hover:shadow-lg transition-all border-l-4 border-l-secondary/60 hover:border-l-secondary">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-primary">FIR: {s.fir_number}</span>
                          <Badge className="bg-primary/10 text-primary border-primary/20">{s.district}</Badge>
                          <Badge variant="outline" className="border-secondary/40 text-secondary">{s.road_type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {s.place_of_accident}, {s.mandal} — {new Date(s.accident_date).toLocaleDateString("en-IN")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Died: {s.persons_died} | Injured: {s.persons_injured} | PS: {s.police_station}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/submission/${s.id}`)}>
                          <Eye className="w-4 h-4 mr-1" /> View
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Download className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={async () => {
                              const { data } = await api.submissions.get(s.id);
                              if (data) exportSubmissionPDF(data);
                              else toast.error("Failed to load submission");
                            }}>
                              <FileDown className="w-4 h-4 mr-2" /> Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => {
                              const { data } = await api.submissions.get(s.id);
                              if (data) await exportSubmissionDOCX(data);
                              else toast.error("Failed to load submission");
                            }}>
                              <FileText className="w-4 h-4 mr-2" /> Download DOC
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">Andhra Pradesh State Accident Map</h3>
                  <p className="text-sm text-muted-foreground">
                    Comprehensive state-wide view of accident locations and hotspots across all districts
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <Badge variant="outline" className="bg-blue-50">
                      <MapPin className="w-3 h-3 mr-1" />
                      {submissions.length} Total Accidents
                    </Badge>
                    <Badge variant="outline" className="bg-red-50">
                      {totalDied} Fatalities
                    </Badge>
                    <Badge variant="outline" className="bg-orange-50">
                      {totalInjured} Injuries
                    </Badge>
                  </div>
                </div>
                <AccidentMap
                  accidents={submissions}
                  height="650px"
                  showHeatmap={true}
                  showDistrictBoundaries={true}
                  zoom={7}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
