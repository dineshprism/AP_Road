import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import GovHeader from "@/components/GovHeader";
import { FilePlus, FileText, Eye, Download, FileDown } from "lucide-react";
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

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"menu" | "list">("menu");

  useEffect(() => {
    if (user) fetchSubmissions();
  }, [user]);

  const fetchSubmissions = async () => {
    const { data } = await api.submissions.list();
    setSubmissions(data || []);
    setLoading(false);
  };

  if (view === "menu") {
    return (
      <div className="min-h-screen bg-background">
        <GovHeader />
        <div className="container mx-auto px-4 py-12">
          <h2 className="gov-page-title text-center mb-8">User Dashboard</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card className="cursor-pointer hover:shadow-xl transition-all border-0 shadow-md overflow-hidden group" onClick={() => navigate("/submit")}>
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="gov-page-title mb-6">My Submissions</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setView("menu")}>Back</Button>
            <Button onClick={() => navigate("/submit")}><FilePlus className="w-4 h-4 mr-2" /> New Report</Button>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        ) : submissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No submissions yet. Submit your first report.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <Card key={s.id} className="hover:shadow-lg transition-all border-l-4 border-l-secondary/60 hover:border-l-secondary">
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-primary">FIR: {s.fir_number}</span>
                      <Badge variant="outline" className="border-secondary/40 text-secondary">{s.road_type}</Badge>
                      <Badge className="bg-primary/10 text-primary border-primary/20">{s.district}</Badge>
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
