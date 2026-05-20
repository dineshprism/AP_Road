import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, openProtectedAsset } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import GovHeader from "@/components/GovHeader";
import AccidentMap from "@/components/AccidentMap";
import AccidentChat from "@/components/AccidentChat";
import {
  FilePlus,
  FileText,
  Eye,
  Download,
  FileDown,
  Calendar,
  Map as MapIcon,
  MapPin,
  Brain,
  BarChart3,
  Upload,
  FileCheck,
  ShieldCheck,
  MessageSquareMore,
} from "lucide-react";
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
  lat_long?: string;
  persons_died: number;
  persons_injured: number;
  created_at: string;
  signed_copy_uploaded?: boolean;
  signed_copy_name?: string | null;
  signed_copy_url?: string | null;
  [key: string]: any;
}

type DateRange = "1m" | "3m" | "6m" | "1y" | "custom" | "all";
type SignedCopyFilter = "all" | "pending" | "uploaded";
const DISTRICT_INSTRUCTION_TEXT = "Please do fill severe injuries Accidents and Fatal accidents data available from 01-04-2026";
const ALL_FILTER_VALUE = "__all__";

function normalizeStationName(value?: string | null) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

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
  const location = useLocation();
  const dashboardState = (location.state as { activeTab?: "menu" | "list" | "map" } | null) || {};
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"menu" | "list" | "map">(dashboardState.activeTab || "menu");
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [chatSubmissions, setChatSubmissions] = useState<Submission[]>([]);
  const [showChatPanel, setShowChatPanel] = useState(false);

  const district = profile?.district || "";
  const isPrismUser = district === "Prism";
  const [selectedSdpo, setSelectedSdpo] = useState("");
  const [selectedPs, setSelectedPs] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [listSdpo, setListSdpo] = useState("");
  const [listPs, setListPs] = useState("");
  const [firSearch, setFirSearch] = useState("");
  const [signedCopyFilter, setSignedCopyFilter] = useState<SignedCopyFilter>("all");
  const [uploadingSubmissionId, setUploadingSubmissionId] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

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

  const sdpoByPoliceStation = useMemo(() => {
    const hierarchy = DISTRICT_HIERARCHY[district] || {};
    const stationMap = new Map<string, string>();

    Object.entries(hierarchy).forEach(([sdpoName, stations]) => {
      stations.forEach((station) => {
        stationMap.set(normalizeStationName(station), sdpoName);
      });
    });

    return stationMap;
  }, [district]);

  const submissionSdpoById = useMemo(() => {
    const mapped = new Map<string, string>();

    submissions.forEach((submission) => {
      const normalizedStation = normalizeStationName(submission.police_station);
      const sdpoName = sdpoByPoliceStation.get(normalizedStation);
      if (sdpoName) {
        mapped.set(submission.id, sdpoName);
      }
    });

    return mapped;
  }, [submissions, sdpoByPoliceStation]);

  const listPsOptions = useMemo(() => {
    if (!listSdpo || listSdpo === ALL_FILTER_VALUE) return [];

    const options = submissions
      .filter((submission) => submissionSdpoById.get(submission.id) === listSdpo)
      .map((submission) => String(submission.police_station || "").trim())
      .filter((station) => station.length > 0);

    return Array.from(new Set(options)).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  }, [listSdpo, submissions, submissionSdpoById]);

  const filteredSubmissions = useMemo(() => {
    let result = submissions;
    if (listSdpo && listSdpo !== ALL_FILTER_VALUE) {
      result = result.filter((submission) => submissionSdpoById.get(submission.id) === listSdpo);
    }
    if (listPs && listPs !== ALL_FILTER_VALUE) {
      const selectedPsNormalized = normalizeStationName(listPs);
      result = result.filter((submission) => normalizeStationName(submission.police_station) === selectedPsNormalized);
    }
    if (firSearch.trim()) {
      const query = firSearch.trim().toLowerCase();
      result = result.filter((submission) => String(submission.fir_number || "").toLowerCase().includes(query));
    }
    if (signedCopyFilter === "uploaded") {
      result = result.filter((submission) => submission.signed_copy_uploaded);
    } else if (signedCopyFilter === "pending") {
      result = result.filter((submission) => !submission.signed_copy_uploaded);
    }
    if (dateRange === "custom") {
      if (customFrom) result = result.filter((submission) => submission.accident_date >= customFrom);
      if (customTo) result = result.filter((submission) => submission.accident_date <= customTo);
    } else if (dateRange !== "all") {
      const from = getDateFrom(dateRange);
      if (from) {
        const fromStr = from.toISOString().slice(0, 10);
        result = result.filter((submission) => submission.accident_date >= fromStr);
      }
    }
    return result;
  }, [submissions, listSdpo, listPs, firSearch, signedCopyFilter, dateRange, customFrom, customTo, submissionSdpoById]);

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
      setSelectedSubmissions((prev) => [...prev, submissionId]);
    } else {
      setSelectedSubmissions((prev) => prev.filter((id) => id !== submissionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubmissions(filteredSubmissions.map((submission) => submission.id));
    } else {
      setSelectedSubmissions([]);
    }
  };

  const handleAnalyse = (submission?: Submission) => {
    if (submission) {
      setChatSubmissions([submission]);
      setShowChatPanel(true);
      return;
    }

    const selected = filteredSubmissions.filter((item) => selectedSubmissions.includes(item.id));
    if (selected.length === 0) {
      toast.error("Please select at least one submission to analyse");
      return;
    }

    setChatSubmissions(selected);
    setShowChatPanel(true);
  };

  const handleCloseChatPanel = () => {
    setShowChatPanel(false);
    setChatSubmissions([]);
    setSelectedSubmissions([]);
  };

  const handleSignedCopyUpload = async (submissionId: string, file: File | null) => {
    if (!file) return;

    setUploadingSubmissionId(submissionId);
    const { data, error } = await api.submissions.uploadSignedCopy(submissionId, file);

    if (error) {
      toast.error(error);
      setUploadingSubmissionId(null);
      return;
    }

    setSubmissions((prev) =>
      prev.map((submission) =>
        submission.id === submissionId
          ? {
              ...submission,
              signed_copy_uploaded: true,
              signed_copy_name: data?.signed_copy_name || file.name,
              signed_copy_url: data?.signed_copy_url || submission.signed_copy_url,
            }
          : submission
      )
    );
    toast.success("Signed copy uploaded successfully");
    setUploadingSubmissionId(null);
  };

  const handleOpenSignedCopy = async (submission: Submission) => {
    try {
      await openProtectedAsset(submission.signed_copy_url);
    } catch (error: any) {
      toast.error(error?.message || "Failed to open signed copy");
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackSubject.trim() || !feedbackMessage.trim()) {
      toast.error("Please enter both subject and feedback message");
      return;
    }

    setFeedbackLoading(true);
    const { error } = await api.feedback.create({
      subject: feedbackSubject.trim(),
      message: feedbackMessage.trim(),
    });
    setFeedbackLoading(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Feedback submitted successfully");
    setFeedbackSubject("");
    setFeedbackMessage("");
    setFeedbackOpen(false);
  };

  const instructionBanner = (
    <div className="gov-instruction-marquee" role="note" aria-label="District data entry instruction">
      <div className="gov-instruction-marquee__viewport">
        <span>{DISTRICT_INSTRUCTION_TEXT}</span>
      </div>
    </div>
  );

  if (activeTab === "menu") {
    return (
      <div className="min-h-screen bg-background">
        <GovHeader />
        {instructionBanner}
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="gov-page-title mb-0 text-center sm:text-left">District Dashboard</h2>
          </div>

          <Card className="mb-8 border-0 shadow-md">
            <div className="h-1.5 bg-gradient-to-r from-[#132b5e] to-[#2a4d8f]" />
            <CardContent className="pt-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-primary">Select Jurisdiction</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">District</Label>
                  <Input value={district} disabled className="bg-muted font-medium" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">SDPO Circle</Label>
                  <Select value={selectedSdpo} onValueChange={(value) => { setSelectedSdpo(value); setSelectedPs(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select SDPO" /></SelectTrigger>
                    <SelectContent>
                      {sdpoList.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Police Station</Label>
                  <Select value={selectedPs} onValueChange={setSelectedPs} disabled={!selectedSdpo}>
                    <SelectTrigger><SelectValue placeholder={selectedSdpo ? "Select PS" : "Select SDPO first"} /></SelectTrigger>
                    <SelectContent>
                      {psList.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card className="group cursor-pointer overflow-hidden border-0 shadow-md transition-all hover:shadow-xl" onClick={handleSubmitNew}>
              <div className="h-1.5 bg-gradient-to-r from-[#e8710a] to-[#f5a623]" />
              <CardContent className="flex min-h-[122px] items-start gap-3 px-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/10 transition-colors group-hover:bg-secondary/20">
                  <FilePlus className="h-5 w-5 text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-snug text-primary">Submit New Report</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Fill the fatal accident investigation template.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="group cursor-pointer overflow-hidden border-0 shadow-md transition-all hover:shadow-xl" onClick={() => { setActiveTab("list"); fetchSubmissions(); }}>
              <div className="h-1.5 bg-gradient-to-r from-[#132b5e] to-[#2a4d8f]" />
              <CardContent className="flex min-h-[122px] items-start gap-3 px-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-snug text-primary">View Past Submissions</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Open your previously submitted reports.
                  </p>
                  <Badge className="mt-2 bg-primary text-white">{submissions.length} Reports</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="group cursor-pointer overflow-hidden border-0 shadow-md transition-all hover:shadow-xl" onClick={() => { setActiveTab("map"); fetchSubmissions(); }}>
              <div className="h-1.5 bg-gradient-to-r from-[#28a745] to-[#34ce57]" />
              <CardContent className="flex min-h-[122px] items-start gap-3 px-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-500/10 transition-colors group-hover:bg-green-500/20">
                  <MapIcon className="h-5 w-5 text-green-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-snug text-primary">Accident Map View</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    View accident spots and hotspots in your district.
                  </p>
                  <Badge className="mt-2 bg-green-600 text-white">
                    <MapPin className="mr-1 h-3 w-3" />
                    Map View
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="group cursor-pointer overflow-hidden border-0 shadow-md transition-all hover:shadow-xl" onClick={() => navigate("/analytics")}>
              <div className="h-1.5 bg-gradient-to-r from-[#163a70] to-[#355f9a]" />
              <CardContent className="flex min-h-[122px] items-start gap-3 px-4 py-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold leading-snug text-primary">District Analytics</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    Review station comparisons, hotspots, and field completeness.
                  </p>
                </div>
              </CardContent>
            </Card>

            {isPrismUser && (
              <Card className="group cursor-pointer overflow-hidden border-0 shadow-md transition-all hover:shadow-xl" onClick={() => navigate("/prism-dashboard")}>
                <div className="h-1.5 bg-gradient-to-r from-[#5b2ca0] to-[#8c52d9]" />
                <CardContent className="flex min-h-[122px] items-start gap-3 px-4 py-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 transition-colors group-hover:bg-violet-500/20">
                    <ShieldCheck className="h-5 w-5 text-violet-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold leading-snug text-primary">PRISM Logs</h3>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      View district login activity and submission logs across the portal.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        <Button
          type="button"
          className="fixed bottom-6 right-6 z-40 rounded-full px-5 shadow-lg hover:shadow-xl"
          onClick={() => setFeedbackOpen(true)}
        >
          <MessageSquareMore className="mr-2 h-4 w-4" />
          Feedback
        </Button>
        <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Feedback</DialogTitle>
              <DialogDescription>
                Share usability issues, doubts, or suggestions. This will be visible to PRISM.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="feedback-subject">Subject</Label>
                <Input id="feedback-subject" value={feedbackSubject} onChange={(e) => setFeedbackSubject(e.target.value)} placeholder="Eg. Submission form usability" />
              </div>
              <div>
                <Label htmlFor="feedback-message">Message</Label>
                <Textarea id="feedback-message" value={feedbackMessage} onChange={(e) => setFeedbackMessage(e.target.value)} placeholder="Explain the issue, question, or suggestion..." rows={6} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitFeedback} disabled={feedbackLoading}>
                {feedbackLoading ? "Submitting..." : "Submit Feedback"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <GovHeader />
      {instructionBanner}
        <div className={`${activeTab === "map" ? "mx-auto max-w-[1700px]" : "container mx-auto"} px-4 py-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="gov-page-title">My Submissions</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setActiveTab("menu")}>Back to Menu</Button>
            <Button onClick={handleSubmitNew}><FilePlus className="mr-2 h-4 w-4" /> New Report</Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "list" | "map")} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              Map View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
                      <div>
                        <Label className="text-xs text-muted-foreground">SDPO Circle</Label>
                        <Select value={listSdpo || ALL_FILTER_VALUE} onValueChange={(value) => { setListSdpo(value === ALL_FILTER_VALUE ? "" : value); setListPs(""); }}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="All SDPOs" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_FILTER_VALUE}>All SDPOs</SelectItem>
                            {sdpoList.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Police Station</Label>
                        <Select value={listPs || ALL_FILTER_VALUE} onValueChange={(value) => setListPs(value === ALL_FILTER_VALUE ? "" : value)} disabled={!listSdpo}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="All PS" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ALL_FILTER_VALUE}>All PS</SelectItem>
                            {listPsOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Date Range</Label>
                        <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
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
                      <div>
                        <Label className="text-xs text-muted-foreground">Signed Copy</Label>
                        <Select value={signedCopyFilter} onValueChange={(value) => setSignedCopyFilter(value as SignedCopyFilter)}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="uploaded">Uploaded</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">FIR Number</Label>
                        <Input
                          value={firSearch}
                          onChange={(e) => setFirSearch(e.target.value)}
                          className="h-9"
                          placeholder="Search FIR"
                        />
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
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Calendar className="mr-1 h-3 w-3" />
                        {filteredSubmissions.length} of {submissions.length} reports
                      </Badge>
                      {chatSubmissions.length > 0 && (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                          Active analysis: {chatSubmissions.length === 1 ? chatSubmissions[0].fir_number : `${chatSubmissions.length} submissions`}
                        </Badge>
                      )}
                      {(listSdpo || listPs || dateRange !== "all" || firSearch || signedCopyFilter !== "all") && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setListSdpo(""); setListPs(""); setDateRange("all"); setCustomFrom(""); setCustomTo(""); setFirSearch(""); setSignedCopyFilter("all"); }}>
                          Clear Filters
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {loading ? (
                  <p className="py-8 text-center text-muted-foreground">Loading...</p>
                ) : filteredSubmissions.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {submissions.length === 0 ? "No submissions yet. Submit your first report." : "No submissions match the selected filters."}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <Card className="border-0 shadow-sm">
                      <CardContent className="py-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                          <div className="flex flex-wrap gap-2">
                            {selectedSubmissions.length > 0 && (
                              <Button onClick={() => handleAnalyse()} className="bg-blue-600 hover:bg-blue-700">
                                <Brain className="mr-2 h-4 w-4" />
                                Analyse Selected ({selectedSubmissions.length})
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-3">
                      {filteredSubmissions.map((submission) => {
                        const isActive = chatSubmissions.some((item) => item.id === submission.id);

                        return (
                          <Card
                            key={submission.id}
                            className={`border-l-4 transition-all hover:shadow-lg ${
                              isActive
                                ? "border-l-blue-600 bg-blue-50/50 shadow-md ring-1 ring-blue-100"
                                : "border-l-secondary/60 hover:border-l-secondary"
                            }`}
                          >
                            <CardContent className="flex items-center justify-between gap-4 py-4">
                              <div className="flex flex-1 items-center gap-3">
                                <Checkbox
                                  checked={selectedSubmissions.includes(submission.id)}
                                  onCheckedChange={(checked) => handleSelectSubmission(submission.id, checked as boolean)}
                                />
                                <div className="flex-1">
                                  <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-primary">FIR: {submission.fir_number}</span>
                                    <Badge variant="outline" className="border-secondary/40 text-secondary">{submission.road_type}</Badge>
                                    <Badge className="border-primary/20 bg-primary/10 text-primary">{submission.police_station}</Badge>
                                    <Badge variant="outline" className={submission.signed_copy_uploaded ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                                      {submission.signed_copy_uploaded ? "Signed copy uploaded" : "Signed copy pending"}
                                    </Badge>
                                    {isActive && (
                                      <Badge className="bg-blue-600 text-white">In chat</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {submission.place_of_accident}, {submission.mandal} - {new Date(submission.accident_date).toLocaleDateString("en-IN")}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Died: {submission.persons_died} | Injured: {submission.persons_injured} | Submitted: {new Date(submission.created_at).toLocaleDateString("en-IN")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/submission/${submission.id}`, { state: { backTarget: "/dashboard", dashboardTab: "list" } })}
                                >
                                  <Eye className="mr-1 h-4 w-4" /> View
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleAnalyse(submission)} className="text-blue-600">
                                  <Brain className="mr-1 h-4 w-4" /> Analyse
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={async () => {
                                      const { data } = await api.submissions.get(submission.id);
                                      if (data) exportSubmissionPDF(data);
                                      else toast.error("Failed to load submission");
                                    }}>
                                      <FileDown className="mr-2 h-4 w-4" /> Download Unsigned PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={async () => {
                                      const { data } = await api.submissions.get(submission.id);
                                      if (data) await exportSubmissionDOCX(data);
                                      else toast.error("Failed to load submission");
                                    }}>
                                      <FileText className="mr-2 h-4 w-4" /> Download Unsigned DOC
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  asChild={false}
                                  onClick={() => {
                                    const input = document.getElementById(`signed-copy-${submission.id}`) as HTMLInputElement | null;
                                    input?.click();
                                  }}
                                  disabled={uploadingSubmissionId === submission.id}
                                >
                                  {submission.signed_copy_uploaded ? <FileCheck className="mr-1 h-4 w-4" /> : <Upload className="mr-1 h-4 w-4" />}
                                  {uploadingSubmissionId === submission.id ? "Uploading..." : submission.signed_copy_uploaded ? "Replace Uploaded Signed Copy" : "Upload Signed Copy"}
                                </Button>
                                {submission.signed_copy_url && (
                                  <Button variant="ghost" size="sm" onClick={() => void handleOpenSignedCopy(submission)}>
                                    <FileText className="mr-1 h-4 w-4" /> Signed Copy
                                  </Button>
                                )}
                                <input
                                  id={`signed-copy-${submission.id}`}
                                  type="file"
                                  accept=".pdf,image/png,image/jpeg"
                                  className="hidden"
                                  onChange={(e) => {
                                    void handleSignedCopyUpload(submission.id, e.target.files?.[0] || null);
                                    e.currentTarget.value = "";
                                  }}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>
          </TabsContent>

          <TabsContent value="map" className="space-y-4">
            <Card className="overflow-hidden border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="border-b bg-slate-50 px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">Accident Map - {district} District</h3>
                      <p className="text-sm text-muted-foreground">
                        Full district map with accident spots, live traffic, hotspot intensity, and district-only navigation view
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="bg-white text-slate-700">
                        {filteredSubmissions.length} filtered records
                      </Badge>
                      <Badge variant="outline" className="bg-white text-slate-700">
                        {filteredSubmissions.filter((submission) => Boolean(submission.lat_long)).length} mapped spots
                      </Badge>
                      <Badge variant="outline" className="bg-white text-slate-700">
                        {filteredSubmissions.filter((submission) => !submission.lat_long).length} without coordinates
                      </Badge>
                    </div>
                  </div>
                </div>
                <AccidentMap
                  accidents={filteredSubmissions}
                  userDistrict={district}
                  height="calc(100vh - 220px)"
                  showHeatmap={true}
                  showDistrictBoundaries={false}
                  zoom={9}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Button
        type="button"
        className="fixed bottom-6 right-6 z-40 rounded-full px-5 shadow-lg hover:shadow-xl"
        onClick={() => setFeedbackOpen(true)}
      >
        <MessageSquareMore className="mr-2 h-4 w-4" />
        Feedback
      </Button>
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Share usability issues, doubts, or suggestions. This will be visible to PRISM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="feedback-subject">Subject</Label>
              <Input id="feedback-subject" value={feedbackSubject} onChange={(e) => setFeedbackSubject(e.target.value)} placeholder="Eg. Submission form usability" />
            </div>
            <div>
              <Label htmlFor="feedback-message">Message</Label>
              <Textarea id="feedback-message" value={feedbackMessage} onChange={(e) => setFeedbackMessage(e.target.value)} placeholder="Explain the issue, question, or suggestion..." rows={6} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitFeedback} disabled={feedbackLoading}>
              {feedbackLoading ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AccidentChat
        isOpen={showChatPanel}
        onClose={handleCloseChatPanel}
        submissions={chatSubmissions}
        title={chatSubmissions.length === 1
          ? `Analysis - FIR ${chatSubmissions[0]?.fir_number}`
          : chatSubmissions.length > 1
            ? `Batch Analysis - ${chatSubmissions.length} submissions`
            : "Accident Analysis"}
      />
    </div>
  );
};

export default UserDashboard;
