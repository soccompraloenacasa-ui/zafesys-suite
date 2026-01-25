import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Phone,
  ChevronRight,
  LogOut,
  RefreshCw,
  Navigation,
  Package,
  CircleDollarSign,
  ToggleLeft,
  ToggleRight,
  Route,
  Map,
  X,
  Locate,
  MapPinOff,
} from 'lucide-react';
import { techApi } from '../../services/api';
import { locationTracker } from '../../services/locationTracker';
import RouteMap from '../../components/tech/RouteMap';

interface TechInstallation {
  id: number;
  lead_name: string;
  lead_phone: string;
  product_name: string;
  product_model: string;
  product_image: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  address: string;
  city: string | null;
  address_notes: string | null;
  status: string;
  payment_status: string;
  total_price: number;
  amount_paid: number;
  customer_notes: string | null;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-700' },
  en_camino: { label: 'En camino', color: 'bg-indigo-100 text-indigo-700' },
  en_progreso: { label: 'En progreso', color: 'bg-purple-100 text-purple-700' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
};

const paymentLabels: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Sin pagar', color: 'bg-red-100 text-red-700' },
  parcial: { label: 'Parcial', color: 'bg-yellow-100 text-yellow-700' },
  pagado: { label: 'Pagado', color: 'bg-green-100 text-green-700' },
};

function optimizeRoute(installations: TechInstallation[]): TechInstallation[] {
  const pending = installations.filter(
    (i) => i.status !== 'completada' && i.status !== 'cancelada'
  );

  const byCity: Record<string, TechInstallation[]> = {};
  pending.forEach((inst) => {
    const city = (inst.city || 'Sin ciudad').toLowerCase().trim();
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(inst);
  });

  Object.keys(byCity).forEach((city) => {
    byCity[city].sort((a, b) => {
      const timeA = a.scheduled_time || '23:59:59';
      const timeB = b.scheduled_time || '23:59:59';
      return timeA.localeCompare(timeB);
    });
  });

  const sortedCities = Object.keys(byCity).sort(
    (a, b) => byCity[b].length - byCity[a].length
  );

  const optimized: TechInstallation[] = [];
  sortedCities.forEach((city) => {
    optimized.push(...byCity[city]);
  });

  return optimized;
}

