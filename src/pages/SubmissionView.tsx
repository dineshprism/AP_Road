import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, getApiAssetUrl } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import GovHeader from "@/components/GovHeader";
import CausativeSection from "@/components/CausativeSection";
import {
  DRIVER_RELATED_CAUSES, VEHICLE_CONDITION_CAUSES,
  ROAD_CULVERTS_CAUSES, ROAD_JUNCTIONS_CAUSES,
  ROAD_MEDIAN_CAUSES, ROAD_NATURE_CAUSES, ROAD_SIGNAGES_CAUSES,
} from "@/lib/constants";
import { ArrowLeft, Download, FileDown, FileText as FileTextIcon } from "lucide-react";
import { exportSubmissionPDF, exportSubmissionDOCX } from "@/lib/exportReport";
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
  lat_long: string | null;
  road_type: string;
  accident_date: string;
  accident_time: string;
  persons_died: number;
  persons_injured: number;
  vehicles: any;
  drivers: any;
  driver_related_causes: Record<string, boolean>;
  vehicle_condition_causes: Record<string, boolean>;
  road_engineering_culverts: Record<string, boolean>;
  road_engineering_junctions: Record<string, boolean>;
  road_engineering_median: Record<string, boolean>;
  road_engineering_nature: Record<string, boolean>;
  road_engineering_signages: Record<string, boolean>;
  signed_copy_uploaded: boolean;
  signed_copy_name: string | null;
  signed_copy_url: string | null;
  [key: string]: any;
}

const SubmissionView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, isAdmin } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      api.submissions.get(id).then(({ data }) => {
        setSubmission(data);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) return <div className="min-h-screen bg-background"><GovHeader /><p className="text-center py-12 text-muted-foreground">Loading...</p></div>;
  if (!submission) return <div className="min-h-screen bg-background"><GovHeader /><p className="text-center py-12 text-muted-foreground">Submission not found.</p></div>;

  const s = submission;
  const signedCopyUrl = getApiAssetUrl(s.signed_copy_url);
  const vehicles = (Array.isArray(s.vehicles) ? s.vehicles : []) as { registration_number: string; class_type: string }[];
  const drivers = (Array.isArray(s.drivers) ? s.drivers : []) as { name: string; dl_number: string; licensing_authority: string }[];
  const backTarget = roles.includes("adgp")
    ? "/adgp-dashboard"
    : roles.includes("dgp") || isAdmin
      ? "/admin"
      : "/dashboard";

  const InfoRow = ({ label, value }: { label: string; value: string | number | null }) => (
    <div className="flex justify-between py-2 border-b border-border/50">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <GovHeader />
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => navigate(backTarget)} className="text-primary">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" /> Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportSubmissionPDF(s)}>
                <FileDown className="w-4 h-4 mr-2" /> Download Unsigned PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSubmissionDOCX(s)}>
                <FileTextIcon className="w-4 h-4 mr-2" /> Download Unsigned DOC
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-primary">ANNEXURE — Submission Report</h2>
          <div className="flex justify-center gap-2 mt-2">
            <Badge>{s.district}</Badge>
            <Badge variant="outline">FIR: {s.fir_number}</Badge>
            <Badge variant="secondary">{s.road_type}</Badge>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">A. Location Details</h3>
              <InfoRow label="Place of Accident" value={s.place_of_accident} />
              <InfoRow label="Mandal" value={s.mandal} />
              <InfoRow label="Police Station" value={s.police_station} />
              <InfoRow label="FIR Number" value={s.fir_number} />
              <InfoRow label="GPS Coordinates" value={s.lat_long} />
              <InfoRow label="Road Type" value={s.road_type} />
              <InfoRow label="Date" value={new Date(s.accident_date).toLocaleDateString("en-IN")} />
              <InfoRow label="Time" value={s.accident_time} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">B. Vehicles Involved</h3>
              {vehicles.map((v, i) => (
                <div key={i} className="p-3 bg-muted/30 rounded-lg mb-2">
                  <p className="text-sm font-semibold text-primary mb-1">Vehicle {i + 1}</p>
                  <InfoRow label="Registration" value={v.registration_number} />
                  <InfoRow label="Class/Type" value={v.class_type} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">C. Driver Details</h3>
              {drivers.map((d, i) => (
                <div key={i} className="p-3 bg-muted/30 rounded-lg mb-2">
                  <p className="text-sm font-semibold text-primary mb-1">Driver {i + 1}</p>
                  <InfoRow label="Name" value={d.name} />
                  <InfoRow label="D.L Number" value={d.dl_number} />
                  <InfoRow label="Licensing Authority" value={d.licensing_authority} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">D. Victim Details</h3>
              <InfoRow label="Persons Died" value={s.persons_died} />
              <InfoRow label="Persons Injured" value={s.persons_injured} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">CAUSATIVE ANALYSIS</h3>
              <div className="space-y-6">
                <CausativeSection title="A. Driver Related Causes" items={DRIVER_RELATED_CAUSES} values={(s.driver_related_causes as Record<string, boolean>) || {}} onChange={() => {}} readOnly />
                <CausativeSection title="B. Vehicle Condition Related Causes" items={VEHICLE_CONDITION_CAUSES} values={(s.vehicle_condition_causes as Record<string, boolean>) || {}} onChange={() => {}} readOnly />
                <div className="border-t pt-4">
                  <h4 className="font-bold text-primary mb-3">C. Road Engineering Related Factors</h4>
                  <CausativeSection title="Culverts and Curves" items={ROAD_CULVERTS_CAUSES} values={(s.road_engineering_culverts as Record<string, boolean>) || {}} onChange={() => {}} readOnly />
                  <CausativeSection title="Junctions" items={ROAD_JUNCTIONS_CAUSES} values={(s.road_engineering_junctions as Record<string, boolean>) || {}} onChange={() => {}} readOnly />
                  <CausativeSection title="Median" items={ROAD_MEDIAN_CAUSES} values={(s.road_engineering_median as Record<string, boolean>) || {}} onChange={() => {}} readOnly />
                  <CausativeSection title="Nature of Area" items={ROAD_NATURE_CAUSES} values={(s.road_engineering_nature as Record<string, boolean>) || {}} onChange={() => {}} readOnly />
                  <CausativeSection title="Signages and Road Markings" items={ROAD_SIGNAGES_CAUSES} values={(s.road_engineering_signages as Record<string, boolean>) || {}} onChange={() => {}} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">Signed Copy Record</h3>
              <InfoRow label="Status" value={s.signed_copy_uploaded ? "Uploaded" : "Pending"} />
              <InfoRow label="File Name" value={s.signed_copy_name} />
              {signedCopyUrl && (
                <div className="pt-3">
                  <Button variant="outline" asChild>
                    <a href={signedCopyUrl} target="_blank" rel="noreferrer">
                      Signed Copy
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SubmissionView;
