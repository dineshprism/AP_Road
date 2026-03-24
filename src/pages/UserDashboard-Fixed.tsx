import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GovHeader from "@/components/GovHeader";
import AccidentMap from "@/components/AccidentMap";
import AccidentChat from "@/components/AccidentChat";
import { FilePlus, FileText, Eye, Download, FileDown, Calendar, Map, MapPin, Brain, Bot } from "lucide-react";
import { exportSubmissionPDF, exportSubmissionDOCX } from "@/lib/exportReport";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DISTRICT_HIERARCHY } from "@/lib/districtHierarchy";

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
  lat_long: string;
  persons_died: number;
  persons_injured: number;
  vehicles: string;
  drivers: string;
  driver_related_causes: string;
  vehicle_condition_causes: string;
  road_engineering_nature: string;
  road_engineering_junctions: string;
  road_engineering_signages: string;
  road_engineering_median: string;
  road_engineering_culverts: string;
  created_at: string;
}

type DateRange = "all" | "1m" | "3m" | "6m" | "1y" | "custom";

function getDateFromRange(range: DateRange, customFrom?: string, customTo?: string): Date | null {
  if (range === "custom") {
    if (customFrom) return new Date(customFrom);
    return null;
  }
  const d = new Date();
  if (range === "1m") d.setMonth(d.getMonth() - 1);
  else if (range === "3m") d.setMonth(d.getMonth() - 3);
  else if (range === "6m") d.setMonth(d.getMonth() - 6);
  else if (range === "1y") d.setFullYear(d.getFullYear() - 1);
  else return null;
  return d;
}

