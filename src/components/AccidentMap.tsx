import { useEffect, useMemo, useState } from "react";
import {
  GoogleMap,
  HeatmapLayerF,
  InfoWindowF,
  MarkerF,
  PolygonF,
  useJsApiLoader,
} from "@react-google-maps/api";
import districtGeoJson from "@/data/andhra-pradesh-districts.json";
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

type GeoFeature = {
  properties: { name?: string; district?: string };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

type MarkerPoint = AccidentData & {
  lat: number;
  lng: number;
  severity: "high" | "medium" | "low";
};

type MapViewMode = "roadmap" | "satellite" | "hybrid";

const AP_BOUNDS = {
  north: 19.1,
  south: 12.6,
  east: 84.3,
  west: 76.8,
};

const GOOGLE_MAP_LIBRARIES: ("visualization")[] = ["visualization"];

function flattenCoordinates(feature: GeoFeature): google.maps.LatLngLiteral[] {
  if (feature.geometry.type === "Polygon") {
    return feature.geometry.coordinates[0].map(([lng, lat]) => ({ lat, lng }));
  }

  return feature.geometry.coordinates[0][0].map(([lng, lat]) => ({ lat, lng }));
}

function buildBounds(points: google.maps.LatLngLiteral[]): google.maps.LatLngBoundsLiteral {
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);

  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}

function parseMarkerPoint(accident: AccidentData): MarkerPoint | null {
  if (!accident.lat_long) return null;

  const [latRaw, lngRaw] = accident.lat_long.split(",").map((value) => Number.parseFloat(value.trim()));
  if (Number.isNaN(latRaw) || Number.isNaN(lngRaw)) return null;

  const severity = accident.persons_died > 0 ? "high" : accident.persons_injured > 0 ? "medium" : "low";

  return {
    ...accident,
    lat: latRaw,
    lng: lngRaw,
    severity,
  };
}

function districtFillColor(accidentCount: number) {
  if (accidentCount > 20) return "#b42318";
  if (accidentCount > 10) return "#f38744";
  if (accidentCount > 5) return "#f5b942";
  if (accidentCount > 0) return "#f8e6a8";
  return "#d8ead7";
}

function districtStrokeColor(accidentCount: number) {
  if (accidentCount > 20) return "#8f1e12";
  if (accidentCount > 10) return "#d7661f";
  if (accidentCount > 5) return "#c48a10";
  if (accidentCount > 0) return "#8c6a17";
  return "#3f6f54";
}

function applyDistrictViewport(map: google.maps.Map, points: google.maps.LatLngLiteral[]) {
  if (typeof google === "undefined" || points.length === 0) return;

  const bounds = new google.maps.LatLngBounds();
  points.forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, 56);

  google.maps.event.addListenerOnce(map, "idle", () => {
    const currentZoom = map.getZoom();
    if (typeof currentZoom === "number" && currentZoom > 9) {
      map.setZoom(9);
    }
  });
}

