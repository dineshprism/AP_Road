import { useEffect, useMemo, useRef, useState } from "react";
import { CircleF, GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import districtGeoJson from "@/data/andhra-pradesh-districts.json";
import LeafletFallbackMap from "./LeafletFallbackMap";
import type { AccidentMapProps } from "./AccidentMap";

type MarkerPoint = AccidentMapProps["accidents"][number] & {
  lat: number;
  lng: number;
  severity: "high" | "medium" | "low";
};

type DistrictPopupState = {
  lat: number;
  lng: number;
  name: string;
  count: number;
  deaths: number;
  injuries: number;
} | null;

type MapTypeOption = "roadmap" | "satellite" | "terrain";

const AP_CENTER = { lat: 15.9129, lng: 79.74 };
const AP_BOUNDS = {
  north: 19.1,
  south: 12.6,
  east: 84.3,
  west: 76.8,
};

const SEVERITY_COLORS: Record<MarkerPoint["severity"], string> = {
  high: "#c62828",
  medium: "#ef6c00",
  low: "#f9a825",
};

function parseMarkerPoint(accident: AccidentMapProps["accidents"][number]): MarkerPoint | null {
  if (!accident.lat_long) return null;

  const [latRaw, lngRaw] = accident.lat_long.split(",").map((value) => Number.parseFloat(value.trim()));
  if (Number.isNaN(latRaw) || Number.isNaN(lngRaw)) return null;

  const severity = accident.persons_died > 0 ? "high" : accident.persons_injured > 0 ? "medium" : "low";

  return { ...accident, lat: latRaw, lng: lngRaw, severity };
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

async function getGoogleMapsApiKey() {
  const response = await fetch("/api/maps/config", { cache: "no-store" });
  if (!response.ok) return "";
  const data = await response.json().catch(() => ({}));
  return String(data.apiKey || "").trim();
}

function extendBounds(
  bounds: { north: number; south: number; east: number; west: number },
  coordinates: unknown,
) {
  if (!Array.isArray(coordinates)) return;

  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number"
  ) {
    const lng = coordinates[0];
    const lat = coordinates[1];
    bounds.north = Math.max(bounds.north, lat);
    bounds.south = Math.min(bounds.south, lat);
    bounds.east = Math.max(bounds.east, lng);
    bounds.west = Math.min(bounds.west, lng);
    return;
  }

  coordinates.forEach((entry) => extendBounds(bounds, entry));
}

function getDistrictBounds(userDistrict?: string) {
  if (!userDistrict) return null;

  const feature = (districtGeoJson.features as Array<{ properties?: Record<string, unknown>; geometry?: unknown }>).find(
    (item) =>
      String(item.properties?.district || item.properties?.name || "").toLowerCase() ===
      userDistrict.toLowerCase(),
  );

  if (!feature?.geometry) return null;

  const bounds = {
    north: Number.NEGATIVE_INFINITY,
    south: Number.POSITIVE_INFINITY,
    east: Number.NEGATIVE_INFINITY,
    west: Number.POSITIVE_INFINITY,
  };

  extendBounds(bounds, (feature.geometry as { coordinates?: unknown }).coordinates);

  if (
    !Number.isFinite(bounds.north) ||
    !Number.isFinite(bounds.south) ||
    !Number.isFinite(bounds.east) ||
    !Number.isFinite(bounds.west)
  ) {
    return null;
  }

  return bounds;
}

function fitMapToScope(map: any, districtBounds: ReturnType<typeof getDistrictBounds>, zoom?: number) {
  if (!map) return;

  const targetBounds = districtBounds || AP_BOUNDS;
  map.fitBounds(targetBounds, 32);

  if (districtBounds && zoom) {
    window.setTimeout(() => {
      if (map.getZoom() > zoom) {
        map.setZoom(zoom);
      }
    }, 100);
  }
}

const GoogleMapWithKey = ({
  apiKey,
  accidents,
  userDistrict,
  height = "500px",
  showHeatmap = true,
  showDistrictBoundaries = true,
  zoom = 7,
}: AccidentMapProps & { apiKey: string }) => {
  const districtLocked = Boolean(userDistrict);
  const mapRef = useRef<any>(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState(showHeatmap);
  const [boundariesEnabled, setBoundariesEnabled] = useState(showDistrictBoundaries);
  const [mapTypeId, setMapTypeId] = useState<MapTypeOption>("roadmap");
  const [selectedPoint, setSelectedPoint] = useState<MarkerPoint | null>(null);
  const [districtPopup, setDistrictPopup] = useState<DistrictPopupState>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "road-accident-google-maps",
    googleMapsApiKey: apiKey,
    version: "weekly",
  });

  useEffect(() => setHeatmapEnabled(showHeatmap), [showHeatmap]);
  useEffect(() => setBoundariesEnabled(showDistrictBoundaries), [showDistrictBoundaries]);

  const markerPoints = useMemo(() => {
    const source = userDistrict ? accidents.filter((accident) => accident.district === userDistrict) : accidents;
    return source.map(parseMarkerPoint).filter((point): point is MarkerPoint => point !== null);
  }, [accidents, userDistrict]);

  const districtCounts = useMemo(() => {
    const counts = new Map<string, { count: number; deaths: number; injuries: number }>();

    accidents.forEach((accident) => {
      const current = counts.get(accident.district) || { count: 0, deaths: 0, injuries: 0 };
      current.count += 1;
      current.deaths += accident.persons_died;
      current.injuries += accident.persons_injured;
      counts.set(accident.district, current);
    });

    return counts;
  }, [accidents]);

  const districtBounds = useMemo(() => getDistrictBounds(userDistrict), [userDistrict]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.google) return;

    const map = mapRef.current;
    const dataLayer = map.data;
    const clickListener = dataLayer.addListener("click", (event: any) => {
      const feature = event.feature;
      const name = String(feature.getProperty("district") || feature.getProperty("name") || "Unknown");
      const stats = districtCounts.get(name) || { count: 0, deaths: 0, injuries: 0 };

      setDistrictPopup({
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
        name,
        count: stats.count,
        deaths: stats.deaths,
        injuries: stats.injuries,
      });
    });

    dataLayer.forEach((feature: any) => {
      dataLayer.remove(feature);
    });

    if (boundariesEnabled) {
      dataLayer.addGeoJson(districtGeoJson);
      dataLayer.setStyle((feature: any) => {
        const name = String(feature.getProperty("district") || feature.getProperty("name") || "");
        const stats = districtCounts.get(name) || { count: 0 };

        if (districtLocked && name.toLowerCase() !== userDistrict?.toLowerCase()) {
          return { fillOpacity: 0, strokeOpacity: 0, clickable: false, visible: false };
        }

        return {
          fillColor: districtFillColor(stats.count),
          fillOpacity: districtLocked ? 0.08 : 0.2,
          strokeColor: districtStrokeColor(stats.count),
          strokeOpacity: 1,
          strokeWeight: districtLocked ? 2.5 : 1.5,
          clickable: true,
          visible: true,
        };
      });
    } else {
      setDistrictPopup(null);
    }

    return () => {
      clickListener.remove();
      dataLayer.forEach((feature: any) => {
        dataLayer.remove(feature);
      });
    };
  }, [isLoaded, districtCounts, boundariesEnabled, userDistrict, districtLocked]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    fitMapToScope(mapRef.current, districtBounds, districtLocked ? 10 : zoom);
  }, [isLoaded, districtBounds, districtLocked, zoom, userDistrict]);

  if (loadError) {
    return (
      <LeafletFallbackMap
        accidents={accidents}
        userDistrict={userDistrict}
        height={height}
        showHeatmap={showHeatmap}
        showDistrictBoundaries={showDistrictBoundaries}
        zoom={zoom}
      />
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center rounded-[24px] border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600" style={{ height }}>
        Loading Google Maps...
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[24px]" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%", borderRadius: "24px" }}
        center={AP_CENTER}
        zoom={zoom}
        onLoad={(map) => {
          mapRef.current = map;
          fitMapToScope(map, districtBounds, districtLocked ? 10 : zoom);
        }}
        onUnmount={() => {
          mapRef.current = null;
        }}
        options={{
          mapTypeId,
          clickableIcons: false,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: true,
          minZoom: 6,
          maxZoom: 18,
          restriction: { latLngBounds: AP_BOUNDS, strictBounds: false },
          styles: mapTypeId === "roadmap"
            ? [
                { featureType: "poi", stylers: [{ visibility: "off" }] },
                { featureType: "transit", stylers: [{ visibility: "off" }] },
              ]
            : undefined,
        }}
      >
        {heatmapEnabled && markerPoints.map((point) => (
          <CircleF
            key={`hotspot-${point.id}`}
            center={{ lat: point.lat, lng: point.lng }}
            radius={Math.max(220, point.persons_died * 180 + point.persons_injured * 90 + 180)}
            options={{
              fillColor: SEVERITY_COLORS[point.severity],
              fillOpacity: point.severity === "high" ? 0.2 : 0.14,
              strokeOpacity: 0,
              clickable: false,
            }}
          />
        ))}

        {markerPoints.map((point) => (
          <MarkerF
            key={point.id}
            position={{ lat: point.lat, lng: point.lng }}
            onClick={() => {
              setSelectedPoint(point);
              setDistrictPopup(null);
            }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: SEVERITY_COLORS[point.severity],
              fillOpacity: 0.98,
              strokeColor: "#ffffff",
              strokeWeight: 3,
              scale: point.severity === "high" ? 9 : point.severity === "medium" ? 8 : 7,
            }}
          />
        ))}

        {selectedPoint && (
          <InfoWindowF
            position={{ lat: selectedPoint.lat, lng: selectedPoint.lng }}
            onCloseClick={() => setSelectedPoint(null)}
          >
            <div style={{ minWidth: 220 }}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", color: "#64748b", textTransform: "uppercase", margin: 0 }}>{selectedPoint.district}</p>
              <h4 style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{selectedPoint.place_of_accident}</h4>
              <div style={{ marginTop: 8, fontSize: 12, color: "#334155", lineHeight: "20px" }}>
                <p style={{ margin: "2px 0" }}><b>FIR:</b> {selectedPoint.fir_number}</p>
                <p style={{ margin: "2px 0" }}><b>Date:</b> {selectedPoint.accident_date}</p>
                <p style={{ margin: "2px 0" }}><b>Time:</b> {selectedPoint.accident_time}</p>
                <p style={{ margin: "2px 0" }}><b>Fatalities:</b> {selectedPoint.persons_died}</p>
                <p style={{ margin: "2px 0" }}><b>Injuries:</b> {selectedPoint.persons_injured}</p>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.lat},${selectedPoint.lng}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", marginTop: 10, padding: "6px 12px", borderRadius: 8, background: "#0f172a", color: "#fff", fontSize: 12, fontWeight: 600, textDecoration: "none" }}
              >
                Open in Google Maps
              </a>
            </div>
          </InfoWindowF>
        )}

        {districtPopup && (
          <InfoWindowF
            position={{ lat: districtPopup.lat, lng: districtPopup.lng }}
            onCloseClick={() => setDistrictPopup(null)}
          >
            <div style={{ minWidth: 170 }}>
              <h4 style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 13 }}>{districtPopup.name}</h4>
              <p style={{ margin: "2px 0", fontSize: 12 }}><b>Total accidents:</b> {districtPopup.count}</p>
              <p style={{ margin: "2px 0", fontSize: 12 }}><b>Fatalities:</b> {districtPopup.deaths}</p>
              <p style={{ margin: "2px 0", fontSize: 12 }}><b>Injuries:</b> {districtPopup.injuries}</p>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      <div className="absolute left-3 top-3 z-[1000] max-w-[320px] rounded-2xl border border-slate-200/90 bg-white/92 p-3 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.42)] backdrop-blur md:left-4 md:top-4 md:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {districtLocked ? "District Control View" : "State Command View"}
        </p>
        <h3 className="mt-1 text-base font-bold text-slate-900 md:text-lg">
          {districtLocked ? `${userDistrict} District Map` : "Andhra Pradesh Accident Map"}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-600 md:text-sm md:leading-6">
          {districtLocked
            ? "The map stays focused on your district boundary only, with every recorded spot and hotspot intensity visible in one place."
            : "State leadership can review the entire Andhra Pradesh map, compare district intensity, and inspect accident spots."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{markerPoints.length} mapped incidents</span>
          <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">{markerPoints.reduce((sum, point) => sum + point.persons_died, 0)} fatalities</span>
          <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
            {mapTypeId === "satellite" ? "Satellite view" : mapTypeId === "terrain" ? "Topo view" : "Street view"}
          </span>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-[1000] flex w-[176px] flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white/92 p-2 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.42)] backdrop-blur md:bottom-auto md:right-4 md:top-4 md:w-[220px]">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          <button className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${mapTypeId === "roadmap" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/80"}`} onClick={() => setMapTypeId("roadmap")}>Street</button>
          <button className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${mapTypeId === "satellite" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/80"}`} onClick={() => setMapTypeId("satellite")}>Sat</button>
          <button className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${mapTypeId === "terrain" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/80"}`} onClick={() => setMapTypeId("terrain")}>Topo</button>
        </div>
        <button className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800" onClick={() => fitMapToScope(mapRef.current, districtBounds, districtLocked ? 10 : zoom)}>Recenter Map</button>
        <button className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${heatmapEnabled ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setHeatmapEnabled((prev) => !prev)}>
          {heatmapEnabled ? "Hide" : "Show"} Hotspots
        </button>
        {!districtLocked && (
          <button className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${boundariesEnabled ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setBoundariesEnabled((prev) => !prev)}>
            {boundariesEnabled ? "Hide" : "Show"} Boundaries
          </button>
        )}
        {districtLocked && (
          <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700">District boundary is always visible in district mode</div>
        )}
      </div>
    </div>
  );
};

const GoogleAccidentMap = (props: AccidentMapProps) => {
  const [apiKey, setApiKey] = useState("");
  const [loadingKey, setLoadingKey] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getGoogleMapsApiKey()
      .then((key) => {
        if (!cancelled) setApiKey(key);
      })
      .finally(() => {
        if (!cancelled) setLoadingKey(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loadingKey) {
    return (
      <div className="flex items-center justify-center rounded-[24px] border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600" style={{ height: props.height || "500px" }}>
        Loading Google Maps...
      </div>
    );
  }

  if (!apiKey) {
    return <LeafletFallbackMap {...props} />;
  }

  return <GoogleMapWithKey {...props} apiKey={apiKey} />;
};

export default GoogleAccidentMap;