function generateGoogleMapsRouteUrl(installations: TechInstallation[]): string {
  if (installations.length === 0) return '';

  const maxWaypoints = 10;
  const limited = installations.slice(0, maxWaypoints);

  const addresses = limited.map((inst) => {
    const fullAddress = inst.city
      ? `${inst.address}, ${inst.city}, Colombia`
      : `${inst.address}, Colombia`;
    return encodeURIComponent(fullAddress);
  });

  if (addresses.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${addresses[0]}&travelmode=driving`;
  }

  const origin = addresses[0];
  const destination = addresses[addresses.length - 1];
  const waypoints = addresses.slice(1, -1).join('|');

  if (waypoints) {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  } else {
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
  }
}

export default function TechDashboardPage() {
  const navigate = useNavigate();
  const [installations, setInstallations] = useState<TechInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [techName, setTechName] = useState('');
  const [showRouteView, setShowRouteView] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; model: string; name: string } | null>(null);
  
  // GPS Tracking state
  const [isTrackingGPS, setIsTrackingGPS] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const techId = parseInt(localStorage.getItem('tech_id') || '0');

  useEffect(() => {
    if (!techId) {
      navigate('/tech/login');
      return;
    }

    setTechName(localStorage.getItem('tech_name') || 'Tecnico');
    fetchInstallations();
    fetchProfile();
    
    // Start GPS tracking
    startGPSTracking();

    // Cleanup on unmount
    return () => {
      // Don't stop tracking on unmount - keep it running in background
    };
  }, [techId, navigate]);

  const startGPSTracking = async () => {
    const success = await locationTracker.startTracking(techId);
    setIsTrackingGPS(success);
    
    if (!success) {
      setGpsError('No se pudo activar el GPS');
    }
    
    // Subscribe to location updates
    locationTracker.onLocationUpdate((location, error) => {
      if (error) {
        setGpsError(error);
        setIsTrackingGPS(false);
      } else if (location) {
        setGpsError(null);
        setIsTrackingGPS(true);
      }
    });
  };

  const fetchInstallations = async () => {
    try {
      const data = await techApi.getMyInstallations(techId);
      setInstallations(data);
    } catch (error) {
      console.error('Error fetching installations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const profile = await techApi.getProfile(techId);
      setIsAvailable(profile.is_available);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInstallations();
  };

  const handleToggleAvailability = async () => {
    try {
      await techApi.updateAvailability(techId, !isAvailable);
      setIsAvailable(!isAvailable);
      
      // Control GPS tracking based on availability
      if (!isAvailable) {
        // Turning available ON - start tracking
        startGPSTracking();
      } else {
        // Turning available OFF - stop tracking
        locationTracker.stopTracking();
        setIsTrackingGPS(false);
      }
    } catch (error) {
      console.error('Error updating availability:', error);
    }
  };

  const handleLogout = () => {
    // Stop GPS tracking on logout
    locationTracker.stopTracking();
    
    localStorage.removeItem('tech_token');
    localStorage.removeItem('tech_id');
    localStorage.removeItem('tech_name');
    navigate('/tech/login');
  };

  const openMaps = (address: string, city?: string | null) => {
    const fullAddress = city ? `${address}, ${city}` : address;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    window.open(url, '_blank');
  };

  const callPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const openFullRoute = () => {
    const optimized = optimizeRoute(installations);
    const url = generateGoogleMapsRouteUrl(optimized);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleImageClick = (e: React.MouseEvent, installation: TechInstallation) => {
    e.stopPropagation();
    if (installation.product_image) {
      setEnlargedImage({
        url: installation.product_image,
        model: installation.product_model,
        name: installation.product_name,
      });
    }
  };

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const pendingInstallations = installations.filter(
    (i) => i.status !== 'completada' && i.status !== 'cancelada'
  );
  const pendingCount = pendingInstallations.length;
  const optimizedInstallations = optimizeRoute(installations);

  const mapLocations = optimizedInstallations.map((inst, index) => ({
    id: inst.id,
    address: inst.address,
    city: inst.city,
    name: inst.lead_name,
    order: index + 1,
  }));

  const groupedByCity: Record<string, TechInstallation[]> = {};
  optimizedInstallations.forEach((inst) => {
    const city = inst.city || 'Sin ciudad';
    if (!groupedByCity[city]) groupedByCity[city] = [];
    groupedByCity[city].push(inst);
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-cyan-500 text-white px-4 pt-6 pb-8 safe-area-top">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-cyan-100 text-sm">Hola,</p>
            <h1 className="text-xl font-bold">{techName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* GPS Status Indicator */}
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
              isTrackingGPS 
                ? 'bg-green-500/30 text-green-100' 
                : 'bg-red-500/30 text-red-200'
            }`}>
              {isTrackingGPS ? (
                <>
                  <Locate className="w-3 h-3 animate-pulse" />
                  GPS
                </>
              ) : (
                <>
                  <MapPinOff className="w-3 h-3" />
                  GPS
                </>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-cyan-600 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-cyan-600 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* GPS Error Banner */}
        {gpsError && (
          <div className="bg-red-500/30 border border-red-400/50 rounded-lg px-3 py-2 mb-4 text-sm">
            ⚠️ {gpsError}. Tu ubicación no se está reportando.
          </div>
        )}

        {/* Availability Toggle */}
        <div
          onClick={handleToggleAvailability}
          className="flex items-center justify-between bg-cyan-600/50 rounded-lg p-3 cursor-pointer"
        >
          <div>
            <span className="font-medium">
              {isAvailable ? 'Disponible' : 'No disponible'}
            </span>
            {isAvailable && isTrackingGPS && (
              <p className="text-xs text-cyan-200 mt-0.5">📍 Ubicación activa</p>
            )}
          </div>
          {isAvailable ? (
            <ToggleRight className="w-8 h-8 text-green-300" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-gray-300" />
          )}
        </div>
      </div>

      {/* Date & Count */}
      <div className="px-4 -mt-4">
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 capitalize">{today}</p>
            <p className="text-lg font-semibold text-gray-900">
              {pendingCount} instalacion{pendingCount !== 1 ? 'es' : ''} pendiente{pendingCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-12 h-12 bg-cyan-50 rounded-full flex items-center justify-center">
            <Package className="w-6 h-6 text-cyan-600" />
          </div>
        </div>
      </div>

      {/* View Toggle */}
      {pendingCount > 0 && (
        <div className="px-4 mt-4">
          <div className="bg-white rounded-xl shadow-sm p-1 flex">
            <button
              onClick={() => setShowRouteView(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                !showRouteView ? 'bg-cyan-500 text-white' : 'text-gray-600'
              }`}
            >
              <Package className="w-4 h-4" />
              <span className="text-sm font-medium">Lista</span>
            </button>
            <button
              onClick={() => setShowRouteView(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${
                showRouteView ? 'bg-cyan-500 text-white' : 'text-gray-600'
              }`}
            >
              <Route className="w-4 h-4" />
              <span className="text-sm font-medium">Ruta</span>
            </button>
          </div>
        </div>
      )}

      {/* Installations List or Route View */}
      <div className="px-4 py-4">
        {!showRouteView ? (
          <>
            <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">
              Instalaciones de hoy
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
              </div>
            ) : installations.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No tienes instalaciones programadas para hoy</p>
              </div>
            ) : (
              <div className="space-y-3">
                {installations.map((installation) => {
                  const status = statusLabels[installation.status] || statusLabels.pendiente;
                  const payment = paymentLabels[installation.payment_status] || paymentLabels.pendiente;

                  return (
                    <div
                      key={installation.id}
                      className="bg-white rounded-xl shadow-sm overflow-hidden"
                    >
                      {/* Main Content - Clickable */}
                      <div
                        onClick={() => navigate(`/tech/installation/${installation.id}`)}
                        className="p-4 cursor-pointer"
                      >
                        {/* Product Image - Clickable to enlarge */}
                        {installation.product_image && (
                          <div 
                            className="mb-3 bg-gray-50 rounded-lg p-2 border-2 border-cyan-200"
                            onClick={(e) => handleImageClick(e, installation)}
                          >
                            <img
                              src={installation.product_image}
                              alt={installation.product_name}
                              className="w-full h-32 object-contain rounded cursor-zoom-in"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <p className="text-xs text-center text-cyan-600 mt-1">Toca para ampliar</p>
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {installation.lead_name}
                            </h3>
                            {/* Product info with model prominently displayed */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="bg-cyan-100 text-cyan-800 text-xs font-bold px-2 py-1 rounded">
                                {installation.product_model}
                              </span>
                              <span className="text-sm text-gray-500 truncate">
                                {installation.product_name}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        </div>

                        {/* Time & Status */}
                        <div className="flex items-center gap-2 mb-3">
                          {installation.scheduled_time && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              {installation.scheduled_time}
                            </div>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded ${status.color}`}>
                            {status.label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${payment.color}`}>
                            {payment.label}
                          </span>
                        </div>

                        {/* Address */}
                        <div className="flex items-start gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">
                            {installation.address}
                            {installation.city && `, ${installation.city}`}
                          </span>
                        </div>

                        {/* Price */}
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <CircleDollarSign className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            ${installation.total_price.toLocaleString()}
                          </span>
                          {installation.amount_paid > 0 && (
                            <span className="text-gray-500">
                              (pagado: ${installation.amount_paid.toLocaleString()})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex border-t border-gray-100">
                        <button
                          onClick={() => callPhone(installation.lead_phone)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 text-cyan-600 hover:bg-cyan-50 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          <span className="text-sm font-medium">Llamar</span>
                        </button>
                        <div className="w-px bg-gray-100" />
                        <button
                          onClick={() => openWhatsApp(installation.lead_phone)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 text-green-600 hover:bg-green-50 transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          <span className="text-sm font-medium">WhatsApp</span>
                        </button>
                        <div className="w-px bg-gray-100" />
                        <button
                          onClick={() => openMaps(installation.address, installation.city)}
                          className="flex-1 flex items-center justify-center gap-2 py-3 text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Navigation className="w-4 h-4" />
                          <span className="text-sm font-medium">Navegar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Route View */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase">
                Ruta Optimizada
              </h2>
              <span className="text-xs text-gray-400">
                Agrupado por zona
              </span>
            </div>

            {/* Interactive Map */}
            {pendingCount > 0 && (
              <div className="mb-4">
                <RouteMap locations={mapLocations} height="250px" />
              </div>
            )}

            {/* Open Full Route Button */}
            {pendingCount > 0 && (
              <button
                onClick={openFullRoute}
                className="w-full mb-4 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-xl font-medium shadow-sm"
              >
                <Map className="w-5 h-5" />
                Iniciar Navegación en Google Maps
              </button>
            )}

            {/* Grouped Installations */}
            {Object.entries(groupedByCity).map(([city, cityInstallations]) => (
              <div key={city} className="mb-4">
                {/* City Header */}
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-cyan-500" />
                  <h3 className="font-semibold text-gray-700">{city}</h3>
                  <span className="text-xs text-gray-400">
                    ({cityInstallations.length} instalacion{cityInstallations.length !== 1 ? 'es' : ''})
                  </span>
                </div>

                {/* Installations in this city */}
                <div className="space-y-2 pl-2 border-l-2 border-cyan-200">
                  {cityInstallations.map((installation) => {
                    const globalIndex = optimizedInstallations.indexOf(installation) + 1;
                    const status = statusLabels[installation.status] || statusLabels.pendiente;

                    return (
                      <div
                        key={installation.id}
                        onClick={() => navigate(`/tech/installation/${installation.id}`)}
                        className="bg-white rounded-lg shadow-sm p-3 cursor-pointer hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start gap-3">
                          {/* Product Image or Order Number */}
                          {installation.product_image ? (
                            <div 
                              className="relative"
                              onClick={(e) => handleImageClick(e, installation)}
                            >
                              <img
                                src={installation.product_image}
                                alt={installation.product_model}
                                className="w-16 h-16 object-contain rounded border border-gray-200 cursor-zoom-in"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-8 h-8 bg-cyan-500 text-white rounded-full flex items-center justify-center font-bold text-sm">${globalIndex}</div>`;
                                }}
                              />
                              <div className="absolute -top-1 -right-1 w-5 h-5 bg-cyan-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                {globalIndex}
                              </div>
                            </div>
                          ) : (
                            <div className="w-8 h-8 bg-cyan-500 text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {globalIndex}
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-gray-900 truncate">
                                {installation.lead_name}
                              </h4>
                              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            </div>

                            <p className="text-xs text-cyan-700 font-semibold">
                              {installation.product_model}
                            </p>

                            <p className="text-sm text-gray-500 truncate">
                              {installation.address}
                            </p>

                            <div className="flex items-center gap-2 mt-1">
                              {installation.scheduled_time && (
                                <span className="text-xs text-gray-500">
                                  {installation.scheduled_time}
                                </span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded ${status.color}`}>
                                {status.label}
                              </span>
                              <span className="text-xs font-medium text-gray-700">
                                ${installation.total_price.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {pendingCount === 0 && (
              <div className="bg-white rounded-xl p-8 text-center">
                <Route className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No hay instalaciones pendientes para optimizar</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Enlarged Image Modal */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative w-full max-w-lg">
            <button
              onClick={() => setEnlargedImage(null)}
              className="absolute -top-12 right-0 text-white p-2"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="bg-white rounded-xl overflow-hidden">
              <img 
                src={enlargedImage.url} 
                alt={enlargedImage.name}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
              <div className="p-4 bg-cyan-50">
                <span className="bg-cyan-600 text-white text-lg font-bold px-3 py-1 rounded">
                  {enlargedImage.model}
                </span>
                <p className="mt-2 font-medium text-gray-900">{enlargedImage.name}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
