import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { Layers, Map as MapIcon, RefreshCw } from "lucide-react";
import districtGeoJson from "@/data/andhra-pradesh-districts.json";
import { BASEMAPS, type BasemapId } from "@/lib/map-tiles";
import { AccidentMarkerPopup, type AccidentMarkerData } from "@/components/map/AccidentMarkerPopup";

declare module "leaflet" {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: Record<string, unknown>,
  ): L.Layer;
}

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

export interface LeafletFallbackMapProps {
  accidents: AccidentData[];
  userDistrict?: string;
  height?: string;
  showHeatmap?: boolean;
  showDistrictBoundaries?: boolean;
  zoom?: number;
}

type MarkerPoint = AccidentMarkerData;

const AP_CENTER: L.LatLngExpression = [15.9129, 79.74];
const AP_BOUNDS: L.LatLngBoundsExpression = [
  [12.6, 76.8],
  [19.1, 84.3],
];

const SEVERITY_COLORS: Record<MarkerPoint["severity"], string> = {
  high: "#c62828",
  medium: "#ef6c00",
  low: "#f9a825",
};

function parseMarkerPoint(accident: AccidentData): MarkerPoint | null {
  if (!accident.lat_long) return null;
  const [latRaw, lngRaw] = accident.lat_long.split(",").map((value) => Number.parseFloat(value.trim()));
  if (Number.isNaN(latRaw) || Number.isNaN(lngRaw)) return null;
  const severity: MarkerPoint["severity"] =
    accident.persons_died > 0 ? "high" : accident.persons_injured > 0 ? "medium" : "low";
  return {
    ...accident,
    lat: latRaw,
    lng: lngRaw,
    severity,
  };
}

function districtFillColor(count: number) {
  if (count > 20) return "#b42318";
  if (count > 10) return "#f38744";
  if (count > 5) return "#f5b942";
  if (count > 0) return "#f8e6a8";
  return "#e8f4e8";
}

function districtStrokeColor(count: number) {
  if (count > 20) return "#8f1e12";
  if (count > 10) return "#d7661f";
  if (count > 5) return "#c48a10";
  if (count > 0) return "#8c6a17";
  return "#3f6f54";
}

function ActiveBasemap({ basemap }: { basemap: BasemapId }) {
  const config = BASEMAPS[basemap];
  return (
    <TileLayer
      key={basemap}
      url={config.url}
      attribution={config.attribution}
      maxZoom={config.maxZoom}
    />
  );
}

function HeatmapLayer({ points }: { points: MarkerPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return undefined;

    const data: [number, number, number][] = points.map((point) => [
      point.lat,
      point.lng,
      Math.min(point.persons_died * 2 + point.persons_injured, 10) / 10,
    ]);

    const heat = L.heatLayer(data, {
      radius: 28,
      blur: 20,
      maxZoom: 14,
      gradient: {
        0.15: "#22c55e",
        0.35: "#eab308",
        0.55: "#f97316",
        0.75: "#dc2626",
        1.0: "#7f1d1d",
      },
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

function FitBounds({
  bounds,
  zoom,
}: {
  bounds: L.LatLngBoundsExpression | null;
  zoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: zoom || 10 });
    }
  }, [map, bounds, zoom]);

  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(timer);
  }, [map]);
  return null;
}

function RecenterControl({
  recenterRef,
  bounds,
  zoom,
}: {
  recenterRef: React.MutableRefObject<(() => void) | null>;
  bounds: L.LatLngBoundsExpression | null;
  zoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    recenterRef.current = () => {
      if (bounds) {
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: zoom || 10 });
        return;
      }
      map.fitBounds(AP_BOUNDS, { padding: [36, 36] });
    };
  }, [map, recenterRef, bounds, zoom]);

  return null;
}

