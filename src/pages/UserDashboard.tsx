import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import GovHeader from "@/components/GovHeader";
import { FilePlus, FileText, Eye, Download, FileDown, Calendar } from "lucide-react";
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
  persons_died: number;
  persons_injured: number;
  created_at: string;
  [key: string]: any;
}

type DateRange = "1m" | "3m" | "6m" | "1y" | "custom" | "all";

function getDateFrom(range: DateRange): Date | null {
  if (range === "all") return null;
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
  const [view, setView] = useState<"menu" | "list">("menu");

  // Filters
  const district = profile?.district || "";
  const [selectedSdpo, setSelectedSdpo] = useState("");
  const [selectedPs, setSelectedPs] = useState("");

  // Date range filter for past submissions
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Filter for past submissions list
  const [listSdpo, setListSdpo] = useState("");
  const [listPs, setListPs] = useState("");

  // Hierarchy lookups
  const sdpoList = useMemo(() => {
    if (!district) return [];
    const h = DISTRICT_HIERARCHY[district];
    return h ? Object.keys(h).sort() : [];
  }, [district]);

  const psList = useMemo(() => {
    if (!district || !selectedSdpo) return [];
    const h = DISTRICT_HIERARCHY[district];
    return h?.[selectedSdpo]?.slice().sort() || [];
  }, [district, selectedSdpo]);

  const listPsOptions = useMemo(() => {
    if (!district || !listSdpo) return [];
    const h = DISTRICT_HIERARCHY[district];
    return h?.[listSdpo]?.slice().sort() || [];
  }, [district, listSdpo]);

  // Filtered submissions
  const filteredSubmissions = useMemo(() => {
    let result = submissions;
    if (listSdpo) {
      const psInSdpo = DISTRICT_HIERARCHY[district]?.[listSdpo] || [];
      result = result.filter((s) => psInSdpo.some((ps) => s.police_station?.toLowerCase() === ps.toLowerCase()));
    }
    if (listPs) {
      result = result.filter((s) => s.police_station?.toLowerCase() === listPs.toLowerCase());
    }
    if (dateRange === "custom") {
      if (customFrom) result = result.filter((s) => s.accident_date >= customFrom);
      if (customTo) result = result.filter((s) => s.accident_date <= customTo);
    } else if (dateRange !== "all") {
      const from = getDateFrom(dateRange);
      if (from) {
        const fromStr = from.toISOString().slice(0, 10);
        result = result.filter((s) => s.accident_date >= fromStr);
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

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-background">
        <GovHeader />
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <h2 className="gov-page-title text-center mb-6">District Dashboard</h2>

          {/* Filter Panel */}
          <Card className="mb-8 border-0 shadow-md">
            <div className="h-1.5 bg-gradient-to-r from-[#132b5e] to-[#2a4d8f]" />
            <CardContent className="pt-6">
              <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-4">Select Jurisdiction</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">District</Label>
                  <Input value={district} disabled className="bg-muted font-medium" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">SDPO Circle</Label>
                  <Select value={selectedSdpo} onValueChange={(v) => { setSelectedSdpo(v); setSelectedPs(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select SDPO" /></SelectTrigger>
                    <SelectContent>
                      {sdpoList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Police Station</Label>
                  <Select value={selectedPs} onValueChange={setSelectedPs} disabled={!selectedSdpo}>
                    <SelectTrigger><SelectValue placeholder={selectedSdpo ? "Select PS" : "Select SDPO first"} /></SelectTrigger>
                    <SelectContent>
                      {psList.map((ps) => <SelectItem key={ps} value={ps}>{ps}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-xl transition-all border-0 shadow-md overflow-hidden group" onClick={handleSubmitNew}>
              <div className="h-1.5 bg-gradient-to-r from-[#e8710a] to-[#f5a623]" />
              <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <FilePlus className="w-8 h-8 text-secondary" />
                </div>
                <h3 className="text-lg font-bold text-primary">Submit New Report</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Fill the Fatal Road Accident Scientific Investigation Template
                </p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-xl transition-all border-0 shadow-md overflow-hidden group" onClick={() => { setView("list"); fetchSubmissions(); }}>
              <div className="h-1.5 bg-gradient-to-r from-[#132b5e] to-[#2a4d8f]" />
              <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-primary">View Past Submissions</h3>
                <p className="text-sm text-muted-foreground text-center">
                  View all your previously submitted investigation reports
                </p>
                <Badge className="bg-primary text-white">{submissions.length} Reports</Badge>
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
            <Button variant="outline" onClick={() => setView("menu")}>Back</Button>
            <Button onClick={handleSubmitNew}><FilePlus className="w-4 h-4 mr-2" /> New Report</Button>
          </div>
        </div>

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
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="1m">Past 1 Month</SelectItem>
                    <SelectItem value="3m">Past 3 Months</SelectItem>
                    <SelectItem value="6m">Past 6 Months</SelectItem>
                    <SelectItem value="1y">Past 1 Year</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {dateRange === "custom" && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input type="date" className="h-9" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input type="date" className="h-9" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="outline" className="text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                {filteredSubmissions.length} of {submissions.length} reports
              </Badge>
              {(listSdpo && listSdpo !== "__all__" || listPs && listPs !== "__all__" || dateRange !== "all") && (
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => { setListSdpo(""); setListPs(""); setDateRange("all"); setCustomFrom(""); setCustomTo(""); }}>
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
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
          <div className="space-y-3">
            {filteredSubmissions.map((s) => (
              <Card key={s.id} className="hover:shadow-lg transition-all border-l-4 border-l-secondary/60 hover:border-l-secondary">
                <CardContent className="py-4 flex items-center justify-between">
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
      </div>
    </div>
  );
};

export default UserDashboard;
