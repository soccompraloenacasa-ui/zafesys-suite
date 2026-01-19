import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDHvw_UOi-TPHMa8V-qox32wOf6oCJkt2g';

interface Location {
  id: number;
  address: string;
  city: string | null;
  name: string;
  order: number;
}

interface RouteMapProps {
  locations: Location[];
  height?: string;
}

// Load Google Maps script
function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(script);
  });
}

export default function RouteMap({ locations, height = '300px' }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (locations.length === 0) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function initMap() {
      try {
        await loadGoogleMapsScript();

        if (!isMounted || !mapRef.current) return;

        // Initialize map centered on Medellín
        const map = new google.maps.Map(mapRef.current, {
          zoom: 12,
          center: { lat: 6.2442, lng: -75.5812 }, // Medellín
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        mapInstanceRef.current = map;

        // Create directions service and renderer
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true, // We'll add custom markers
          polylineOptions: {
            strokeColor: '#06b6d4',
            strokeWeight: 4,
            strokeOpacity: 0.8,
          },
        });

        directionsRendererRef.current = directionsRenderer;

        // Geocode addresses and create route
        const geocoder = new google.maps.Geocoder();
        const waypoints: google.maps.DirectionsWaypoint[] = [];
        const markers: google.maps.Marker[] = [];

        // Geocode all locations
        const geocodePromises = locations.map((loc, index) => {
          return new Promise<{ location: Location; position: google.maps.LatLng | null }>((resolve) => {
            const fullAddress = loc.city
              ? `${loc.address}, ${loc.city}, Colombia`
              : `${loc.address}, Medellín, Colombia`;

            geocoder.geocode({ address: fullAddress }, (results, status) => {
              if (status === 'OK' && results && results[0]) {
                resolve({ location: loc, position: results[0].geometry.location });
              } else {
                console.warn(`Could not geocode: ${fullAddress}`);
                resolve({ location: loc, position: null });
              }
            });
          });
        });

        const geocodedLocations = await Promise.all(geocodePromises);
        const validLocations = geocodedLocations.filter((g) => g.position !== null);

        if (validLocations.length === 0) {
          setError('No se pudieron encontrar las direcciones');
          setLoading(false);
          return;
        }

        // Add custom markers
        validLocations.forEach((g, index) => {
          if (!g.position) return;

          const marker = new google.maps.Marker({
            position: g.position,
            map,
            label: {
              text: (index + 1).toString(),
              color: 'white',
              fontWeight: 'bold',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 20,
              fillColor: index === 0 ? '#22c55e' : index === validLocations.length - 1 ? '#ef4444' : '#06b6d4',
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 2,
            },
            title: g.location.name,
          });

          // Info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 200px;">
                <strong style="color: #06b6d4;">#${index + 1}</strong>
                <p style="margin: 4px 0; font-weight: 600;">${g.location.name}</p>
                <p style="margin: 0; font-size: 12px; color: #666;">${g.location.address}</p>
              </div>
            `,
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });

          markers.push(marker);
        });

        // Calculate route if more than 1 location
        if (validLocations.length > 1) {
          const origin = validLocations[0].position!;
          const destination = validLocations[validLocations.length - 1].position!;

          // Middle locations as waypoints
          const waypointLocations = validLocations.slice(1, -1);
          waypointLocations.forEach((g) => {
            if (g.position) {
              waypoints.push({
                location: g.position,
                stopover: true,
              });
            }
          });

          directionsService.route(
            {
              origin,
              destination,
              waypoints,
              optimizeWaypoints: false, // We already optimized by zone
              travelMode: google.maps.TravelMode.DRIVING,
            },
            (result, status) => {
              if (status === 'OK' && result) {
                directionsRenderer.setDirections(result);
              }
            }
          );
        } else if (validLocations.length === 1 && validLocations[0].position) {
          // Center on single location
          map.setCenter(validLocations[0].position);
          map.setZoom(15);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Error cargando el mapa');
        setLoading(false);
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div
        className="bg-gray-100 rounded-xl flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-gray-500 text-sm">No hay ubicaciones para mostrar</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height }}>
      {loading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Cargando mapa...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center z-10">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      <div ref={mapRef} className="w-full h-full" />

      {/* Legend */}
      {!loading && !error && (
        <div className="absolute bottom-2 left-2 bg-white rounded-lg shadow-md p-2 text-xs">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span>Inicio</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-4 h-4 rounded-full bg-cyan-500" />
            <span>Parada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span>Final</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Type declaration for google maps
declare global {
  interface Window {
    google: typeof google;
  }
}
