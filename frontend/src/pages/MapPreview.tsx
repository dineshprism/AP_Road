import AccidentMap from "@/components/AccidentMap";
import apLogo from "@/Andhra_Pradesh_logo.jpg";

const SAMPLE_ACCIDENTS = [
  {
    id: "preview-1",
    district: "Krishna",
    place_of_accident: "NH-16, Vijayawada",
    lat_long: "16.5062,80.6480",
    persons_died: 2,
    persons_injured: 4,
    accident_date: "2026-01-12",
    accident_time: "18:45",
    fir_number: "PREVIEW-001",
  },
  {
    id: "preview-2",
    district: "Visakhapatnam",
    place_of_accident: "Beach Road Junction",
    lat_long: "17.6868,83.2185",
    persons_died: 0,
    persons_injured: 3,
    accident_date: "2026-02-03",
    accident_time: "09:15",
    fir_number: "PREVIEW-002",
  },
  {
    id: "preview-3",
    district: "Guntur",
    place_of_accident: "Guntur–Tenali Highway",
    lat_long: "16.3067,80.4365",
    persons_died: 1,
    persons_injured: 2,
    accident_date: "2026-03-20",
    accident_time: "22:10",
    fir_number: "PREVIEW-003",
  },
  {
    id: "preview-4",
    district: "Chittoor",
    place_of_accident: "Tirupati Bypass",
    lat_long: "13.6288,79.4192",
    persons_died: 0,
    persons_injured: 1,
    accident_date: "2026-04-08",
    accident_time: "06:30",
    fir_number: "PREVIEW-004",
  },
  {
    id: "preview-5",
    district: "Kurnool",
    place_of_accident: "Kurnool Ring Road",
    lat_long: "15.8281,78.0373",
    persons_died: 3,
    persons_injured: 0,
    accident_date: "2026-04-25",
    accident_time: "14:00",
    fir_number: "PREVIEW-005",
  },
];

const MapPreview = () => (
  <div className="min-h-screen bg-background">
    <header className="shadow-sm">
      <div className="gov-tricolor-top" />
      <div className="gov-banner px-4 py-3">
        <div className="container mx-auto flex items-center gap-3">
          <img src={apLogo} alt="Government of Andhra Pradesh" className="h-12 w-12 rounded-full object-contain bg-white p-0.5 shadow-md" />
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-wide text-white">Accident Map Preview</h1>
            <p className="text-[11px] font-medium tracking-wide text-white/70">Leaflet · OpenStreetMap · sample data</p>
          </div>
        </div>
      </div>
    </header>
    <div className="mx-auto max-w-[1700px] px-4 py-6">
      <p className="mb-4 text-sm text-muted-foreground">
        Open-source basemaps (OSM, CARTO, OpenTopoMap, Esri). Use the layer control on the map to switch tiles.
      </p>
      <AccidentMap
        accidents={SAMPLE_ACCIDENTS}
        height="72vh"
        showHeatmap
        showDistrictBoundaries
        zoom={7}
      />
    </div>
  </div>
);

export default MapPreview;
