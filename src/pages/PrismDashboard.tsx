import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GovHeader from "@/components/GovHeader";
import { Activity, Clock3, FileText, LogIn, MessageSquareMore, RefreshCcw, Search } from "lucide-react";

interface LoginEvent {
  id: string;
  created_at: string;
  username: string;
  district: string | null;
  full_name: string | null;
  designation: string | null;
  ip_address: string | null;
}

interface SubmissionEvent {
  id: string;
  created_at: string;
  username: string;
  district: string;
  full_name: string | null;
  designation: string | null;
  fir_number: string;
  police_station: string;
  place_of_accident: string;
  mandal: string;
}

interface FeedbackEvent {
  id: string;
  district: string;
  full_name: string | null;
  designation: string | null;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

const PrismDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [submissionEvents, setSubmissionEvents] = useState<SubmissionEvent[]>([]);
  const [summary, setSummary] = useState({
    total_logins: 0,
    logins_last_24h: 0,
    total_submissions: 0,
    submissions_last_24h: 0,
    active_submission_districts: 0,
  });
  const [feedbackItems, setFeedbackItems] = useState<FeedbackEvent[]>([]);

  const fetchActivity = async () => {
    setLoading(true);
    const { data } = await api.admin.activity({ loginLimit: 150, submissionLimit: 150 });
    const feedbackResponse = await api.feedback.list();
    setLoginEvents(data?.loginEvents || []);
    setSubmissionEvents(data?.submissionEvents || []);
    setFeedbackItems(feedbackResponse.data || []);
    setSummary(data?.summary || {
      total_logins: 0,
      logins_last_24h: 0,
      total_submissions: 0,
      submissions_last_24h: 0,
      active_submission_districts: 0,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchActivity();
  }, []);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredLoginEvents = useMemo(() => {
    if (!normalizedSearch) return loginEvents;
    return loginEvents.filter((event) =>
      [event.username, event.district, event.full_name, event.designation, event.ip_address]
        .some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
    );
  }, [loginEvents, normalizedSearch]);

  const filteredSubmissionEvents = useMemo(() => {
    if (!normalizedSearch) return submissionEvents;
    return submissionEvents.filter((event) =>
      [event.username, event.district, event.full_name, event.designation, event.fir_number, event.police_station, event.place_of_accident, event.mandal]
        .some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
    );
  }, [submissionEvents, normalizedSearch]);

  const filteredFeedbackItems = useMemo(() => {
    if (!normalizedSearch) return feedbackItems;
    return feedbackItems.filter((item) =>
      [item.district, item.full_name, item.designation, item.subject, item.message]
        .some((value) => String(value || "").toLowerCase().includes(normalizedSearch))
    );
  }, [feedbackItems, normalizedSearch]);

  return (
    <div className="min-h-screen bg-background">
      <GovHeader />
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="gov-page-title mb-0">PRISM Dashboard</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Super admin view of district logins and submission activity across the portal.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/analytics")}>
              <Activity className="mr-2 h-4 w-4" /> Analytics
            </Button>
            <Button onClick={() => void fetchActivity()}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh Logs
            </Button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="gov-stat-card"><div className="h-1 bg-[#132b5e]" /><CardContent className="py-4 text-center"><p className="text-3xl font-extrabold text-primary">{summary.total_logins}</p><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-1">Total Logins</p></CardContent></div>
          <div className="gov-stat-card"><div className="h-1 bg-[#355f9a]" /><CardContent className="py-4 text-center"><p className="text-3xl font-extrabold text-primary">{summary.logins_last_24h}</p><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-1">Logins 24h</p></CardContent></div>
          <div className="gov-stat-card"><div className="h-1 bg-[#138808]" /><CardContent className="py-4 text-center"><p className="text-3xl font-extrabold text-accent">{summary.total_submissions}</p><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-1">Total Submissions</p></CardContent></div>
          <div className="gov-stat-card"><div className="h-1 bg-[#e8710a]" /><CardContent className="py-4 text-center"><p className="text-3xl font-extrabold text-secondary">{summary.submissions_last_24h}</p><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-1">Submissions 24h</p></CardContent></div>
          <div className="gov-stat-card"><div className="h-1 bg-[#7b1fa2]" /><CardContent className="py-4 text-center"><p className="text-3xl font-extrabold text-primary">{summary.active_submission_districts}</p><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-1">Active Districts</p></CardContent></div>
        </div>

        <Card className="mb-6 border-0 shadow-sm">
          <CardContent className="py-4">
            <div className="max-w-md">
              <Label className="text-xs font-bold uppercase tracking-wide text-primary">Search Activity</Label>
              <div className="mt-1 flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="District, username, FIR, police station..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="submissions" className="space-y-4">
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="submissions" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Submission Logs
            </TabsTrigger>
            <TabsTrigger value="logins" className="flex items-center gap-2">
              <LogIn className="h-4 w-4" />
              Login Logs
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <MessageSquareMore className="h-4 w-4" />
              Feedback
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="space-y-3">
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Loading activity...</p>
            ) : filteredSubmissionEvents.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No submission activity found.</CardContent></Card>
            ) : (
              filteredSubmissionEvents.map((event) => (
                <Card key={event.id} className="border-l-4 border-l-[#138808]">
                  <CardContent className="py-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-primary">FIR: {event.fir_number}</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20">{event.district}</Badge>
                      <Badge variant="outline">{event.police_station}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {event.place_of_accident}, {event.mandal}
                    </p>
                    <p className="mt-1 text-sm">
                      Submitted by <span className="font-semibold">{event.full_name || event.username}</span> ({event.username})
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(event.created_at).toLocaleString("en-IN")}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="logins" className="space-y-3">
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Loading activity...</p>
            ) : filteredLoginEvents.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No login activity found.</CardContent></Card>
            ) : (
              filteredLoginEvents.map((event) => (
                <Card key={event.id} className="border-l-4 border-l-[#132b5e]">
                  <CardContent className="py-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-primary">{event.full_name || event.username}</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20">{event.district || "Unknown District"}</Badge>
                      {event.designation && <Badge variant="outline">{event.designation}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Username: {event.username}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      IP: {event.ip_address || "Not captured"}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(event.created_at).toLocaleString("en-IN")}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="feedback" className="space-y-3">
            {loading ? (
              <p className="py-8 text-center text-muted-foreground">Loading activity...</p>
            ) : filteredFeedbackItems.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No feedback received yet.</CardContent></Card>
            ) : (
              filteredFeedbackItems.map((item) => (
                <Card key={item.id} className="border-l-4 border-l-[#5b2ca0]">
                  <CardContent className="py-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-primary">{item.subject}</span>
                      <Badge className="bg-primary/10 text-primary border-primary/20">{item.district}</Badge>
                      {item.designation && <Badge variant="outline">{item.designation}</Badge>}
                    </div>
                    <p className="text-sm">
                      From <span className="font-semibold">{item.full_name || "Unknown User"}</span>
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(item.created_at).toLocaleString("en-IN")}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PrismDashboard;
