import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import districtGeoJson from "@/data/andhra-pradesh-districts.json";

// leaflet.heat has no types — declare minimal shape
import "leaflet.heat";
declare module "leaflet" {
  function heatLayer(
    latlngs: Array<[number, number, number?]>,
    options?: Record<string, unknown>,
  ): L.Layer;
}

/* ------------------------------------------------------------------ */
/*  Shared types (same interface the Google version exposes)           */
/* ------------------------------------------------------------------ */

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

interface LeafletFallbackMapProps {
  accidents: AccidentData[];
  userDistrict?: string;
  height?: string;
  showHeatmap?: boolean;
  showDistrictBoundaries?: boolean;
  zoom?: number;
}

type MarkerPoint = AccidentData & {
  lat: number;
  lng: number;
  severity: "high" | "medium" | "low";
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AP_CENTER: L.LatLngExpression = [15.9129, 79.74];
const AP_BOUNDS: L.LatLngBoundsExpression = [
  [12.6, 76.8],
  [19.1, 84.3],
];

const STREET_TILE_LAYER = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "#c62828",
  medium: "#ef6c00",
  low: "#f9a825",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseMarkerPoint(a: AccidentData): MarkerPoint | null {
  if (!a.lat_long) return null;
  const [latRaw, lngRaw] = a.lat_long.split(",").map((v) => Number.parseFloat(v.trim()));
  if (Number.isNaN(latRaw) || Number.isNaN(lngRaw)) return null;
  const severity =
    a.persons_died > 0 ? "high" : a.persons_injured > 0 ? "medium" : "low";
  return { ...a, lat: latRaw, lng: lngRaw, severity };
}

function districtFillColor(count: number) {
  if (count > 20) return "#b42318";
  if (count > 10) return "#f38744";
  if (count > 5) return "#f5b942";
  if (count > 0) return "#f8e6a8";
  return "#d8ead7";
}

function districtStrokeColor(count: number) {
  if (count > 20) return "#8f1e12";
  if (count > 10) return "#d7661f";
  if (count > 5) return "#c48a10";
  if (count > 0) return "#8c6a17";
  return "#3f6f54";
}

/* ------------------------------------------------------------------ */
/*  Inner component: heatmap layer (uses leaflet.heat)                 */
/* ------------------------------------------------------------------ */

function HeatmapLayer({ points }: { points: MarkerPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return undefined;

    const data: [number, number, number][] = points.map((p) => [
      p.lat,
      p.lng,
      Math.min(p.persons_died * 2 + p.persons_injured, 10) / 10,
    ]);

    const heat = L.heatLayer(data, {
      radius: 25,
      blur: 18,
      maxZoom: 14,
      gradient: {
        0.2: "#27ae60",
        0.4: "#f1c40f",
        0.6: "#f39c12",
        0.85: "#c0392b",
        1.0: "#8f1e12",
      },
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Inner component: fit‐bounds helper                                 */
/* ------------------------------------------------------------------ */

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
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: zoom || 10 });
    }
  }, [map, bounds, zoom]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Inner component: recenter control                                  */
/* ------------------------------------------------------------------ */

function RecenterControl({
  recenterRef,
}: {
  recenterRef: React.MutableRefObject<(() => void) | null>;
}) {
  const map = useMap();

  useEffect(() => {
    recenterRef.current = () => {
      map.fitBounds(AP_BOUNDS, { padding: [30, 30] });
    };
  }, [map, recenterRef]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const LeafletFallbackMap = ({
  accidents,
  userDistrict,
  height = "500px",
  showHeatmap = true,
  showDistrictBoundaries = true,
  zoom = 7,
}: LeafletFallbackMapProps) => {
  const [heatmapEnabled, setHeatmapEnabled] = useState(showHeatmap);
  const [boundariesEnabled, setBoundariesEnabled] = useState(showDistrictBoundaries);
  const recenterRef = useRef<(() => void) | null>(null);

  useEffect(() => setHeatmapEnabled(showHeatmap), [showHeatmap]);
  useEffect(() => setBoundariesEnabled(showDistrictBoundaries), [showDistrictBoundaries]);

  /* ---------- derived data ---------- */

  const markerPoints = useMemo(() => {
    const source = userDistrict
      ? accidents.filter((a) => a.district === userDistrict)
      : accidents;
    return source.map(parseMarkerPoint).filter((p): p is MarkerPoint => p !== null);
  }, [accidents, userDistrict]);

  const districtCounts = useMemo(() => {
    const map = new Map<string, { count: number; deaths: number; injuries: number }>();
    for (const a of accidents) {
      const entry = map.get(a.district) || { count: 0, deaths: 0, injuries: 0 };
      entry.count += 1;
      entry.deaths += a.persons_died;
      entry.injuries += a.persons_injured;
      map.set(a.district, entry);
    }
    return map;
  }, [accidents]);

  const districtLocked = Boolean(userDistrict);

  const districtBounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (!userDistrict) return null;
    const feature = (districtGeoJson.features as GeoJSON.Feature[]).find(
      (f) =>
        (f.properties?.district || f.properties?.name || "").toLowerCase() ===
        userDistrict.toLowerCase(),
    );
    if (!feature) return null;
    const layer = L.geoJSON(feature as GeoJSON.Feature);
    return layer.getBounds();
  }, [userDistrict]);

  /* ---------- GeoJSON style callback ---------- */

  const geoStyle = useCallback(
    (feature: GeoJSON.Feature | undefined) => {
      if (!feature) return {};
      const name = feature.properties?.district || feature.properties?.name || "";
      const stats = districtCounts.get(name) || { count: 0 };

      if (userDistrict && name.toLowerCase() !== userDistrict.toLowerCase()) {
        return { fillOpacity: 0, stroke: false };
      }

      return {
        fillColor: districtFillColor(stats.count),
        fillOpacity: districtLocked ? 0.08 : 0.2,
        color: districtStrokeColor(stats.count),
        weight: districtLocked ? 2.5 : 1.5,
      };
    },
    [districtCounts, userDistrict, districtLocked],
  );

  /* ---------- GeoJSON popup on each feature ---------- */

  const onEachFeature = useCallback(
    (feature: GeoJSON.Feature, layer: L.Layer) => {
      const name = feature.properties?.district || feature.properties?.name || "Unknown";
      const stats = districtCounts.get(name) || { count: 0, deaths: 0, injuries: 0 };

      if (userDistrict && name.toLowerCase() !== userDistrict.toLowerCase()) return;

      layer.bindPopup(
        `<div style="min-width:170px">
          <h4 style="margin:0 0 6px;font-weight:700;font-size:13px">${name}</h4>
          <p style="margin:2px 0;font-size:12px"><b>Total accidents:</b> ${stats.count}</p>
          <p style="margin:2px 0;font-size:12px"><b>Fatalities:</b> ${stats.deaths}</p>
          <p style="margin:2px 0;font-size:12px"><b>Injuries:</b> ${stats.injuries}</p>
        </div>`,
        { closeButton: true },
      );
    },
    [districtCounts, userDistrict],
  );

  /* ---------- render ---------- */

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {userDistrict ? "District Control View" : "State Command View"}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              {userDistrict ? `${userDistrict} District Map` : "Andhra Pradesh Accident Map"}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {userDistrict
                ? "The map stays focused on your district boundary only, with every recorded spot and hotspot intensity visible in one place."
                : "State leadership can review the entire Andhra Pradesh map, compare district intensity, and inspect accident spots."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {markerPoints.length} mapped incidents
            </span>
            <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">
              {markerPoints.reduce((s, p) => s + p.persons_died, 0)} fatalities
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
              Street view
            </span>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[24px]" style={{ height }}>
      <MapContainer
        center={AP_CENTER}
        zoom={zoom}
        maxBounds={AP_BOUNDS}
        minZoom={6}
        maxZoom={18}
        scrollWheelZoom
        style={{ width: "100%", height: "100%", borderRadius: "24px" }}
      >
        <TileLayer url={STREET_TILE_LAYER.url} attribution={STREET_TILE_LAYER.attribution} />

        {/* Fit to district or AP */}
        <FitBounds
          bounds={districtBounds || AP_BOUNDS}
          zoom={districtLocked ? 10 : undefined}
        />

        <RecenterControl recenterRef={recenterRef} />

        {/* District boundaries */}
        {boundariesEnabled && (
          <GeoJSON
            key={`geo-${userDistrict || "all"}`}
            data={districtGeoJson as GeoJSON.FeatureCollection}
            style={geoStyle}
            onEachFeature={onEachFeature}
          />
        )}

        {/* Heatmap */}
        {heatmapEnabled && <HeatmapLayer points={markerPoints} />}

        {/* Accident markers */}
        {markerPoints.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={point.severity === "high" ? 8 : point.severity === "medium" ? 7 : 6}
            pathOptions={{
              fillColor: SEVERITY_COLORS[point.severity],
              fillOpacity: 0.95,
              color: "#ffffff",
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 220 }}>
                <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", color: "#64748b", textTransform: "uppercase", margin: 0 }}>
                  {point.district}
                </p>
                <h4 style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  {point.place_of_accident}
                </h4>
                <div style={{ marginTop: 8, fontSize: 12, color: "#334155", lineHeight: "20px" }}>
                  <p style={{ margin: "2px 0" }}><b>FIR:</b> {point.fir_number}</p>
                  <p style={{ margin: "2px 0" }}><b>Date:</b> {point.accident_date}</p>
                  <p style={{ margin: "2px 0" }}><b>Time:</b> {point.accident_time}</p>
                  <p style={{ margin: "2px 0" }}><b>Fatalities:</b> {point.persons_died}</p>
                  <p style={{ margin: "2px 0" }}><b>Injuries:</b> {point.persons_injured}</p>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    marginTop: 10,
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "#0f172a",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Open in Google Maps
                </a>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* -------- Severity legend (bottom-left) -------- */}
      <div className="absolute bottom-3 left-3 z-[1000] hidden rounded-2xl border border-slate-200/90 bg-white/92 p-3 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.42)] backdrop-blur md:bottom-4 md:left-4 md:block md:p-4">
        <h4 className="text-sm font-semibold text-slate-900">Severity Legend</h4>
        <div className="mt-3 space-y-2 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#c62828]" /> Fatal accidents
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ef6c00]" /> Injury accidents
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#f9a825]" /> Other recorded incidents
          </div>
        </div>
      </div>

      {/* -------- Controls (right panel) -------- */}
      <div className="absolute bottom-3 right-3 z-[1000] flex w-[176px] flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white/92 p-2 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.42)] backdrop-blur md:bottom-auto md:right-4 md:top-4 md:w-[220px]">
        <div className="rounded-xl bg-slate-100 px-3 py-2 text-center text-xs font-semibold text-slate-700">
          Street view only
        </div>

        <button
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          onClick={() => recenterRef.current?.()}
        >
          Recenter Map
        </button>

        <button
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            heatmapEnabled
              ? "bg-primary text-white"
              : "bg-slate-100 text-slate-700"
          }`}
          onClick={() => setHeatmapEnabled((v) => !v)}
        >
          {heatmapEnabled ? "Hide" : "Show"} Hotspots
        </button>

        {!districtLocked && (
          <button
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
              boundariesEnabled
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-700"
            }`}
            onClick={() => setBoundariesEnabled((v) => !v)}
          >
            {boundariesEnabled ? "Hide" : "Show"} Boundaries
          </button>
        )}

        {districtLocked && (
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">
            District boundary is always visible in district mode
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default LeafletFallbackMap;
