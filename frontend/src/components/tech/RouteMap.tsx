import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDHvw_UOi-TPHMa8V-qox32wOf6oCJkt2g';

interface MapLocation {
  id: number;
  address: string;
  city?: string | null;
  name: string;
  order: number;
}

interface RouteMapProps {
  locations: MapLocation[];
  height?: string;
}

// Cargar script de Google Maps
function loadGoogleMapsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
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

        // Crear mapa centrado en Medellín
        const map = new google.maps.Map(mapRef.current, {
          zoom: 12,
          center: { lat: 6.2442, lng: -75.5812 }, // Medellín
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }],
            },
          ],
        });

        mapInstanceRef.current = map;

        // Crear DirectionsRenderer
        const directionsRenderer = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true, // Usaremos marcadores personalizados
          polylineOptions: {
            strokeColor: '#0891b2', // cyan-600
            strokeWeight: 4,
            strokeOpacity: 0.8,
          },
        });
        directionsRendererRef.current = directionsRenderer;

        // Geocodificar direcciones y mostrar ruta
        await displayRoute(map, directionsRenderer, locations);

        setLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        if (isMounted) {
          setError('Error al cargar el mapa');
          setLoading(false);
        }
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, [locations]);

  async function displayRoute(
    map: google.maps.Map,
    directionsRenderer: google.maps.DirectionsRenderer,
    locs: MapLocation[]
  ) {
    if (locs.length === 0) return;

    const directionsService = new google.maps.DirectionsService();
    const geocoder = new google.maps.Geocoder();

    // Geocodificar todas las direcciones
    const geocodedLocations = await Promise.all(
      locs.map(async (loc) => {
        const fullAddress = loc.city
          ? `${loc.address}, ${loc.city}, Colombia`
          : `${loc.address}, Medellín, Colombia`;

        try {
          const result = await geocoder.geocode({ address: fullAddress });
          if (result.results[0]) {
            return {
              ...loc,
              position: result.results[0].geometry.location,
            };
          }
        } catch (e) {
          console.error(`Error geocoding ${fullAddress}:`, e);
        }
        return null;
      })
    );

    const validLocations = geocodedLocations.filter(
      (loc): loc is MapLocation & { position: google.maps.LatLng } => loc !== null
    );

    if (validLocations.length === 0) {
      setError('No se pudieron encontrar las direcciones');
      return;
    }

    // Agregar marcadores personalizados
    validLocations.forEach((loc) => {
      const marker = new google.maps.Marker({
        position: loc.position,
        map,
        label: {
          text: loc.order.toString(),
          color: 'white',
          fontWeight: 'bold',
          fontSize: '14px',
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 18,
          fillColor: '#0891b2',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 3,
        },
        title: `${loc.order}. ${loc.name}`,
      });

      // Info window al hacer click
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; max-width: 200px;">
            <div style="font-weight: bold; color: #0891b2; margin-bottom: 4px;">
              #${loc.order} ${loc.name}
            </div>
            <div style="font-size: 12px; color: #666;">
              ${loc.address}${loc.city ? `, ${loc.city}` : ''}
            </div>
          </div>
        `,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    });

    // Si hay más de una ubicación, mostrar la ruta
    if (validLocations.length > 1) {
      const origin = validLocations[0].position;
      const destination = validLocations[validLocations.length - 1].position;
      const waypoints = validLocations.slice(1, -1).map((loc) => ({
        location: loc.position,
        stopover: true,
      }));

      try {
        const result = await directionsService.route({
          origin,
          destination,
          waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false, // Ya están optimizados
        });

        directionsRenderer.setDirections(result);
      } catch (e) {
        console.error('Error getting directions:', e);
        // Si falla la ruta, al menos ajustar el zoom a los marcadores
        const bounds = new google.maps.LatLngBounds();
        validLocations.forEach((loc) => bounds.extend(loc.position));
        map.fitBounds(bounds);
      }
    } else {
      // Solo una ubicación, centrar en ella
      map.setCenter(validLocations[0].position);
      map.setZoom(15);
    }
  }

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
      <div ref={mapRef} className="w-full h-full" />

      {loading && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Cargando mapa...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
