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
import { techApi, type TechnicianLocation, type LocationHistory } from '../services/api';

// Medellín center as default
const DEFAULT_CENTER = { lat: 6.2442, lng: -75.5812 };

export default function TechTrackingPage() {
  const [locations, setLocations] = useState<TechnicianLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedTech, setSelectedTech] = useState<TechnicianLocation | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Mapa en Tiempo Real</h2>
        </div>
        <div className="h-[400px] bg-gray-100 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
            </div>
          ) : locations.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No hay ubicaciones registradas</p>
                <p className="text-sm text-gray-400">Los técnicos deben activar el GPS en su app</p>
              </div>
            </div>
          ) : (
            <iframe
              title="Mapa de técnicos"
              className="w-full h-full border-0"
              src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyBFw0Qbyq9zTFTd-tUY6CE_UcUG9C3LLA4&center=${locations[0]?.latitude || DEFAULT_CENTER.lat},${locations[0]?.longitude || DEFAULT_CENTER.lng}&zoom=12&maptype=roadmap`}
              allowFullScreen
            />
          )}
          
          {/* Map legend overlay */}
          <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg p-3 shadow-lg text-sm">
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
