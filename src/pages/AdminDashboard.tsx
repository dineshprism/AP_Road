import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import GovHeader from "@/components/GovHeader";
import { AP_DISTRICTS, MONTHS } from "@/lib/constants";
import { Eye, Filter, RotateCcw, Download, FileText, FileDown } from "lucide-react";
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
  persons_died: number;
  persons_injured: number;
  created_at: string;
  [key: string]: any;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

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
        <h2 className="text-xl font-bold text-primary mb-6">Admin Dashboard — All Submissions</h2>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="py-4 text-center"><p className="text-2xl font-bold text-primary">{submissions.length}</p><p className="text-xs text-muted-foreground">Total Reports</p></CardContent></Card>
          <Card><CardContent className="py-4 text-center"><p className="text-2xl font-bold text-destructive">{totalDied}</p><p className="text-xs text-muted-foreground">Persons Died</p></CardContent></Card>
          <Card><CardContent className="py-4 text-center"><p className="text-2xl font-bold text-secondary">{totalInjured}</p><p className="text-xs text-muted-foreground">Persons Injured</p></CardContent></Card>
          <Card><CardContent className="py-4 text-center"><p className="text-2xl font-bold text-accent">{new Set(submissions.map(s => s.district)).size}</p><p className="text-xs text-muted-foreground">Districts</p></CardContent></Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-2 border-secondary/40 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-secondary" />
              <span className="font-semibold text-sm text-primary">Filters</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">District</Label>
                <Select value={filterDistrict} onValueChange={setFilterDistrict}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Districts</SelectItem>
                    {AP_DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Year</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Month</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {MONTHS.map((m, i) => <SelectItem key={m} value={(i + 1).toString()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Specific Date</Label>
                <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button variant="outline" size="sm" onClick={resetFilters} className="w-full border-secondary text-secondary hover:bg-secondary hover:text-white">
                  <RotateCcw className="w-3 h-3 mr-1" /> Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No submissions found for the selected filters.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <Card key={s.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-primary">FIR: {s.fir_number}</span>
                      <Badge>{s.district}</Badge>
                      <Badge variant="outline">{s.road_type}</Badge>
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
      </div>
    </div>
  );
};

export default AdminDashboard;