const UserDashboard = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"menu" | "list" | "map">("menu");
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatSubmissions, setChatSubmissions] = useState<Submission[]>([]);

  // Filters
  const district = profile?.district || "";
  const [selectedSdpo, setSelectedSdpo] = useState("");
  const [selectedPs, setSelectedPs] = useState("");

  // Date range filter for past submissions
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // List view filters
  const [listSdpo, setListSdpo] = useState("__all__");
  const [listPs, setListPs] = useState("__all__");

  // Get hierarchy for current district
  const hierarchy = DISTRICT_HIERARCHY[district] || {};
  const sdpoList = Object.keys(hierarchy);
  const listPsOptions = listSdpo && listSdpo !== "__all__"
    ? (hierarchy[listSdpo] || [])
    : [];

  const filteredSubmissions = useMemo(() => {
    let result = submissions.filter((s) => s.district === district);
    
    // Apply list view filters
    if (listSdpo && listSdpo !== "__all__") {
      result = result.filter((s) => s.police_station === listPs || listPs === "__all__");
      if (listPs && listPs !== "__all__") {
        result = result.filter((s) => s.police_station === listPs);
      }
    }
    
    // Apply date range filter
    if (dateRange !== "all") {
      const from = getDateFromRange(dateRange, customFrom, customTo);
      if (from) {
        const fromStr = from.toISOString().split('T')[0];
        result = result.filter((s) => s.accident_date >= fromStr);
      }
      if (dateRange === "custom" && customTo) {
        const to = new Date(customTo);
        const toStr = to.toISOString().split('T')[0];
        result = result.filter((s) => s.accident_date <= toStr);
      }
    }
    return result;
  }, [submissions, listSdpo, listPs, dateRange, customFrom, customTo, district]);

  useEffect(() => {
    if (user) fetchSubmissions();
  }, [user]);

  const fetchSubmissions = async () => {
    const { data } = await api.submissions.list();
    setSubmissions(data || []);
    setLoading(false);
  };

  const handleSubmitNew = () => {
    navigate("/submit", { state: { sdpo: selectedSdpo, policeStation: selectedPs } });
  };

  const handleSelectSubmission = (submissionId: string, checked: boolean) => {
    if (checked) {
      setSelectedSubmissions(prev => [...prev, submissionId]);
    } else {
      setSelectedSubmissions(prev => prev.filter(id => id !== submissionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubmissions(filteredSubmissions.map(s => s.id));
    } else {
      setSelectedSubmissions([]);
    }
  };

  const handleAnalyse = (submission?: Submission) => {
    if (submission) {
      // Single submission analysis
      setChatSubmissions([submission]);
      setShowChat(true);
    } else {
      // Multi-submission analysis
      const selected = filteredSubmissions.filter(s => selectedSubmissions.includes(s.id));
      if (selected.length === 0) {
        toast.error("Please select at least one submission to analyse");
        return;
      }
      setChatSubmissions(selected);
      setShowChat(true);
    }
  };

  if (activeTab === "menu") {
    return (
      <div className="min-h-screen bg-background">
        <GovHeader />
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <h2 className="gov-page-title text-center mb-6">District Dashboard</h2>

          {/* Filter Panel */}
          <Card className="mb-8 border-0 shadow-md">
            <div className="h-1.5 bg-gradient-to-r from-[#132b5e] to-[#2a4d8f]" />
            <CardContent className="pt-8 pb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">SDPO Circle</Label>
                  <Select value={selectedSdpo} onValueChange={setSelectedSdpo}>
                    <SelectTrigger><SelectValue placeholder="Select SDPO Circle" /></SelectTrigger>
                    <SelectContent>
                      {sdpoList.map((sdpo) => <SelectItem key={sdpo} value={sdpo}>{sdpo}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Police Station</Label>
                  <Select value={selectedPs} onValueChange={setSelectedPs} disabled={!selectedSdpo}>
                    <SelectTrigger><SelectValue placeholder="Select Police Station" /></SelectTrigger>
                    <SelectContent>
                      {selectedSdpo && (hierarchy[selectedSdpo] || []).map((ps) => (
                        <SelectItem key={ps} value={ps}>{ps}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="cursor-pointer hover:shadow-xl transition-all border-0 shadow-md overflow-hidden group" onClick={handleSubmitNew}>
              <div className="h-1.5 bg-gradient-to-r from-[#132b5e] to-[#2a4d8f]" />
              <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <FilePlus className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-primary">Submit New Report</h3>
                <p className="text-sm text-muted-foreground text-center">
                  File a new fatal road accident report with detailed investigation
                </p>
                <Badge className="bg-primary text-white">New FIR</Badge>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-xl transition-all border-0 shadow-md overflow-hidden group" onClick={() => { setActiveTab("list"); fetchSubmissions(); }}>
              <div className="h-1.5 bg-gradient-to-r from-[#132b5e] to-[#2a4d8f]" />
              <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-primary">View Past Submissions</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Access and manage your previously submitted accident reports
                </p>
                <Badge className="bg-primary text-white">{submissions.length} Reports</Badge>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-xl transition-all border-0 shadow-md overflow-hidden group" onClick={() => { setActiveTab("map"); fetchSubmissions(); }}>
              <div className="h-1.5 bg-gradient-to-r from-[#28a745] to-[#34ce57]" />
              <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <Map className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-primary">Accident Map View</h3>
                <p className="text-sm text-muted-foreground text-center">
                  View accident locations and hotspots in your district
                </p>
                <Badge className="bg-green-600 text-white">
                  <MapPin className="w-3 h-3 mr-1" />
                  Map View
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GovHeader />
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="gov-page-title">My Submissions</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setActiveTab("menu")}>Back to Menu</Button>
            <Button onClick={handleSubmitNew}><FilePlus className="w-4 h-4 mr-2" /> New Report</Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "list" | "map")} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              Map View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Filters for past submissions */}
            <Card className="mb-4 border-0 shadow-sm">
              <CardContent className="py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                  <div>
                    <Label className="text-xs text-muted-foreground">SDPO Circle</Label>
                    <Select value={listSdpo} onValueChange={(v) => { setListSdpo(v); setListPs(""); }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="All SDPOs" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All SDPOs</SelectItem>
                        {sdpoList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Police Station</Label>
                    <Select value={listPs} onValueChange={setListPs} disabled={!listSdpo || listSdpo === "__all__"}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="All PS" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All PS</SelectItem>
                        {listPsOptions.map((ps) => <SelectItem key={ps} value={ps}>{ps}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Date Range</Label>
                    <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="All time" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All time</SelectItem>
                        <SelectItem value="1m">Last 1 month</SelectItem>
                        <SelectItem value="3m">Last 3 months</SelectItem>
                        <SelectItem value="6m">Last 6 months</SelectItem>
                        <SelectItem value="1y">Last 1 year</SelectItem>
                        <SelectItem value="custom">Custom range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(dateRange === "custom") && (
                    <>
                      <div>
                        <Label className="text-xs text-muted-foreground">From Date</Label>
                        <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9" />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">To Date</Label>
                        <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9" />
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading submissions...</p>
                </CardContent>
              </Card>
            ) : filteredSubmissions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {submissions.length === 0 ? "No submissions yet. Submit your first report." : "No submissions match the selected filters."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Multi-select controls */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id="select-all"
                          checked={selectedSubmissions.length === filteredSubmissions.length && filteredSubmissions.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                        <Label htmlFor="select-all" className="text-sm">
                          Select All ({selectedSubmissions.length} selected)
                        </Label>
                      </div>
                      {selectedSubmissions.length > 0 && (
                        <Button
                          onClick={() => handleAnalyse()}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Brain className="w-4 h-4 mr-2" />
                          Analyse Selected ({selectedSubmissions.length})
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  {filteredSubmissions.map((s) => (
                    <Card key={s.id} className="hover:shadow-lg transition-all border-l-4 border-l-secondary/60 hover:border-l-secondary">
                      <CardContent className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          <Checkbox
                            checked={selectedSubmissions.includes(s.id)}
                            onCheckedChange={(checked) => handleSelectSubmission(s.id, checked as boolean)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-primary">FIR: {s.fir_number}</span>
                              <Badge variant="outline" className="border-secondary/40 text-secondary">{s.road_type}</Badge>
                              <Badge className="bg-primary/10 text-primary border-primary/20">{s.police_station}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {s.place_of_accident}, {s.mandal} — {new Date(s.accident_date).toLocaleDateString("en-IN")}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Died: {s.persons_died} | Injured: {s.persons_injured} | Submitted: {new Date(s.created_at).toLocaleDateString("en-IN")}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/submission/${s.id}`)}>
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleAnalyse(s)} className="text-blue-600">
                            <Brain className="w-4 h-4 mr-1" /> Analyse
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
              </div>
            )}
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="p-4 border-b">
                  <h3 className="text-lg font-semibold">Accident Map - {district} District</h3>
                  <p className="text-sm text-muted-foreground">
                    Interactive map showing accident locations and hotspots in your jurisdiction
                  </p>
                </div>
                <AccidentMap
                  accidents={filteredSubmissions}
                  userDistrict={district}
                  height="600px"
                  showHeatmap={true}
                  showDistrictBoundaries={false}
                  zoom={9}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Accident Chat Modal */}
      <AccidentChat
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        submissions={chatSubmissions}
        title={chatSubmissions.length === 1 ? 
          `Accident Analysis - FIR: ${chatSubmissions[0]?.fir_number}` : 
          `Batch Analysis - ${chatSubmissions.length} Accidents`
        }
      />
    </div>
  );
};

export default UserDashboard;
