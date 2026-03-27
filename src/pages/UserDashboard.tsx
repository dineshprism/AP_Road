import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getApiAssetUrl } from "@/lib/api";
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
import {
  FilePlus,
  FileText,
  Eye,
  Download,
  FileDown,
  Calendar,
  Map,
  MapPin,
  Brain,
  BarChart3,
  PanelRightClose,
  Upload,
  FileCheck,
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
  const [activeTab, setActiveTab] = useState<"menu" | "list" | "map">("menu");
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [chatSubmissions, setChatSubmissions] = useState<Submission[]>([]);
  const [showChatPanel, setShowChatPanel] = useState(false);

  const district = profile?.district || "";
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

  const filteredSubmissions = useMemo(() => {
    let result = submissions;
    if (listSdpo) {
      const psInSdpo = DISTRICT_HIERARCHY[district]?.[listSdpo] || [];
      result = result.filter((submission) =>
        psInSdpo.some((ps) => submission.police_station?.toLowerCase() === ps.toLowerCase())
      );
    }
    if (listPs) {
      result = result.filter((submission) => submission.police_station?.toLowerCase() === listPs.toLowerCase());
    }
    if (firSearch.trim()) {
      const query = firSearch.trim().toLowerCase();
      result = result.filter((submission) => submission.fir_number?.toLowerCase().includes(query));
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
  }, [submissions, listSdpo, listPs, firSearch, signedCopyFilter, dateRange, customFrom, customTo, district]);

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
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const selected = filteredSubmissions.filter((item) => selectedSubmissions.includes(item.id));
    if (selected.length === 0) {
      toast.error("Please select at least one submission to analyse");
      return;
    }

    setChatSubmissions(selected);
    setShowChatPanel(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseChatPanel = () => {
    setShowChatPanel(false);
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

  if (activeTab === "menu") {
    return (
      <div className="min-h-screen bg-background">
        <GovHeader />
        <div className="container mx-auto max-w-3xl px-4 py-8">
          <h2 className="gov-page-title mb-6 text-center">District Dashboard</h2>

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

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Card className="group cursor-pointer overflow-hidden border-0 shadow-md transition-all hover:shadow-xl" onClick={handleSubmitNew}>
              <div className="h-1.5 bg-gradient-to-r from-[#e8710a] to-[#f5a623]" />
              <CardContent className="flex flex-col items-center gap-4 pb-8 pt-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/10 transition-colors group-hover:bg-secondary/20">
                  <FilePlus className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-lg font-bold text-primary">Submit New Report</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Fill the Fatal Road Accident Scientific Investigation Template
                </p>
              </CardContent>
            </Card>

            <Card className="group cursor-pointer overflow-hidden border-0 shadow-md transition-all hover:shadow-xl" onClick={() => { setActiveTab("list"); fetchSubmissions(); }}>
              <div className="h-1.5 bg-gradient-to-r from-[#132b5e] to-[#2a4d8f]" />
              <CardContent className="flex flex-col items-center gap-4 pb-8 pt-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-primary">View Past Submissions</h3>
                <p className="text-center text-sm text-muted-foreground">
                  View all your previously submitted investigation reports
                </p>
                <Badge className="bg-primary text-white">{submissions.length} Reports</Badge>
              </CardContent>
            </Card>

            <Card className="group cursor-pointer overflow-hidden border-0 shadow-md transition-all hover:shadow-xl" onClick={() => { setActiveTab("map"); fetchSubmissions(); }}>
              <div className="h-1.5 bg-gradient-to-r from-[#28a745] to-[#34ce57]" />
              <CardContent className="flex flex-col items-center gap-4 pb-8 pt-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 transition-colors group-hover:bg-green-500/20">
                  <Map className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-primary">Accident Map View</h3>
                <p className="text-center text-sm text-muted-foreground">
                  View accident locations and hotspots in your district
                </p>
                <Badge className="bg-green-600 text-white">
                  <MapPin className="mr-1 h-3 w-3" />
                  Map View
                </Badge>
              </CardContent>
            </Card>

            <Card className="group cursor-pointer overflow-hidden border-0 shadow-md transition-all hover:shadow-xl" onClick={() => navigate("/analytics")}>
              <div className="h-1.5 bg-gradient-to-r from-[#163a70] to-[#355f9a]" />
              <CardContent className="flex flex-col items-center gap-4 pb-8 pt-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-primary">District Analytics</h3>
                <p className="text-center text-sm text-muted-foreground">
                  Review police station comparisons, hotspots, and field completeness in your district
                </p>
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
              <Map className="h-4 w-4" />
              Map View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            <div className={`grid gap-6 ${showChatPanel && chatSubmissions.length > 0 ? "md:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)]" : "grid-cols-1"}`}>
              <div className="space-y-4">
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
                      <div>
                        <Label className="text-xs text-muted-foreground">SDPO Circle</Label>
                        <Select value={listSdpo} onValueChange={(value) => { setListSdpo(value); setListPs(""); }}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="All SDPOs" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">All SDPOs</SelectItem>
                            {sdpoList.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Police Station</Label>
                        <Select value={listPs} onValueChange={setListPs} disabled={!listSdpo || listSdpo === "__all__"}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="All PS" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__all__">All PS</SelectItem>
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
                      {(listSdpo && listSdpo !== "__all__" || listPs && listPs !== "__all__" || dateRange !== "all" || firSearch || signedCopyFilter !== "all") && (
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
                            {showChatPanel && chatSubmissions.length > 0 && (
                              <Button variant="outline" onClick={() => setShowChatPanel((prev) => !prev)} className="border-slate-200">
                                <PanelRightClose className="mr-2 h-4 w-4" />
                                {showChatPanel ? "Hide Chat" : "Show Chat"}
                              </Button>
                            )}
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
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/submission/${submission.id}`)}>
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
                                  <Button variant="ghost" size="sm" asChild>
                                    <a
                                      href={getApiAssetUrl(submission.signed_copy_url) || "#"}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <FileText className="mr-1 h-4 w-4" /> Signed Copy
                                    </a>
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

              {showChatPanel && chatSubmissions.length > 0 && (
                <div className="hidden min-h-0 md:block">
                <div className="h-full lg:sticky lg:top-6">
                  <AccidentChat
                    isOpen={showChatPanel}
                    onClose={handleCloseChatPanel}
                    submissions={chatSubmissions}
                    variant="panel"
                    title={chatSubmissions.length === 1
                      ? `Conversation - FIR ${chatSubmissions[0]?.fir_number}`
                      : chatSubmissions.length > 1
                        ? `Conversation - ${chatSubmissions.length} submissions`
                        : "Accident Analysis Chat"}
                    className="h-[calc(100vh-11rem)]"
                  />
                </div>
                </div>
              )}
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
    </div>
  );
};

export default UserDashboard;
