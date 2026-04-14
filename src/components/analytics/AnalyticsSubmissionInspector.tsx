import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, CalendarClock, ExternalLink, Eye, FileText, Loader2, MapPin } from "lucide-react";
import AccidentChat from "@/components/AccidentChat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, openProtectedAsset } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface AnalyticsProScopeFilters {
  district?: string;
  year?: string;
  fromDate?: string;
  toDate?: string;
}

export interface AnalyticsProDrilldownFilters {
  submissionDistrict?: string;
  policeStation?: string;
  roadType?: string;
  createdDate?: string;
  createdMonth?: string;
  timelinessStatus?: string;
  delayBand?: string;
  signedCopyStatus?: string;
  createdWeekday?: string;
}

interface DrilldownSubmissionSummary {
  id: string;
  firNumber: string;
  district: string;
  placeOfAccident: string;
  mandal: string;
  policeStation: string;
  roadType: string;
  accidentDate: string;
  accidentTime: string;
  personsDied: number;
  personsInjured: number;
  createdAt: string;
  createdDate: string;
  createdMonth: string;
  createdMonthLabel: string;
  createdWeekday: string;
  lagHours: number;
  timelinessStatus: "Timely" | "Delayed";
  delayBand: string;
  signedCopyStatus: "Uploaded" | "Pending";
}

interface DrilldownResponse {
  title: string;
  scope: {
    viewLevel: "state" | "district";
    district: string | null;
    scopeLabel: string;
    rangeStart: string;
    rangeEnd: string;
  };
  count: number;
  submissions: DrilldownSubmissionSummary[];
}

interface SubmissionDetail {
  id: string;
  district: string;
  place_of_accident: string;
  mandal: string;
  police_station: string;
  fir_number: string;
  road_type: string;
  accident_date: string;
  accident_time: string;
  lat_long?: string | null;
  persons_died: number;
  persons_injured: number;
  created_at?: string;
  victim_details?: Array<{
    name: string;
    age: number;
    address: string;
    gender?: "male" | "female" | "other";
    status: "died" | "injured";
    injury_type?: "simple" | "grievous" | "";
  }>;
  vehicles?: Array<{ registration_number: string; class_type: string }>;
  drivers?: Array<{ name: string; dl_number: string; licensing_authority: string }>;
  driver_related_causes?: Record<string, boolean>;
  vehicle_condition_causes?: Record<string, boolean>;
  road_engineering_culverts?: Record<string, boolean>;
  road_engineering_junctions?: Record<string, boolean>;
  road_engineering_median?: Record<string, boolean>;
  road_engineering_nature?: Record<string, boolean>;
  road_engineering_signages?: Record<string, boolean>;
  signed_copy_uploaded?: boolean;
  signed_copy_name?: string | null;
  signed_copy_url?: string | null;
}

interface AnalyticsSubmissionInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeFilters: AnalyticsProScopeFilters;
  drilldownFilters: AnalyticsProDrilldownFilters | null;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function truthyLabels(record: Record<string, boolean> | undefined) {
  return Object.entries(record || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => formatLabel(key));
}

function InfoItem({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value || "Not available"}</p>
    </div>
  );
}

