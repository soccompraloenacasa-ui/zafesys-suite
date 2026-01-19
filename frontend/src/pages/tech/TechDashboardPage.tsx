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
} from 'lucide-react';
import { techApi } from '../../services/api';

interface TechInstallation {
  id: number;
  lead_name: string;
  lead_phone: string;
  product_name: string;
  product_model: string;
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

export default function TechDashboardPage() {
  const navigate = useNavigate();
  const [installations, setInstallations] = useState<TechInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [techName, setTechName] = useState('');

  const techId = parseInt(localStorage.getItem('tech_id') || '0');

  useEffect(() => {
    if (!techId) {
      navigate('/tech/login');
      return;
    }

    setTechName(localStorage.getItem('tech_name') || 'Tecnico');
    fetchInstallations();
    fetchProfile();
  }, [techId, navigate]);

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
    } catch (error) {
      console.error('Error updating availability:', error);
    }
  };

  const handleLogout = () => {
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

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const pendingCount = installations.filter(
    (i) => i.status !== 'completada' && i.status !== 'cancelada'
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-cyan-500 text-white px-4 pt-6 pb-8 safe-area-top">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-cyan-100 text-sm">Hola,</p>
            <h1 className="text-xl font-bold">{techName}</h1>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Availability Toggle */}
        <div
          onClick={handleToggleAvailability}
          className="flex items-center justify-between bg-cyan-600/50 rounded-lg p-3 cursor-pointer"
        >
          <span className="font-medium">
            {isAvailable ? 'Disponible' : 'No disponible'}
          </span>
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

      {/* Installations List */}
      <div className="px-4 py-6">
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
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {installation.lead_name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {installation.product_name}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
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
      </div>
    </div>
  );
}
