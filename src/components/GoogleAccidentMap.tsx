import { useEffect, useMemo, useRef, useState } from "react";
import districtGeoJson from "@/data/andhra-pradesh-districts.json";
import LeafletFallbackMap from "./LeafletFallbackMap";
import type { AccidentMapProps } from "./AccidentMap";

declare global {
  interface Window {
    google?: any;
    __googleMapsRuntimePromise?: Promise<void>;
  }
}

type MarkerPoint = AccidentMapProps["accidents"][number] & {
  lat: number;
  lng: number;
  severity: "high" | "medium" | "low";
};

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

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve();
  if (window.__googleMapsRuntimePromise) return window.__googleMapsRuntimePromise;

  window.__googleMapsRuntimePromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return window.__googleMapsRuntimePromise;
}

function fitToScope(map: any, points: MarkerPoint[], zoom: number) {
  const bounds = new window.google.maps.LatLngBounds();
  if (points.length === 0) {
    bounds.extend({ lat: AP_BOUNDS.south, lng: AP_BOUNDS.west });
    bounds.extend({ lat: AP_BOUNDS.north, lng: AP_BOUNDS.east });
  } else {
    points.forEach((point) => bounds.extend({ lat: point.lat, lng: point.lng }));
  }
  map.fitBounds(bounds, 32);
  window.setTimeout(() => {
    if (map.getZoom() > zoom) map.setZoom(zoom);
  }, 100);
}

const GoogleAccidentMap = ({
  accidents,
  userDistrict,
  height = "500px",
  showHeatmap = true,
  showDistrictBoundaries = true,
  zoom = 7,
}: AccidentMapProps) => {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(showHeatmap);
  const [boundariesEnabled, setBoundariesEnabled] = useState(showDistrictBoundaries);

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

  useEffect(() => setHeatmapEnabled(showHeatmap), [showHeatmap]);
  useEffect(() => setBoundariesEnabled(showDistrictBoundaries), [showDistrictBoundaries]);

  useEffect(() => {
    let cancelled = false;
    getGoogleMapsApiKey()
      .then((apiKey) => {
        if (!apiKey) throw new Error("Google Maps key is not configured");
        return loadGoogleMaps(apiKey);
      })
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setUseFallback(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapNodeRef.current || mapRef.current || !window.google?.maps) return;
    mapRef.current = new window.google.maps.Map(mapNodeRef.current, {
      center: AP_CENTER,
      zoom,
      clickableIcons: false,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: true,
      minZoom: 6,
      maxZoom: 18,
      restriction: { latLngBounds: AP_BOUNDS, strictBounds: false },
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
      ],
    });
  }, [ready, zoom]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    overlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
    overlaysRef.current = [];
    mapRef.current.data.forEach((feature: any) => mapRef.current.data.remove(feature));

    if (boundariesEnabled) {
      mapRef.current.data.addGeoJson(districtGeoJson);
      mapRef.current.data.setStyle((feature: any) => {
        const district = String(feature.getProperty("district") || feature.getProperty("name") || "");
        const stats = districtCounts.get(district) || { count: 0 };
        const hidden = userDistrict && district.toLowerCase() !== userDistrict.toLowerCase();
        return {
          fillColor: districtFillColor(stats.count),
          fillOpacity: hidden ? 0 : userDistrict ? 0.08 : 0.2,
          strokeColor: districtStrokeColor(stats.count),
          strokeOpacity: hidden ? 0 : 1,
          strokeWeight: userDistrict ? 2.5 : 1.5,
          visible: !hidden,
        };
      });
    }

    markerPoints.forEach((point) => {
      if (heatmapEnabled) {
        overlaysRef.current.push(
          new window.google.maps.Circle({
            map: mapRef.current,
            center: { lat: point.lat, lng: point.lng },
            radius: Math.max(220, point.persons_died * 180 + point.persons_injured * 90 + 180),
            fillColor: SEVERITY_COLORS[point.severity],
            fillOpacity: point.severity === "high" ? 0.2 : 0.14,
            strokeOpacity: 0,
            clickable: false,
          }),
        );
      }

      const marker = new window.google.maps.Marker({
        map: mapRef.current,
        position: { lat: point.lat, lng: point.lng },
        title: point.fir_number,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: SEVERITY_COLORS[point.severity],
          fillOpacity: 0.98,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: point.severity === "high" ? 9 : point.severity === "medium" ? 8 : 7,
        },
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="min-width:220px">
            <p style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#64748b;text-transform:uppercase;margin:0">${point.district}</p>
            <h4 style="margin:4px 0 0;font-size:14px;font-weight:700;color:#0f172a">${point.place_of_accident}</h4>
            <div style="margin-top:8px;font-size:12px;color:#334155;line-height:20px">
              <p style="margin:2px 0"><b>FIR:</b> ${point.fir_number}</p>
              <p style="margin:2px 0"><b>Date:</b> ${point.accident_date}</p>
              <p style="margin:2px 0"><b>Time:</b> ${point.accident_time}</p>
              <p style="margin:2px 0"><b>Fatalities:</b> ${point.persons_died}</p>
              <p style="margin:2px 0"><b>Injuries:</b> ${point.persons_injured}</p>
            </div>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}" target="_blank" rel="noreferrer" style="display:inline-flex;margin-top:10px;padding:6px 12px;border-radius:8px;background:#0f172a;color:#fff;font-size:12px;font-weight:600;text-decoration:none">Open in Google Maps</a>
          </div>
        `,
      });
      marker.addListener("click", () => infoWindow.open({ map: mapRef.current, anchor: marker }));
      overlaysRef.current.push(marker);
    });

    fitToScope(mapRef.current, markerPoints, userDistrict ? 10 : zoom);
  }, [ready, markerPoints, heatmapEnabled, boundariesEnabled, districtCounts, userDistrict, zoom]);

  if (useFallback) {
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

  return (
    <div className="relative overflow-hidden rounded-[24px]" style={{ height }}>
      <div ref={mapNodeRef} className="h-full w-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
          Loading map...
        </div>
      )}
      {ready && (
        <div className="absolute bottom-3 right-3 z-[1000] flex w-[176px] flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white/92 p-2 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.42)] backdrop-blur md:bottom-auto md:right-4 md:top-4 md:w-[220px]">
          <button className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800" onClick={() => fitToScope(mapRef.current, markerPoints, userDistrict ? 10 : zoom)}>
            Recenter Map
          </button>
          <button className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${heatmapEnabled ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setHeatmapEnabled((value) => !value)}>
            {heatmapEnabled ? "Hide" : "Show"} Hotspots
          </button>
          {!userDistrict && (
            <button className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${boundariesEnabled ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setBoundariesEnabled((value) => !value)}>
              {boundariesEnabled ? "Hide" : "Show"} Boundaries
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GoogleAccidentMap;