const AnalyticsSubmissionInspector = ({
  open,
  onOpenChange,
  scopeFilters,
  drilldownFilters,
}: AnalyticsSubmissionInspectorProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DrilldownResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, SubmissionDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [activePane, setActivePane] = useState<"preview" | "ai">("preview");
  const [analysisMode, setAnalysisMode] = useState<"selected" | "all">("selected");

  useEffect(() => {
    if (!open || !drilldownFilters) return;

    let active = true;
    setLoading(true);
    setActivePane("preview");
    setAnalysisMode("selected");

    api.analytics
      .getAnalyticsProDrilldown({
        ...scopeFilters,
        ...drilldownFilters,
      })
      .then(({ data: response, error }) => {
        if (!active) return;
        if (error || !response) {
          toast.error(error || "Failed to load submissions");
          setData(null);
          setSelectedId(null);
          return;
        }

        setData(response);
        setSelectedId(response.submissions[0]?.id || null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, drilldownFilters, scopeFilters]);

  useEffect(() => {
    if (!open || !selectedId || detailCache[selectedId]) return;

    let active = true;
    setDetailLoading(true);

    api.submissions.get(selectedId).then(({ data: response, error }) => {
      if (!active) return;
      if (error || !response) {
        toast.error(error || "Failed to load submission detail");
        setDetailLoading(false);
        return;
      }

      setDetailCache((prev) => ({
        ...prev,
        [selectedId]: response,
      }));
      setDetailLoading(false);
    });

    return () => {
      active = false;
    };
  }, [detailCache, open, selectedId]);

  const selectedSummary = useMemo(
    () => data?.submissions.find((item) => item.id === selectedId) || null,
    [data?.submissions, selectedId]
  );
  const selectedDetail = selectedId ? detailCache[selectedId] : null;

  const chatSubmissions = useMemo(() => {
    if (!data) return [];
    const source = analysisMode === "all" ? data.submissions : selectedSummary ? [selectedSummary] : [];

    return source.map((submission) => ({
      id: submission.id,
      fir_number: submission.firNumber,
      district: submission.district,
      place_of_accident: submission.placeOfAccident,
      mandal: submission.mandal,
    }));
  }, [analysisMode, data, selectedSummary]);

  const handleAnalyzeSelected = (submissionId: string) => {
    setSelectedId(submissionId);
    setAnalysisMode("selected");
    setActivePane("ai");
  };

  const handleOpenSignedCopy = async () => {
    if (!selectedDetail?.signed_copy_url) {
      toast.error("Signed copy is not available for this submission");
      return;
    }

    try {
      await openProtectedAsset(selectedDetail.signed_copy_url);
    } catch (error: any) {
      toast.error(error?.message || "Failed to open signed copy");
    }
  };

  const causeGroups = selectedDetail
    ? [
        {
          label: "Driver",
          values: truthyLabels(selectedDetail.driver_related_causes),
        },
        {
          label: "Vehicle",
          values: truthyLabels(selectedDetail.vehicle_condition_causes),
        },
        {
          label: "Road",
          values: [
            ...truthyLabels(selectedDetail.road_engineering_culverts),
            ...truthyLabels(selectedDetail.road_engineering_junctions),
            ...truthyLabels(selectedDetail.road_engineering_median),
            ...truthyLabels(selectedDetail.road_engineering_nature),
            ...truthyLabels(selectedDetail.road_engineering_signages),
          ],
        },
      ].filter((group) => group.values.length > 0)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,1380px)] border-slate-200 bg-[linear-gradient(180deg,#fbfdff_0%,#f3f7fe_100%)] p-0">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#0f274d_0%,#173c73_55%,#2b5c8f_100%)] px-6 py-5 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight">{data?.title || "Loading submissions"}</DialogTitle>
            <DialogDescription className="text-sm text-slate-200">
              Matching submissions for the selected analytics count. Inspect records, open the full submission, or run AI analysis from here.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge className="border-white/20 bg-white/10 text-white">
              {loading ? "Loading..." : `${data?.count || 0} submissions`}
            </Badge>
            {data?.scope.scopeLabel && (
              <Badge variant="outline" className="border-white/20 text-white">
                {data.scope.scopeLabel}
              </Badge>
            )}
            {data?.scope.rangeStart && data?.scope.rangeEnd && (
              <Badge variant="outline" className="border-white/20 text-white">
                {data.scope.rangeStart} to {data.scope.rangeEnd}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid min-h-[78vh] gap-0 lg:grid-cols-[360px_1fr]">
          <div className="border-r border-slate-200 bg-white/80">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Submission Matches</p>
                <p className="text-xs text-slate-500">Choose a case to preview or analyze</p>
              </div>
              {data && data.submissions.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#163a70]/20 bg-[#f4f7fb] text-[#163a70] hover:bg-[#e8f0fb]"
                  onClick={() => {
                    setAnalysisMode("all");
                    setActivePane("ai");
                  }}
                >
                  <Brain className="mr-2 h-4 w-4" />
                  Analyze All
                </Button>
              )}
            </div>

            <ScrollArea className="h-[calc(78vh-73px)]">
              <div className="space-y-3 p-4">
                {loading && (
                  <div className="flex items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading submissions...
                  </div>
                )}

                {!loading && (!data || data.submissions.length === 0) && (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center text-slate-500">
                    No submissions matched this selection.
                  </div>
                )}

                {data?.submissions.map((submission) => {
                  const isActive = submission.id === selectedId;

                  return (
                    <div
                      key={submission.id}
                      className={cn(
                        "cursor-pointer rounded-3xl border p-4 shadow-sm transition-all",
                        isActive
                          ? "border-[#163a70] bg-[linear-gradient(180deg,#f7fbff_0%,#edf4ff_100%)] shadow-[0_16px_36px_-24px_rgba(22,58,112,0.7)]"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      )}
                      onClick={() => {
                        setSelectedId(submission.id);
                        setActivePane("preview");
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{submission.firNumber}</p>
                          <p className="mt-1 text-xs text-slate-500">{submission.district}</p>
                        </div>
                        <Badge
                          className={cn(
                            submission.timelinessStatus === "Timely"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          )}
                        >
                          {submission.timelinessStatus}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{submission.placeOfAccident}, {submission.policeStation}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>{formatDateTime(submission.createdAt)}</span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                          <p className="font-semibold uppercase tracking-wide text-slate-500">Lag</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">{submission.lagHours.toFixed(1)} hrs</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-3 py-2">
                          <p className="font-semibold uppercase tracking-wide text-slate-500">Casualties</p>
                          <p className="mt-1 text-sm font-bold text-slate-900">
                            {submission.personsDied} / {submission.personsInjured}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={isActive ? "default" : "outline"}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(submission.id);
                            setActivePane("preview");
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAnalyzeSelected(submission.id);
                          }}
                        >
                          <Brain className="mr-2 h-4 w-4" />
                          Analyze
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <div className="min-h-0 bg-[linear-gradient(180deg,#fbfdff_0%,#f5f8fe_100%)]">
            <Tabs value={activePane} onValueChange={(value) => setActivePane(value as "preview" | "ai")} className="flex h-full flex-col">
              <div className="border-b border-slate-200 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabsList className="grid h-auto grid-cols-2 rounded-2xl bg-slate-100 p-1">
                    <TabsTrigger value="preview" className="rounded-xl px-4 py-2">Preview</TabsTrigger>
                    <TabsTrigger value="ai" className="rounded-xl px-4 py-2">AI Analysis</TabsTrigger>
                  </TabsList>

                  {selectedSummary && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/submission/${selectedSummary.id}`)}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Full Page
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        onClick={() => handleAnalyzeSelected(selectedSummary.id)}
                      >
                        <Brain className="mr-2 h-4 w-4" />
                        Analyze Selected
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <TabsContent value="preview" className="mt-0 flex-1 px-0 pb-0">
                <ScrollArea className="h-[calc(78vh-124px)]">
                  <div className="space-y-5 p-5">
                    {!selectedSummary && !loading && (
                      <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-20 text-center text-slate-500">
                        Select a submission from the left to inspect it here.
                      </div>
                    )}

                    {selectedSummary && (
                      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{selectedSummary.firNumber}</h3>
                              <Badge variant="outline" className="border-slate-300 text-slate-700">
                                {selectedSummary.district}
                              </Badge>
                              <Badge
                                className={cn(
                                  selectedSummary.timelinessStatus === "Timely"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                )}
                              >
                                {selectedSummary.timelinessStatus}
                              </Badge>
                            </div>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                              {selectedSummary.placeOfAccident}, {selectedSummary.mandal}, {selectedSummary.policeStation}
                            </p>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-3xl bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Submission Lag</p>
                              <p className="mt-2 text-xl font-bold text-slate-900">{selectedSummary.lagHours.toFixed(1)} hrs</p>
                            </div>
                            <div className="rounded-3xl bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Deaths</p>
                              <p className="mt-2 text-xl font-bold text-slate-900">{selectedSummary.personsDied}</p>
                            </div>
                            <div className="rounded-3xl bg-slate-50 px-4 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Injuries</p>
                              <p className="mt-2 text-xl font-bold text-slate-900">{selectedSummary.personsInjured}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {detailLoading && (
                      <div className="flex items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-16 text-slate-500">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading detailed submission view...
                      </div>
                    )}

                    {selectedDetail && (
                      <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <InfoItem label="Place of Accident" value={selectedDetail.place_of_accident} />
                          <InfoItem label="Mandal" value={selectedDetail.mandal} />
                          <InfoItem label="Police Station" value={selectedDetail.police_station} />
                          <InfoItem label="Road Type" value={selectedDetail.road_type} />
                          <InfoItem label="Accident Date" value={formatDate(selectedDetail.accident_date)} />
                          <InfoItem label="Accident Time" value={selectedDetail.accident_time} />
                          <InfoItem label="GPS Coordinates" value={selectedDetail.lat_long} />
                          <InfoItem label="Signed Copy" value={selectedDetail.signed_copy_uploaded ? "Uploaded" : "Pending"} />
                          <InfoItem label="Submission Created" value={selectedDetail.created_at ? formatDateTime(selectedDetail.created_at) : selectedSummary?.createdAt ? formatDateTime(selectedSummary.createdAt) : null} />
                        </div>

                        {(selectedDetail.vehicles?.length || selectedDetail.drivers?.length || selectedDetail.victim_details?.length) && (
                          <div className="grid gap-4 xl:grid-cols-3">
                            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                              <p className="text-sm font-semibold text-slate-900">Vehicles</p>
                              <Separator className="my-3" />
                              <div className="space-y-3">
                                {(selectedDetail.vehicles || []).map((vehicle, index) => (
                                  <div key={`${vehicle.registration_number}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                                    <p className="text-sm font-medium text-slate-900">{vehicle.class_type || "Vehicle"}</p>
                                    <p className="mt-1 text-xs text-slate-500">{vehicle.registration_number || "Registration not captured"}</p>
                                  </div>
                                ))}
                                {(selectedDetail.vehicles || []).length === 0 && (
                                  <p className="text-sm text-slate-500">No vehicle details captured.</p>
                                )}
                              </div>
                            </div>

                            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                              <p className="text-sm font-semibold text-slate-900">Drivers</p>
                              <Separator className="my-3" />
                              <div className="space-y-3">
                                {(selectedDetail.drivers || []).map((driver, index) => (
                                  <div key={`${driver.name}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                                    <p className="text-sm font-medium text-slate-900">{driver.name || "Driver"}</p>
                                    <p className="mt-1 text-xs text-slate-500">{driver.dl_number || "DL not captured"}</p>
                                  </div>
                                ))}
                                {(selectedDetail.drivers || []).length === 0 && (
                                  <p className="text-sm text-slate-500">No driver details captured.</p>
                                )}
                              </div>
                            </div>

                            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                              <p className="text-sm font-semibold text-slate-900">Victims</p>
                              <Separator className="my-3" />
                              <div className="space-y-3">
                                {(selectedDetail.victim_details || []).map((victim, index) => (
                                  <div key={`${victim.name}-${index}`} className="rounded-2xl bg-slate-50 p-3">
                                    <p className="text-sm font-medium text-slate-900">{victim.name}</p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {victim.status === "died" ? "Died" : `${formatLabel(victim.injury_type || "injured")} injury`} • {victim.age} yrs
                                    </p>
                                  </div>
                                ))}
                                {(selectedDetail.victim_details || []).length === 0 && (
                                  <p className="text-sm text-slate-500">No victim detail records captured.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Causative Summary</p>
                              <p className="mt-1 text-xs text-slate-500">Quick view of the captured driver, vehicle, and road factors.</p>
                            </div>
                            {selectedDetail.signed_copy_uploaded && selectedDetail.signed_copy_url && (
                              <Button size="sm" variant="outline" onClick={() => void handleOpenSignedCopy()}>
                                <FileText className="mr-2 h-4 w-4" />
                                Signed Copy
                              </Button>
                            )}
                          </div>

                          <div className="mt-4 space-y-4">
                            {causeGroups.map((group) => (
                              <div key={group.label}>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{group.label}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {group.values.map((value) => (
                                    <Badge key={`${group.label}-${value}`} variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                                      {value}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {causeGroups.length === 0 && (
                              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                                No causative factor details were captured for this submission.
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="ai" className="mt-0 flex-1 px-5 pb-5 pt-5">
                <AccidentChat
                  isOpen={open && activePane === "ai"}
                  submissions={chatSubmissions}
                  title={analysisMode === "all" ? "Drilldown Batch Analysis" : `Submission Analysis${selectedSummary ? ` - ${selectedSummary.firNumber}` : ""}`}
                  variant="panel"
                  className="h-[calc(78vh-164px)]"
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnalyticsSubmissionInspector;
