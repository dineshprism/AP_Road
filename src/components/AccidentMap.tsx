import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngBounds, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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
  center?: LatLngExpression;
  zoom?: number;
}

// Dynamic import for heatmap to avoid SSR issues
const HeatmapLayer = React.lazy(() => 
  import('leaflet.heat').then(module => ({ default: module.default }))
);

const AccidentMap: React.FC<AccidentMapProps> = ({
  accidents,
  userDistrict,
  height = '500px',
  showHeatmap = true,
  showDistrictBoundaries = true,
  center = [15.9129, 79.7400], // Center of Andhra Pradesh
  zoom = 7
}) => {
  const mapRef = useRef<any>(null);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [heatmapData, setHeatmapData] = useState<any>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);

  // Load GeoJSON data
  useEffect(() => {
    import('../data/andhra-pradesh-districts.json').then((data) => {
      setGeoJsonData(data.default);
    });
  }, []);

  // Set map bounds to Andhra Pradesh
  const andhraPradeshBounds: LatLngBounds = new LatLngBounds(
    [12.6, 76.8], // Southwest corner of Andhra Pradesh
    [19.1, 84.3]  // Northeast corner of Andhra Pradesh
  );

  // Process accident data for heatmap
  useEffect(() => {
    const heatPoints: any[] = [];
    
    accidents.forEach(accident => {
      if (accident.lat_long) {
        try {
          const [lat, lng] = accident.lat_long.split(',').map(coord => parseFloat(coord.trim()));
          if (!isNaN(lat) && !isNaN(lng)) {
            // Intensity based on severity (deaths + injuries)
            const intensity = Math.min((accident.persons_died * 2 + accident.persons_injured) / 10, 1);
            heatPoints.push([lat, lng, intensity]);
          }
        } catch (error) {
          console.warn('Invalid coordinates:', accident.lat_long);
        }
      }
    });
    
    setHeatmapData(heatPoints);
  }, [accidents]);

  // Filter accidents by district if userDistrict is provided
  const filteredAccidents = userDistrict 
    ? accidents.filter(accident => accident.district === userDistrict)
    : accidents;

  // District boundary style
  const districtStyle = (feature: any) => {
    const districtName = feature.properties.name;
    const accidentCount = accidents.filter(a => a.district === districtName).length;
    const isSelected = selectedDistrict === districtName;
    const isUserDistrict = userDistrict === districtName;
    
    // Color based on accident density
    let fillColor = '#e8f5e8'; // Light green for no accidents
    if (accidentCount > 0 && accidentCount <= 5) fillColor = '#fff3cd'; // Light yellow
    else if (accidentCount > 5 && accidentCount <= 10) fillColor = '#ffc107'; // Yellow
    else if (accidentCount > 10 && accidentCount <= 20) fillColor = '#fd7e14'; // Orange
    else if (accidentCount > 20) fillColor = '#dc3545'; // Red

    return {
      fillColor,
      weight: isSelected ? 3 : isUserDistrict ? 2 : 1,
      opacity: 1,
      color: isSelected ? '#0066cc' : isUserDistrict ? '#28a745' : '#666',
      dashArray: isUserDistrict ? '5,5' : undefined,
      fillOpacity: 0.7
    };
  };

  // District interaction handlers
  const onEachDistrict = (feature: any, layer: any) => {
    const districtName = feature.properties.name;
    const accidentCount = accidents.filter(a => a.district === districtName).length;
    const deaths = accidents.filter(a => a.district === districtName).reduce((sum, a) => sum + a.persons_died, 0);
    const injuries = accidents.filter(a => a.district === districtName).reduce((sum, a) => sum + a.persons_injured, 0);

    layer.bindPopup(`
      <div class="p-2">
        <h4 class="font-bold text-lg">${districtName}</h4>
        <div class="text-sm space-y-1">
          <p><strong>Total Accidents:</strong> ${accidentCount}</p>
          <p><strong>Fatalities:</strong> ${deaths}</p>
          <p><strong>Injuries:</strong> ${injuries}</p>
        </div>
      </div>
    `);

    layer.on({
      click: () => setSelectedDistrict(districtName),
      mouseover: (e: any) => {
        e.target.setStyle({
          weight: 3,
          color: '#0066cc',
          dashArray: undefined
        });
      },
      mouseout: (e: any) => {
        e.target.setStyle(districtStyle(feature));
      }
    });
  };

  // Custom marker icon for accidents
  const createAccidentMarker = (accident: AccidentData) => {
    const severity = accident.persons_died > 0 ? 'high' : accident.persons_injured > 0 ? 'medium' : 'low';
    const colors = {
      high: '#dc3545',
      medium: '#fd7e14', 
      low: '#ffc107'
    };

    return L.divIcon({
      html: `<div style="
        background-color: ${colors[severity]};
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>`,
      iconSize: [16, 16],
      className: 'accident-marker'
    });
  };

  // Heatmap component
  const Heatmap: React.FC<{ data: any[] }> = ({ data }) => {
    const map = useMap();
    
    useEffect(() => {
      if (showHeatmap && data.length > 0) {
        import('leaflet.heat').then((Heat) => {
          const heatmap = Heat.default(data, {
            radius: 25,
            blur: 15,
            maxZoom: 17,
            max: 1.0,
            gradient: {
              0.0: 'green',
              0.5: 'yellow',
              0.7: 'orange',
              1.0: 'red'
            }
          }).addTo(map);
          
          return () => {
            map.removeLayer(heatmap);
          };
        });
      }
    }, [map, data, showHeatmap]);

    return null;
  };

  // Component to set map bounds
  const MapBounds: React.FC = () => {
    const map = useMap();
    
    useEffect(() => {
      // Set strict bounds to Andhra Pradesh
      const bounds: LatLngBounds = new LatLngBounds(
        [12.6, 76.8], // Southwest
        [19.1, 84.3]  // Northeast
      );
      
      map.setMaxBounds(bounds);
      map.setMinZoom(6);
      map.setMaxZoom(12);
      
      // Force map to stay within bounds
      map.on('moveend', () => {
        const center = map.getCenter();
        if (!bounds.contains(center)) {
          map.panTo(bounds.getCenter());
        }
      });
    }, [map]);

    return null;
  };

  return (
    <div className="relative" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
        bounds={andhraPradeshBounds}
        minZoom={6}
        maxZoom={12}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds />
        
        {/* District boundaries */}
        {showDistrictBoundaries && geoJsonData && (
          <GeoJSON
            data={geoJsonData}
            style={districtStyle}
            onEachFeature={onEachDistrict}
          />
        )}

        {/* Heatmap layer */}
        {showHeatmap && heatmapData.length > 0 && (
          <Heatmap data={heatmapData} />
        )}

        {/* Accident markers */}
        {filteredAccidents.map((accident) => {
          if (!accident.lat_long) return null;
          
          try {
            const [lat, lng] = accident.lat_long.split(',').map(coord => parseFloat(coord.trim()));
            if (isNaN(lat) || isNaN(lng)) return null;

            return (
              <Marker
                key={accident.id}
                position={[lat, lng]}
                icon={createAccidentMarker(accident)}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h4 className="font-bold text-sm mb-2">Accident Details</h4>
                    <div className="text-xs space-y-1">
                      <p><strong>Location:</strong> {accident.place_of_accident}</p>
                      <p><strong>Date:</strong> {accident.accident_date}</p>
                      <p><strong>Time:</strong> {accident.accident_time}</p>
                      <p><strong>FIR No:</strong> {accident.fir_number}</p>
                      <p><strong>Fatalities:</strong> <span className="text-red-600 font-bold">{accident.persons_died}</span></p>
                      <p><strong>Injuries:</strong> <span className="text-orange-600 font-bold">{accident.persons_injured}</span></p>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          } catch (error) {
            console.warn('Invalid coordinates for accident:', accident.id);
            return null;
          }
        })}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
        <h4 className="font-bold text-sm mb-2">Accident Density</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-200 border border-gray-300"></div>
            <span>None (0)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-200 border border-gray-300"></div>
            <span>Low (1-5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 border border-gray-300"></div>
            <span>Medium (6-10)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 border border-gray-300"></div>
            <span>High (11-20)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 border border-gray-300"></div>
            <span>Critical (20+)</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-white p-2 rounded-lg shadow-lg z-[1000]">
        <div className="flex flex-col gap-2">
          <button
            className={`px-3 py-1 text-xs rounded ${showHeatmap ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => {/* Toggle heatmap */}}
          >
            {showHeatmap ? 'Hide' : 'Show'} Heatmap
          </button>
          <button
            className={`px-3 py-1 text-xs rounded ${showDistrictBoundaries ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            onClick={() => {/* Toggle boundaries */}}
          >
            {showDistrictBoundaries ? 'Hide' : 'Show'} Boundaries
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccidentMap;
