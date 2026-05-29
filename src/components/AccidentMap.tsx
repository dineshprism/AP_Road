import LeafletFallbackMap from "./LeafletFallbackMap";

interface AccidentData {
  id: string;
  district: string;
  place_of_accident: string;
  lat_long?: string;
  persons_died: number;
  persons_injured: number;
  accident_date: string;
  accident_time: string;
  fir_number: string;
}

interface AccidentMapProps {
  accidents: AccidentData[];
  userDistrict?: string;
  height?: string;
  showHeatmap?: boolean;
  showDistrictBoundaries?: boolean;
  zoom?: number;
}

/** Open-source map (Leaflet + OpenStreetMap/CARTO) — no Google API key required. */
const AccidentMap = (props: AccidentMapProps) => {
  return <LeafletFallbackMap {...props} />;
};

export type { AccidentData, AccidentMapProps };
export default AccidentMap;
