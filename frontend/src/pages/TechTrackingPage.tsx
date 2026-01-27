import { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  RefreshCw,
  User,
  Clock,
  Battery,
  Phone,
  Navigation,
  AlertTriangle,
  CheckCircle,
  Circle,
  History,
  X,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { techApi, type TechnicianLocation, type LocationHistory } from '../services/api';

// Medellín center as default
const DEFAULT_CENTER: [number, number] = [6.2442, -75.5812];

// Fix for default marker icons in Leaflet with webpack/vite
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons by status
const createMarkerIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const greenIcon = createMarkerIcon('#22c55e');
const yellowIcon = createMarkerIcon('#eab308');
const redIcon = createMarkerIcon('#ef4444');

const getMarkerIcon = (minutesAgo: number) => {
  if (minutesAgo <= 5) return greenIcon;
  if (minutesAgo <= 15) return yellowIcon;
  return redIcon;
};

// Component to fit map bounds to markers
function FitBounds({ locations }: { locations: TechnicianLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(
        locations.map(l => [l.latitude, l.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [locations, map]);

  return null;
}

// Component to fit map bounds to route history
function FitBoundsRoute({ history }: { history: LocationHistory[] }) {
  const map = useMap();

  useEffect(() => {
    if (history.length > 0) {
      const bounds = L.latLngBounds(
        history.map(l => [l.latitude, l.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [history, map]);

  return null;
}

// Start marker icon (green flag)
const startIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    background-color: #22c55e;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: white;
    font-weight: bold;
  ">1</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// End marker icon (red flag)
const endIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    background-color: #ef4444;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: white;
    font-weight: bold;
  ">F</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

export default function TechTrackingPage() {
  const [locations, setLocations] = useState<TechnicianLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedTech, setSelectedTech] = useState<TechnicianLocation | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Route view state
  const [showRouteView, setShowRouteView] = useState(false);
  const [routeTechId, setRouteTechId] = useState<string>('');
  const [routeDate, setRouteDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [routeHistory, setRouteHistory] = useState<LocationHistory[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await techApi.getAllLocations();
      setLocations(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchLocations, 30000);
    
    return () => clearInterval(interval);
  }, [fetchLocations]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLocations();
  };

  const handleViewHistory = async (tech: TechnicianLocation) => {
    setSelectedTech(tech);
    setShowHistory(true);
    setLoadingHistory(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const history = await techApi.getLocationHistory(tech.technician_id, today);
      setLocationHistory(history);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load route for selected technician and date
  const loadRoute = async () => {
    if (!routeTechId || !routeDate) return;

    setLoadingRoute(true);
    try {
      const history = await techApi.getLocationHistory(parseInt(routeTechId), routeDate, 500);
      // Reverse to show oldest first (for route drawing)
      setRouteHistory(history.reverse());
    } catch (error) {
      console.error('Error fetching route:', error);
    } finally {
      setLoadingRoute(false);
    }
  };

  // Toggle route view
  const toggleRouteView = () => {
    setShowRouteView(!showRouteView);
    if (!showRouteView) {
      setRouteHistory([]);
      setRouteTechId('');
    }
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  const callTechnician = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const getStatusColor = (minutesAgo: number) => {
    if (minutesAgo <= 5) return 'bg-green-500'; // Active
    if (minutesAgo <= 15) return 'bg-yellow-500'; // Recent
    return 'bg-red-500'; // Stale
  };

  const getStatusText = (minutesAgo: number) => {
    if (minutesAgo <= 5) return 'En línea';
    if (minutesAgo <= 15) return `Hace ${minutesAgo} min`;
    if (minutesAgo <= 60) return `Hace ${minutesAgo} min`;
    const hours = Math.floor(minutesAgo / 60);
    return `Hace ${hours}h ${minutesAgo % 60}min`;
  };

  const getBatteryColor = (level: number | null) => {
    if (level === null) return 'text-gray-400';
    if (level > 50) return 'text-green-500';
    if (level > 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Sort technicians: available first, then by recency
  const sortedLocations = [...locations].sort((a, b) => {
    // Available first
    if (a.is_available && !b.is_available) return -1;
    if (!a.is_available && b.is_available) return 1;
    // Then by recency
    return a.minutes_ago - b.minutes_ago;
  });

  const onlineTechs = locations.filter(t => t.minutes_ago <= 15);
  const offlineTechs = locations.filter(t => t.minutes_ago > 15);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Ubicación de Técnicos
          </h1>
          <p className="text-gray-500">
            Seguimiento GPS en tiempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              Actualizado: {lastUpdate.toLocaleTimeString('es-CO')}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{onlineTechs.length}</p>
              <p className="text-sm text-gray-500">Técnicos en línea</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{offlineTechs.length}</p>
              <p className="text-sm text-gray-500">Sin señal reciente</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-cyan-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{locations.length}</p>
              <p className="text-sm text-gray-500">Total técnicos rastreados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-gray-900">
            {showRouteView ? 'Ver Ruta del Día' : 'Mapa en Tiempo Real'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleRouteView}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                showRouteView
                  ? 'bg-cyan-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {showRouteView ? '← Volver a tiempo real' : '📍 Ver ruta de técnico'}
            </button>
          </div>
        </div>

        {/* Route selector */}
        {showRouteView && (
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Técnico</label>
              <select
                value={routeTechId}
                onChange={(e) => setRouteTechId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 min-w-[200px]"
              >
                <option value="">Seleccionar técnico...</option>
                {locations.map((tech) => (
                  <option key={tech.technician_id} value={tech.technician_id}>
                    {tech.technician_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input
                type="date"
                value={routeDate}
                onChange={(e) => setRouteDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>
            <button
              onClick={loadRoute}
              disabled={!routeTechId || loadingRoute}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loadingRoute ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Cargando...
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4" />
                  Ver ruta
                </>
              )}
            </button>
            {routeHistory.length > 0 && (
              <span className="text-sm text-gray-500">
                {routeHistory.length} puntos registrados
              </span>
            )}
          </div>
        )}

        <div className="h-[400px] bg-gray-100 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
            </div>
          ) : showRouteView ? (
            // Route view map
            routeHistory.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center">
                  <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">Selecciona un técnico y fecha</p>
                  <p className="text-sm text-gray-400">para ver la ruta que recorrió</p>
                </div>
              </div>
            ) : (
              <MapContainer
                key="route-map"
                center={DEFAULT_CENTER}
                zoom={12}
                className="h-full w-full"
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBoundsRoute history={routeHistory} />
                {/* Route line */}
                <Polyline
                  positions={routeHistory.map(l => [l.latitude, l.longitude] as [number, number])}
                  color="#0891b2"
                  weight={4}
                  opacity={0.8}
                />
                {/* Start marker */}
                {routeHistory.length > 0 && (
                  <Marker
                    position={[routeHistory[0].latitude, routeHistory[0].longitude]}
                    icon={startIcon}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold text-green-600">🚀 Inicio del día</p>
                        <p className="text-gray-600">
                          {new Date(routeHistory[0].recorded_at).toLocaleTimeString('es-CO')}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                )}
                {/* End marker */}
                {routeHistory.length > 1 && (
                  <Marker
                    position={[
                      routeHistory[routeHistory.length - 1].latitude,
                      routeHistory[routeHistory.length - 1].longitude,
                    ]}
                    icon={endIcon}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold text-red-600">🏁 Última ubicación</p>
                        <p className="text-gray-600">
                          {new Date(routeHistory[routeHistory.length - 1].recorded_at).toLocaleTimeString('es-CO')}
                        </p>
                        {routeHistory[routeHistory.length - 1].battery_level !== null && (
                          <p className="text-gray-500">🔋 {routeHistory[routeHistory.length - 1].battery_level}%</p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            )
          ) : locations.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No hay ubicaciones registradas</p>
                <p className="text-sm text-gray-400">Los técnicos deben activar el GPS en su app</p>
              </div>
            </div>
          ) : (
            // Real-time view map
            <MapContainer
              key="realtime-map"
              center={DEFAULT_CENTER}
              zoom={12}
              className="h-full w-full"
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds locations={locations} />
              {locations.map((tech) => (
                <Marker
                  key={tech.technician_id}
                  position={[tech.latitude, tech.longitude]}
                  icon={getMarkerIcon(tech.minutes_ago)}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">{tech.technician_name}</p>
                      <p className="text-gray-500">{getStatusText(tech.minutes_ago)}</p>
                      {tech.battery_level !== null && (
                        <p className="text-gray-500">🔋 {tech.battery_level}%</p>
                      )}
                      <button
                        onClick={() => openInMaps(tech.latitude, tech.longitude)}
                        className="mt-2 text-blue-500 hover:underline text-xs"
                      >
                        Abrir en Google Maps →
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}

          {/* Map legend overlay */}
          <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg p-3 shadow-lg text-sm z-[1000]">
            {showRouteView && routeHistory.length > 0 ? (
              <>
                <p className="font-semibold mb-2">Ruta</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Circle className="w-3 h-3 fill-green-500 text-green-500" />
                    <span>Inicio del día</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Circle className="w-3 h-3 fill-red-500 text-red-500" />
                    <span>Última ubicación</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1 bg-cyan-500 rounded" />
                    <span>Recorrido</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold mb-2">Estado</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Circle className="w-3 h-3 fill-green-500 text-green-500" />
                    <span>En línea (&lt; 5 min)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Circle className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    <span>Reciente (5-15 min)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Circle className="w-3 h-3 fill-red-500 text-red-500" />
                    <span>Sin señal (&gt; 15 min)</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Technicians List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Lista de Técnicos</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : sortedLocations.length === 0 ? (
          <div className="p-8 text-center">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No hay técnicos con ubicación registrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedLocations.map((tech) => (
              <div
                key={tech.technician_id}
                className="p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <div className="relative">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white ${getStatusColor(tech.minutes_ago)}`} />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {tech.technician_name}
                        </h3>
                        {!tech.is_available && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            No disponible
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getStatusText(tech.minutes_ago)}
                        </div>
                        
                        {tech.battery_level !== null && (
                          <div className={`flex items-center gap-1 ${getBatteryColor(tech.battery_level)}`}>
                            <Battery className="w-3 h-3" />
                            {tech.battery_level}%
                          </div>
                        )}
                        
                        {tech.accuracy && (
                          <span className="text-xs text-gray-400">
                            ±{Math.round(tech.accuracy)}m
                          </span>
                        )}
                      </div>
                      
                      {tech.current_installation && (
                        <div className="mt-2 bg-cyan-50 rounded-lg px-3 py-2 text-sm">
                          <p className="font-medium text-cyan-800">
                            En instalación: {tech.current_installation.lead_name}
                          </p>
                          <p className="text-cyan-600 text-xs">
                            {tech.current_installation.address}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewHistory(tech)}
                      className="p-2 text-gray-400 hover:text-cyan-500 hover:bg-cyan-50 rounded-lg transition-colors"
                      title="Ver historial"
                    >
                      <History className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => callTechnician(tech.phone)}
                      className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                      title="Llamar"
                    >
                      <Phone className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => openInMaps(tech.latitude, tech.longitude)}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Ver en mapa"
                    >
                      <Navigation className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistory && selectedTech && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">
                  Historial de {selectedTech.technician_name}
                </h3>
                <p className="text-sm text-gray-500">Ubicaciones de hoy</p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {loadingHistory ? (
                <div className="py-8 text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto" />
                </div>
              ) : locationHistory.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No hay historial de ubicaciones para hoy
                </div>
              ) : (
                <div className="space-y-3">
                  {locationHistory.map((loc, index) => (
                    <div
                      key={loc.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {index + 1}
                        </div>
                        {index < locationHistory.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 mt-1" />
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(loc.recorded_at).toLocaleTimeString('es-CO')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          {loc.accuracy && <span>±{Math.round(loc.accuracy)}m</span>}
                          {loc.speed && <span>{(loc.speed * 3.6).toFixed(1)} km/h</span>}
                          {loc.battery_level !== null && <span>🔋 {loc.battery_level}%</span>}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => openInMaps(loc.latitude, loc.longitude)}
                        className="p-1 text-gray-400 hover:text-blue-500"
                      >
                        <Navigation className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
