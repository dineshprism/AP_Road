import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import GovHeader from "@/components/GovHeader";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Calendar as CalendarIcon, Download, FileSpreadsheet, ShieldCheck } from "lucide-react";

function toIsoDate(value: Date | undefined) {
  return value ? format(value, "yyyy-MM-dd") : "";
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLabel(value: string) {
  const parsed = parseIsoDate(value);
  return parsed ? format(parsed, "dd-MM-yyyy") : value;
}

function getPreviousWeekRange(reference = new Date()) {
  const currentWeekMonday = startOfWeek(reference, { weekStartsOn: 1 });
  const lastWeekMonday = subWeeks(currentWeekMonday, 1);
  const lastWeekSunday = addDays(lastWeekMonday, 6);

  return {
    fromDate: toIsoDate(lastWeekMonday),
    toDate: toIsoDate(lastWeekSunday),
  };
}

const reportSheets = [
  {
    name: "DSR",
    description: "Daily summary by unit with fatal, non-fatal, deaths, injuries, and road-type split.",
  },
  {
    name: "Fatal",
    description: "Unit-wise fatal accident sheet with reason summary, police stations, road type mix, and vehicle impact.",
  },
  {
    name: "Non Fatal",
    description: "Unit-wise non-fatal accident sheet with injury-oriented counts and vehicle mix.",
  },
  {
    name: "Time Wise",
    description: "Time-band summary with fatality and injury counts plus top black-spot units for the selected range.",
  },
];

type DsrDownloadFilters = {
  fromDate?: string;
  toDate?: string;
  preset?: "weekly" | "last-week";
};

const DsrReports = () => {
  const navigate = useNavigate();
  const { roles } = useAuth();
  const [fromDate, setFromDate] = useState(() => getPreviousWeekRange().fromDate);
  const [toDate, setToDate] = useState(() => getPreviousWeekRange().toDate);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const backTarget = useMemo(() => {
    if (roles.includes("prism")) return "/prism-dashboard";
    if (roles.includes("adgp")) return "/adgp-dashboard";
    return "/admin";
  }, [roles]);

  const downloadWorkbook = async (filters: DsrDownloadFilters) => {
    const fallbackRange = filters.fromDate && filters.toDate
      ? { fromDate: filters.fromDate, toDate: filters.toDate }
      : getPreviousWeekRange();

    if (!filters.preset && (!filters.fromDate || !filters.toDate)) {
      toast.error("Please select both From Date and To Date");
      return;
    }

    if (!filters.preset && filters.fromDate! > filters.toDate!) {
      toast.error("From Date cannot be later than To Date");
      return;
    }

    setDownloading(true);
    const { blob, filename, error } = await api.reports.downloadDsrWorkbook(filters);
    setDownloading(false);

    if (error || !blob) {
      toast.error(error || "Failed to download workbook");
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename || `DSR_${formatDateLabel(fallbackRange.fromDate)}_to_${formatDateLabel(fallbackRange.toDate)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    toast.success("Workbook download started");
  };

  const handleDownload = async () => {
    await downloadWorkbook({ fromDate, toDate });
  };

  const handleWeeklyPreset = () => {
    const weeklyRange = getPreviousWeekRange();
    setFromDate(weeklyRange.fromDate);
    setToDate(weeklyRange.toDate);
    toast.success(`Weekly range set: ${formatDateLabel(weeklyRange.fromDate)} to ${formatDateLabel(weeklyRange.toDate)}`);
  };

  const handleWeeklyDownload = async () => {
    const weeklyRange = getPreviousWeekRange();
    setFromDate(weeklyRange.fromDate);
    setToDate(weeklyRange.toDate);
    await downloadWorkbook({ preset: "weekly" });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f9fc_0%,#edf2fb_100%)]">
      <GovHeader />
      <div className="container mx-auto space-y-6 px-4 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" onClick={() => navigate(backTarget)} className="px-0 text-primary hover:bg-transparent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-primary text-white">Workbook Export</Badge>
              <Badge variant="outline" className="border-slate-300 text-slate-700">PRISM / DGP / ADGP</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">DSR Report Download</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Generate a 4-sheet Excel workbook from portal submissions for any selected date range. The export now uses
              your uploaded DSR workbook as the template so the fonts, merged headers, detailing columns, and default
              district rows stay aligned with the sample format.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={handleWeeklyPreset} disabled={downloading} className="h-11 px-5">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Weekly Range
            </Button>
            <Button variant="outline" onClick={() => void handleWeeklyDownload()} disabled={downloading} className="h-11 px-5">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Weekly Download
            </Button>
            <Button onClick={() => void handleDownload()} disabled={downloading} className="h-11 px-6">
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Preparing Workbook..." : "Download XLSX"}
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Report Range
            </CardTitle>
            <CardDescription>Select the reporting window to generate the workbook.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                <CalendarIcon className="mr-1 inline h-3.5 w-3.5" />
                From Date
              </Label>
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start border-slate-300 bg-slate-50 px-3 text-left font-normal text-slate-800 shadow-sm hover:bg-slate-100"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                    {fromDate ? formatDateLabel(fromDate) : "Select From Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseIsoDate(fromDate)}
                    onSelect={(selectedDate) => {
                      const nextValue = toIsoDate(selectedDate);
                      setFromDate(nextValue);
                      if (toDate && nextValue && toDate < nextValue) {
                        setToDate("");
                      }
                      if (selectedDate) setFromOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                <CalendarIcon className="mr-1 inline h-3.5 w-3.5" />
                To Date
              </Label>
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-11 w-full justify-start border-slate-300 bg-slate-50 px-3 text-left font-normal text-slate-800 shadow-sm hover:bg-slate-100"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                    {toDate ? formatDateLabel(toDate) : "Select To Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseIsoDate(toDate)}
                    onSelect={(selectedDate) => {
                      setToDate(toIsoDate(selectedDate));
                      if (selectedDate) setToOpen(false);
                    }}
                    disabled={(date) => Boolean(fromDate) && date < (parseIsoDate(fromDate) || date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Range</p>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {fromDate && toDate ? `${formatDateLabel(fromDate)} to ${formatDateLabel(toDate)}` : "Pick both dates"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Weekly reports should use the previous Monday to Sunday window. On Monday, the Weekly button downloads the just-completed week automatically.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source Reference</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Workbook template studied from uploaded DSR sample</p>
              <p className="mt-2 text-sm text-slate-600">
                CSV conversions were created locally from the 4-sheet sample to guide the generated export format.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {reportSheets.map((sheet) => (
            <Card key={sheet.name} className="border-slate-200 shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FileSpreadsheet className="h-5 w-5" />
                  </span>
                  <div>
                    <CardTitle className="text-lg text-slate-900">{sheet.name}</CardTitle>
                    <CardDescription>Included in every export</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-slate-600">{sheet.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DsrReports;