const AccidentMap = ({
  accidents,
  userDistrict,
  height = "500px",
  showHeatmap = true,
  showDistrictBoundaries = true,
  zoom = 7,
}: AccidentMapProps) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useJsApiLoader({
    id: "ap-road-accident-google-map",
    googleMapsApiKey: apiKey || "",
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [activeDistrict, setActiveDistrict] = useState<string | null>(null);
  const [heatmapEnabled, setHeatmapEnabled] = useState(showHeatmap);
  const [boundariesEnabled, setBoundariesEnabled] = useState(showDistrictBoundaries);
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>("roadmap");

  useEffect(() => {
    setHeatmapEnabled(showHeatmap);
  }, [showHeatmap]);

  useEffect(() => {
    setBoundariesEnabled(showDistrictBoundaries);
  }, [showDistrictBoundaries]);

  const markerPoints = useMemo(() => {
    const source = userDistrict
      ? accidents.filter((accident) => accident.district === userDistrict)
      : accidents;

    return source.map(parseMarkerPoint).filter((point): point is MarkerPoint => point !== null);
  }, [accidents, userDistrict]);

  const districtFeatures = useMemo(() => {
    return (districtGeoJson.features as GeoFeature[]).map((feature) => {
      const name = feature.properties.district || feature.properties.name || "Unknown";
      const paths = flattenCoordinates(feature);
      const count = accidents.filter((accident) => accident.district === name).length;
      const deaths = accidents
        .filter((accident) => accident.district === name)
        .reduce((total, accident) => total + accident.persons_died, 0);
      const injuries = accidents
        .filter((accident) => accident.district === name)
        .reduce((total, accident) => total + accident.persons_injured, 0);

      return {
        name,
        feature,
        paths,
        bounds: buildBounds(paths),
        count,
        deaths,
        injuries,
      };
    });
  }, [accidents]);

  const selectedDistrictFeature = useMemo(() => {
    if (!userDistrict) return null;
    return districtFeatures.find((feature) => feature.name.toLowerCase() === userDistrict.toLowerCase()) || null;
  }, [districtFeatures, userDistrict]);

  const districtLocked = Boolean(selectedDistrictFeature);

  const visibleDistrictFeatures = useMemo(() => {
    if (userDistrict && selectedDistrictFeature) {
      return [selectedDistrictFeature];
    }

    return districtFeatures;
  }, [districtFeatures, selectedDistrictFeature, userDistrict]);

  const activeMarker = markerPoints.find((point) => point.id === activeMarkerId) || null;
  const activeDistrictData = districtFeatures.find((feature) => feature.name === activeDistrict) || null;

  const mapOptions = useMemo<google.maps.MapOptions>(() => ({
    disableDefaultUI: false,
    zoomControl: true,
    fullscreenControl: true,
    streetViewControl: true,
    mapTypeControl: true,
    scaleControl: true,
    clickableIcons: false,
    gestureHandling: "greedy",
    keyboardShortcuts: true,
    mapTypeId: mapViewMode,
    restriction: {
      latLngBounds: selectedDistrictFeature?.bounds || AP_BOUNDS,
      strictBounds: districtLocked,
    },
    minZoom: districtLocked ? 6 : 6,
    maxZoom: 18,
  }), [districtLocked, mapViewMode, selectedDistrictFeature]);

  const heatmapData = useMemo(() => {
    if (!isLoaded || typeof google === "undefined") return [];

    return markerPoints.map((point) => ({
      location: new google.maps.LatLng(point.lat, point.lng),
      weight: Math.min(point.persons_died * 2 + point.persons_injured, 10),
    }));
  }, [isLoaded, markerPoints]);

  useEffect(() => {
    if (!map || typeof google === "undefined" || !trafficEnabled) return undefined;

    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);

    return () => {
      trafficLayer.setMap(null);
    };
  }, [map, trafficEnabled]);

  useEffect(() => {
    if (!map || typeof google === "undefined") return;

    if (selectedDistrictFeature) {
      applyDistrictViewport(map, selectedDistrictFeature.paths);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: AP_BOUNDS.south, lng: AP_BOUNDS.west });
    bounds.extend({ lat: AP_BOUNDS.north, lng: AP_BOUNDS.east });

    if (markerPoints.length > 0) {
      markerPoints.forEach((point) => bounds.extend({ lat: point.lat, lng: point.lng }));
    }

    map.fitBounds(bounds, 24);
    if (markerPoints.length === 0) {
      map.setZoom(zoom);
    }
  }, [map, markerPoints, selectedDistrictFeature, zoom]);

  useEffect(() => {
    setBoundariesEnabled(districtLocked || showDistrictBoundaries);
  }, [districtLocked, showDistrictBoundaries]);

  const focusMap = () => {
    if (!map || typeof google === "undefined") return;

    if (selectedDistrictFeature) {
      applyDistrictViewport(map, selectedDistrictFeature.paths);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: AP_BOUNDS.south, lng: AP_BOUNDS.west });
    bounds.extend({ lat: AP_BOUNDS.north, lng: AP_BOUNDS.east });
    markerPoints.forEach((point) => bounds.extend({ lat: point.lat, lng: point.lng }));
    map.fitBounds(bounds, 24);
  };

  if (!apiKey) {
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
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-600" style={{ height }}>
        Loading map...
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[24px]" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={selectedDistrictFeature ? selectedDistrictFeature.paths[0] : { lat: 15.9129, lng: 79.7400 }}
        zoom={selectedDistrictFeature ? 10 : zoom}
        options={mapOptions}
        onLoad={setMap}
        onClick={() => {
          setActiveMarkerId(null);
          setActiveDistrict(null);
        }}
      >
        {boundariesEnabled && visibleDistrictFeatures.map((district) => (
          <PolygonF
            key={district.name}
            paths={district.paths}
            options={{
              fillColor: districtFillColor(district.count),
              fillOpacity: mapViewMode === "roadmap" ? (districtLocked ? 0.08 : 0.16) : 0.04,
              strokeColor: districtLocked ? "#0f4c81" : districtStrokeColor(district.count),
              strokeOpacity: 1,
              strokeWeight: activeDistrict === district.name || userDistrict === district.name ? 3 : 1.5,
              clickable: !districtLocked,
              zIndex: activeDistrict === district.name ? 4 : 2,
            }}
            onClick={() => {
              if (!districtLocked) {
                setActiveDistrict(district.name);
                setActiveMarkerId(null);
              }
            }}
          />
        ))}

        {heatmapEnabled && heatmapData.length > 0 && (
          <HeatmapLayerF
            data={heatmapData}
            options={{
              radius: 28,
              opacity: 0.7,
              gradient: [
                "rgba(39, 174, 96, 0)",
                "rgba(39, 174, 96, 1)",
                "rgba(241, 196, 15, 1)",
                "rgba(243, 156, 18, 1)",
                "rgba(192, 57, 43, 1)",
              ],
            }}
          />
        )}

        {markerPoints.map((point) => (
          <MarkerF
            key={point.id}
            position={{ lat: point.lat, lng: point.lng }}
            onClick={() => {
              setActiveMarkerId(point.id);
              setActiveDistrict(null);
            }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: point.severity === "high" ? 8 : point.severity === "medium" ? 7 : 6,
              fillColor: point.severity === "high" ? "#c62828" : point.severity === "medium" ? "#ef6c00" : "#f9a825",
              fillOpacity: 0.95,
              strokeColor: "#ffffff",
              strokeWeight: 2,
            }}
          />
        ))}

        {activeMarker && (
          <InfoWindowF
            position={{ lat: activeMarker.lat, lng: activeMarker.lng }}
            onCloseClick={() => setActiveMarkerId(null)}
          >
            <div className="min-w-[220px] pr-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{activeMarker.district}</p>
              <h4 className="mt-1 text-sm font-bold text-slate-900">{activeMarker.place_of_accident}</h4>
              <div className="mt-2 space-y-1 text-xs text-slate-700">
                <p><strong>FIR:</strong> {activeMarker.fir_number}</p>
                <p><strong>Date:</strong> {activeMarker.accident_date}</p>
                <p><strong>Time:</strong> {activeMarker.accident_time}</p>
                <p><strong>Fatalities:</strong> {activeMarker.persons_died}</p>
                <p><strong>Injuries:</strong> {activeMarker.persons_injured}</p>
              </div>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${activeMarker.lat},${activeMarker.lng}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                Open in Google Maps
              </a>
            </div>
          </InfoWindowF>
        )}

        {activeDistrictData && !userDistrict && (
          <InfoWindowF
            position={activeDistrictData.paths[0]}
            onCloseClick={() => setActiveDistrict(null)}
          >
            <div className="min-w-[200px] pr-2">
              <h4 className="text-sm font-bold text-slate-900">{activeDistrictData.name}</h4>
              <div className="mt-2 space-y-1 text-xs text-slate-700">
                <p><strong>Total accidents:</strong> {activeDistrictData.count}</p>
                <p><strong>Fatalities:</strong> {activeDistrictData.deaths}</p>
                <p><strong>Injuries:</strong> {activeDistrictData.injuries}</p>
              </div>
            </div>
          </InfoWindowF>
        )}
      </GoogleMap>

      <div className="absolute left-3 top-3 z-10 max-w-[320px] rounded-2xl border border-slate-200/90 bg-white/92 p-3 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.42)] backdrop-blur md:left-4 md:top-4 md:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {userDistrict ? "District Control View" : "State Command View"}
        </p>
        <h3 className="mt-1 text-base font-bold text-slate-900 md:text-lg">
          {userDistrict ? `${userDistrict} District Map` : "Andhra Pradesh Accident Map"}
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-600 md:text-sm md:leading-6">
          {userDistrict
            ? "The map stays focused on your district boundary only, with every recorded spot, live traffic, and hotspot intensity visible in one place."
            : "State leadership can review the entire Andhra Pradesh map, compare district intensity, and inspect accident spots with live traffic context."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{markerPoints.length} mapped incidents</span>
          <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-700">
            {markerPoints.reduce((sum, point) => sum + point.persons_died, 0)} fatalities
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            {trafficEnabled ? "Live traffic on" : "Live traffic off"}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-700">
            {mapViewMode === "roadmap" ? "Road view" : mapViewMode === "satellite" ? "Satellite view" : "Hybrid view"}
          </span>
        </div>
      </div>

      <div className="absolute bottom-3 left-3 z-10 hidden rounded-2xl border border-slate-200/90 bg-white/92 p-3 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.42)] backdrop-blur md:bottom-4 md:left-4 md:block md:p-4">
        <h4 className="text-sm font-semibold text-slate-900">Severity Legend</h4>
        <div className="mt-3 space-y-2 text-xs text-slate-700">
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#c62828]" /> Fatal accidents</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#ef6c00]" /> Injury accidents</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#f9a825]" /> Other recorded incidents</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Live traffic layer</div>
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-10 flex w-[176px] flex-col gap-2 rounded-2xl border border-slate-200/90 bg-white/92 p-2 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.42)] backdrop-blur md:bottom-auto md:right-4 md:top-4 md:w-[220px]">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {(["roadmap", "satellite", "hybrid"] as MapViewMode[]).map((mode) => (
            <button
              key={mode}
              className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition ${
                mapViewMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
              onClick={() => setMapViewMode(mode)}
            >
              {mode === "roadmap" ? "Road" : mode === "satellite" ? "Sat" : "Hybrid"}
            </button>
          ))}
        </div>
        <button
          className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
          onClick={focusMap}
        >
          Recenter Map
        </button>
        <button
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${trafficEnabled ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}
          onClick={() => setTrafficEnabled((value) => !value)}
        >
          {trafficEnabled ? "Hide" : "Show"} Traffic
        </button>
        <button
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${heatmapEnabled ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`}
          onClick={() => setHeatmapEnabled((value) => !value)}
        >
          {heatmapEnabled ? "Hide" : "Show"} Hotspots
        </button>
        {!districtLocked && (
          <button
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${boundariesEnabled ? "bg-primary text-white" : "bg-slate-100 text-slate-700"}`}
            onClick={() => setBoundariesEnabled((value) => !value)}
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
  );
};

export default AccidentMap;
