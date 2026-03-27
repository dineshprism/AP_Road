import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import GovHeader from "@/components/GovHeader";
import CausativeSection from "@/components/CausativeSection";
import {
  ROAD_TYPES,
  DRIVER_RELATED_CAUSES, VEHICLE_CONDITION_CAUSES,
  ROAD_CULVERTS_CAUSES, ROAD_JUNCTIONS_CAUSES,
  ROAD_MEDIAN_CAUSES, ROAD_NATURE_CAUSES, ROAD_SIGNAGES_CAUSES,
} from "@/lib/constants";
import { DISTRICT_HIERARCHY } from "@/lib/districtHierarchy";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface Vehicle { registration_number: string; class_type: string; }
interface Driver { name: string; dl_number: string; licensing_authority: string; }
type CauseAnswers = Record<string, boolean>;

function hasAnsweredAllQuestions(items: string[], values: CauseAnswers) {
  return items.every((item) => Object.prototype.hasOwnProperty.call(values, item));
}

const AccidentForm = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state as { sdpo?: string; policeStation?: string }) || {};
  const [loading, setLoading] = useState(false);
  const [showCausativeValidation, setShowCausativeValidation] = useState(false);

  // Location
  const district = profile?.district || "";
  const [placeOfAccident, setPlaceOfAccident] = useState("");
  const [mandal, setMandal] = useState("");
  const [policeStation, setPoliceStation] = useState(navState.policeStation || "");
  const [firNumber, setFirNumber] = useState("");
  const [latLong, setLatLong] = useState("");
  const [roadType, setRoadType] = useState("");
  const [accidentDate, setAccidentDate] = useState("");
  const [accidentTime, setAccidentTime] = useState("");

  // Vehicles & Drivers
  const [vehicles, setVehicles] = useState<Vehicle[]>([{ registration_number: "", class_type: "" }]);
  const [drivers, setDrivers] = useState<Driver[]>([{ name: "", dl_number: "", licensing_authority: "" }]);

  // Victims
  const [personsDied, setPersonsDied] = useState(0);
  const [personsInjured, setPersonsInjured] = useState(0);

  // Causative
  const [driverCauses, setDriverCauses] = useState<CauseAnswers>({});
  const [vehicleCauses, setVehicleCauses] = useState<CauseAnswers>({});
  const [culvertsCauses, setCulvertsCauses] = useState<CauseAnswers>({});
  const [junctionsCauses, setJunctionsCauses] = useState<CauseAnswers>({});
  const [medianCauses, setMedianCauses] = useState<CauseAnswers>({});
  const [natureCauses, setNatureCauses] = useState<CauseAnswers>({});
  const [signagesCauses, setSignagesCauses] = useState<CauseAnswers>({});

  const causativeSections = [
    { items: DRIVER_RELATED_CAUSES, values: driverCauses },
    { items: VEHICLE_CONDITION_CAUSES, values: vehicleCauses },
    { items: ROAD_CULVERTS_CAUSES, values: culvertsCauses },
    { items: ROAD_JUNCTIONS_CAUSES, values: junctionsCauses },
    { items: ROAD_MEDIAN_CAUSES, values: medianCauses },
    { items: ROAD_NATURE_CAUSES, values: natureCauses },
    { items: ROAD_SIGNAGES_CAUSES, values: signagesCauses },
  ];

  const policeStationOptions = district
    ? Object.entries(DISTRICT_HIERARCHY[district] || {})
        .flatMap(([, stations]) => stations)
        .slice()
        .sort()
    : [];

  const addVehicle = () => setVehicles([...vehicles, { registration_number: "", class_type: "" }]);
  const removeVehicle = (i: number) => setVehicles(vehicles.filter((_, idx) => idx !== i));
  const updateVehicle = (i: number, field: keyof Vehicle, val: string) => {
    const v = [...vehicles]; v[i] = { ...v[i], [field]: val }; setVehicles(v);
  };

  const addDriver = () => setDrivers([...drivers, { name: "", dl_number: "", licensing_authority: "" }]);
  const removeDriver = (i: number) => setDrivers(drivers.filter((_, idx) => idx !== i));
  const updateDriver = (i: number, field: keyof Driver, val: string) => {
    const d = [...drivers]; d[i] = { ...d[i], [field]: val }; setDrivers(d);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!district || !placeOfAccident || !mandal || !policeStation || !firNumber || !roadType || !accidentDate || !accidentTime) {
      toast.error("Please fill all required fields in Basic Details");
      return;
    }
    const hasCompletedCausativeAnalysis = causativeSections.every(({ items, values }) =>
      hasAnsweredAllQuestions(items, values)
    );
    if (!hasCompletedCausativeAnalysis) {
      setShowCausativeValidation(true);
      toast.error("Please answer Yes or No for every question in the Causative Analysis section");
      return;
    }

    setShowCausativeValidation(false);
    setLoading(true);
    const { error } = await api.submissions.create({
      district,
      place_of_accident: placeOfAccident,
      mandal,
      police_station: policeStation,
      fir_number: firNumber,
      lat_long: latLong || null,
      road_type: roadType,
      accident_date: accidentDate,
      accident_time: accidentTime,
      persons_died: personsDied,
      persons_injured: personsInjured,
      vehicles,
      drivers,
      driver_related_causes: driverCauses,
      vehicle_condition_causes: vehicleCauses,
      road_engineering_culverts: culvertsCauses,
      road_engineering_junctions: junctionsCauses,
      road_engineering_median: medianCauses,
      road_engineering_nature: natureCauses,
      road_engineering_signages: signagesCauses,
    });

    if (error) {
      toast.error("Submission failed: " + error);
    } else {
      toast.success("Form submitted successfully!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <GovHeader />
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-4 text-primary">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
        </Button>

        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-primary">ANNEXURE</h2>
          <p className="text-sm text-muted-foreground">Fatal Road Accident — Scientific Investigation Template</p>
          <p className="text-xs text-muted-foreground mt-1">
            To be filled by the Multi-Agency Investigation Team and placed before DRSC every month
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section A: Location Details */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">A. Location Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Place of Accident *</Label><Input value={placeOfAccident} onChange={(e) => setPlaceOfAccident(e.target.value)} required /></div>
                <div><Label>Mandal *</Label><Input value={mandal} onChange={(e) => setMandal(e.target.value)} required /></div>
                <div>
                  <Label>Police Station Limits *</Label>
                  <Select value={policeStation} onValueChange={setPoliceStation}>
                    <SelectTrigger><SelectValue placeholder="Select Police Station" /></SelectTrigger>
                    <SelectContent>
                      {policeStationOptions.map((ps) => (
                        <SelectItem key={ps} value={ps}>{ps}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>FIR Number *</Label><Input value={firNumber} onChange={(e) => setFirNumber(e.target.value)} required /></div>
                <div><Label>LAT - LONG (GPS)</Label><Input value={latLong} onChange={(e) => setLatLong(e.target.value)} placeholder="e.g., 15.9129, 79.7400" /></div>
                <div>
                  <Label>Type of Road *</Label>
                  <Select value={roadType} onValueChange={setRoadType}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {ROAD_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Date (DD/MM/YY) *</Label><Input type="date" value={accidentDate} onChange={(e) => setAccidentDate(e.target.value)} required /></div>
                <div><Label>Time (24:00 format) *</Label><Input type="time" value={accidentTime} onChange={(e) => setAccidentTime(e.target.value)} required /></div>
              </div>
            </CardContent>
          </Card>

          {/* Section B: Vehicles */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="gov-section-title mb-0 border-0 pb-0">B. Vehicles Involved</h3>
                <Button type="button" variant="outline" size="sm" onClick={addVehicle}><Plus className="w-4 h-4 mr-1" /> Add Vehicle</Button>
              </div>
              {vehicles.map((v, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 p-3 bg-muted/30 rounded-lg">
                  <div className="md:col-span-3 flex justify-between items-center">
                    <span className="text-sm font-semibold text-primary">Vehicle {i + 1}</span>
                    {vehicles.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeVehicle(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                  </div>
                  <div><Label>Registration Number</Label><Input value={v.registration_number} onChange={(e) => updateVehicle(i, "registration_number", e.target.value)} /></div>
                  <div><Label>Class / Type</Label><Input value={v.class_type} onChange={(e) => updateVehicle(i, "class_type", e.target.value)} /></div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section C: Drivers */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="gov-section-title mb-0 border-0 pb-0">C. Driver Details</h3>
                <Button type="button" variant="outline" size="sm" onClick={addDriver}><Plus className="w-4 h-4 mr-1" /> Add Driver</Button>
              </div>
              {drivers.map((d, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 p-3 bg-muted/30 rounded-lg">
                  <div className="md:col-span-3 flex justify-between items-center">
                    <span className="text-sm font-semibold text-primary">Driver {i + 1}</span>
                    {drivers.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => removeDriver(i)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                  </div>
                  <div><Label>Name</Label><Input value={d.name} onChange={(e) => updateDriver(i, "name", e.target.value)} /></div>
                  <div><Label>D.L Number</Label><Input value={d.dl_number} onChange={(e) => updateDriver(i, "dl_number", e.target.value)} /></div>
                  <div><Label>Licensing Authority</Label><Input value={d.licensing_authority} onChange={(e) => updateDriver(i, "licensing_authority", e.target.value)} /></div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section D: Victims */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">D. Victim Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>No. of Persons Died</Label><Input type="number" min={0} value={personsDied} onChange={(e) => setPersonsDied(parseInt(e.target.value) || 0)} /></div>
                <div><Label>No. of Persons Injured</Label><Input type="number" min={0} value={personsInjured} onChange={(e) => setPersonsInjured(parseInt(e.target.value) || 0)} /></div>
              </div>
            </CardContent>
          </Card>

          {/* Causative Analysis */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">CAUSATIVE ANALYSIS</h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Every question below is mandatory. Select either <span className="font-semibold text-emerald-700">Yes</span> or <span className="font-semibold text-rose-700">No</span> for each item.
              </p>
              <div className="space-y-6">
                <CausativeSection title="A. Driver Related Causes" items={DRIVER_RELATED_CAUSES} values={driverCauses} onChange={setDriverCauses} showRequiredState={showCausativeValidation} />
                <CausativeSection title="B. Vehicle Condition Related Causes" items={VEHICLE_CONDITION_CAUSES} values={vehicleCauses} onChange={setVehicleCauses} showRequiredState={showCausativeValidation} />
                <div className="border-t pt-4">
                  <h4 className="font-bold text-primary mb-3">C. Road Engineering Related Factors</h4>
                  <div className="space-y-4">
                    <CausativeSection title="Culverts and Curves" items={ROAD_CULVERTS_CAUSES} values={culvertsCauses} onChange={setCulvertsCauses} showRequiredState={showCausativeValidation} />
                    <CausativeSection title="Junctions" items={ROAD_JUNCTIONS_CAUSES} values={junctionsCauses} onChange={setJunctionsCauses} showRequiredState={showCausativeValidation} />
                    <CausativeSection title="Median" items={ROAD_MEDIAN_CAUSES} values={medianCauses} onChange={setMedianCauses} showRequiredState={showCausativeValidation} />
                    <CausativeSection title="Nature of Area" items={ROAD_NATURE_CAUSES} values={natureCauses} onChange={setNatureCauses} showRequiredState={showCausativeValidation} />
                    <CausativeSection title="Signages and Road Markings" items={ROAD_SIGNAGES_CAUSES} values={signagesCauses} onChange={setSignagesCauses} showRequiredState={showCausativeValidation} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Signature Blocks */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="gov-section-title">Signatures and Seal</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Leave this space blank in the downloaded report for physical signatures and official stamp.
              </p>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {[
                  "Prepared by (IO / SHO)",
                  "Verified by (DSP / CI)",
                  "Approved by (SP / Addl. SP)",
                ].map((label) => (
                  <div key={label} className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-4">
                    <p className="mb-3 text-sm font-semibold text-primary">{label}</p>
                    <div className="h-28 rounded-md border border-dashed border-slate-300 bg-white" />
                    <div className="mt-4 border-t border-slate-400 pt-2 text-xs text-muted-foreground">
                      Signature / Stamp
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-muted-foreground">
                After download and physical approval, upload the signed copy from the past submissions page for records.
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3 pb-8">
            <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>Cancel</Button>
            <Button type="submit" disabled={loading} className="px-8">
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccidentForm;