const LeafletFallbackMap = ({
  accidents,
  userDistrict,
  height = "500px",
  showHeatmap = true,
  showDistrictBoundaries = true,
  zoom = 7,
}: LeafletFallbackMapProps) => {
  const [basemap, setBasemap] = useState<BasemapId>("street");
  const [heatmapEnabled, setHeatmapEnabled] = useState(showHeatmap);
  const [boundariesEnabled, setBoundariesEnabled] = useState(showDistrictBoundaries);
  const recenterRef = useRef<(() => void) | null>(null);

  useEffect(() => setHeatmapEnabled(showHeatmap), [showHeatmap]);
  useEffect(() => setBoundariesEnabled(showDistrictBoundaries), [showDistrictBoundaries]);

  const markerPoints = useMemo(() => {
    const source = userDistrict
      ? accidents.filter((accident) => accident.district === userDistrict)
      : accidents;
    return source.map(parseMarkerPoint).filter((point): point is MarkerPoint => point !== null);
  }, [accidents, userDistrict]);

  const districtCounts = useMemo(() => {
    const counts = new Map<string, { count: number; deaths: number; injuries: number }>();
    for (const accident of accidents) {
      const entry = counts.get(accident.district) || { count: 0, deaths: 0, injuries: 0 };
      entry.count += 1;
      entry.deaths += accident.persons_died;
      entry.injuries += accident.persons_injured;
      counts.set(accident.district, entry);
    }
    return counts;
  }, [accidents]);

  const districtLocked = Boolean(userDistrict);
  const totalFatalities = markerPoints.reduce((sum, point) => sum + point.persons_died, 0);
  const totalInjuries = markerPoints.reduce((sum, point) => sum + point.persons_injured, 0);

  const districtBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (!userDistrict) return null;
    const feature = (districtGeoJson.features as GeoJSON.Feature[]).find(
      (item) =>
        (item.properties?.district || item.properties?.name || "").toString().toLowerCase() ===
        userDistrict.toLowerCase(),
    );
    if (!feature) return null;
    return L.geoJSON(feature as GeoJSON.Feature).getBounds();
  }, [userDistrict]);

  const geoStyle = useCallback(
    (feature: GeoJSON.Feature | undefined) => {
      if (!feature) return {};
      const name = (feature.properties?.district || feature.properties?.name || "").toString();
      const stats = districtCounts.get(name) || { count: 0 };

      if (userDistrict && name.toLowerCase() !== userDistrict.toLowerCase()) {
        return { fillOpacity: 0, stroke: false };
      }

      return {
        fillColor: districtFillColor(stats.count),
        fillOpacity: districtLocked ? 0.12 : 0.22,
        color: districtStrokeColor(stats.count),
        weight: districtLocked ? 2.5 : 1.6,
        opacity: 0.9,
      };
    },
    [districtCounts, userDistrict, districtLocked],
  );

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature, layer: L.Layer) => {
      const name = (feature.properties?.district || feature.properties?.name || "Unknown").toString();
      const stats = districtCounts.get(name) || { count: 0, deaths: 0, injuries: 0 };

      if (userDistrict && name.toLowerCase() !== userDistrict.toLowerCase()) return;

      layer.bindPopup(
        `<div style="min-width:180px;font-family:system-ui,sans-serif">
          <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#64748b">District</p>
          <h4 style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a">${name}</h4>
          <p style="margin:2px 0;font-size:12px;color:#334155"><b>Accidents:</b> ${stats.count}</p>
          <p style="margin:2px 0;font-size:12px;color:#334155"><b>Fatalities:</b> ${stats.deaths}</p>
          <p style="margin:2px 0;font-size:12px;color:#334155"><b>Injuries:</b> ${stats.injuries}</p>
        </div>`,
      );
    },
    [districtCounts, userDistrict],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {userDistrict ? "District Control View" : "State Command View"}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                <MapIcon className="h-3 w-3" />
                OpenStreetMap · Free & open source
              </span>
            </div>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              {userDistrict ? `${userDistrict} District Map` : "Andhra Pradesh Accident Map"}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {userDistrict
                ? "District boundary, incident locations, and hotspot intensity — no API key required."
                : "Review statewide accident density, district boundaries, and individual incident locations."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {markerPoints.length} mapped incidents
            </span>
            <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">
              {totalFatalities} fatalities
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800">
              {totalInjuries} injuries
            </span>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-slate-200/80 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.35)]" style={{ height }}>
        <MapContainer
          center={AP_CENTER}
          zoom={zoom}
          maxBounds={AP_BOUNDS}
          minZoom={6}
          maxZoom={BASEMAPS[basemap].maxZoom || 18}
          scrollWheelZoom
          className="z-0"
          style={{ width: "100%", height: "100%" }}
        >
          <ActiveBasemap basemap={basemap} />
          <MapResizeFix />
          <FitBounds bounds={districtBounds || AP_BOUNDS} zoom={districtLocked ? 10 : undefined} />
          <RecenterControl recenterRef={recenterRef} bounds={districtBounds || AP_BOUNDS} zoom={districtLocked ? 10 : undefined} />

          {boundariesEnabled && (
            <GeoJSON
              key={`geo-${userDistrict || "all"}-${basemap}`}
              data={districtGeoJson as GeoJSON.FeatureCollection}
              style={geoStyle}
              onEachFeature={onEachFeature}
            />
          )}

          {heatmapEnabled && <HeatmapLayer points={markerPoints} />}

          {markerPoints.map((point) => (
            <CircleMarker
              key={point.id}
              center={[point.lat, point.lng]}
              radius={point.severity === "high" ? 9 : point.severity === "medium" ? 7 : 6}
              pathOptions={{
                fillColor: SEVERITY_COLORS[point.severity],
                fillOpacity: 0.95,
                color: "#ffffff",
                weight: 2.5,
              }}
            >
              <Popup className="accident-map-popup" closeButton>
                <AccidentMarkerPopup point={point} />
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {markerPoints.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-slate-900/10 p-6 backdrop-blur-[1px]">
            <div className="max-w-sm rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 text-center shadow-lg">
              <p className="text-sm font-semibold text-slate-900">No geocoded incidents on the map</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Submissions need a valid latitude/longitude in the location field to appear here.
              </p>
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-3 z-[1000] hidden max-w-[200px] rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-lg backdrop-blur md:block">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Severity</h4>
          <div className="mt-2 space-y-1.5 text-xs text-slate-700">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#c62828] ring-2 ring-white" /> Fatal
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ef6c00] ring-2 ring-white" /> Injury
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#f9a825] ring-2 ring-white" /> Other
            </div>
          </div>
          {!districtLocked && (
            <>
              <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">District density</h4>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full">
                <span className="flex-1 bg-[#e8f4e8]" />
                <span className="flex-1 bg-[#f8e6a8]" />
                <span className="flex-1 bg-[#f5b942]" />
                <span className="flex-1 bg-[#f38744]" />
                <span className="flex-1 bg-[#b42318]" />
              </div>
              <p className="mt-1 text-[10px] text-slate-500">Low → high accident count</p>
            </>
          )}
        </div>

        <div className="absolute bottom-3 right-3 z-[1000] flex w-[188px] flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-lg backdrop-blur md:bottom-auto md:right-4 md:top-4 md:w-[224px]">
          <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            <Layers className="h-3.5 w-3.5" />
            Basemap
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                  basemap === id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setBasemap(id)}
              >
                {BASEMAPS[id].label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
            onClick={() => recenterRef.current?.()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recenter
          </button>

          <button
            type="button"
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
              heatmapEnabled ? "bg-primary text-white" : "bg-slate-100 text-slate-700"
            }`}
            onClick={() => setHeatmapEnabled((value) => !value)}
          >
            {heatmapEnabled ? "Hide" : "Show"} Hotspots
          </button>

          {!districtLocked && (
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                boundariesEnabled ? "bg-primary text-white" : "bg-slate-100 text-slate-700"
              }`}
              onClick={() => setBoundariesEnabled((value) => !value)}
            >
              {boundariesEnabled ? "Hide" : "Show"} Boundaries
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeafletFallbackMap;
