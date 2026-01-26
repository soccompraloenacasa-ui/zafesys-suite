import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Phone,
  Navigation,
  Package,
  CircleDollarSign,
  CheckCircle,
  Truck,
  MessageSquare,
  Loader2,
  CreditCard,
  Banknote,
  Send,
  AlertTriangle,
  X,
  ZoomIn,
  Play,
  Square,
  Timer,
} from 'lucide-react';
import { techApi } from '../../services/api';
import Modal from '../../components/common/Modal';

// Número de WhatsApp del admin para recibir notificaciones
const ADMIN_WHATSAPP = '573011917572';
const API_BASE = import.meta.env.VITE_API_URL || 'https://zafesys-suite-production.up.railway.app';

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
  // Timer fields
  timer_started_at?: string;
  timer_ended_at?: string;
  timer_started_by?: string;
  installation_duration_minutes?: number;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-700' },
  en_camino: { label: 'En camino', color: 'bg-indigo-100 text-indigo-700' },
  en_progreso: { label: 'En progreso', color: 'bg-purple-100 text-purple-700' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
};

export default function TechInstallationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [installation, setInstallation] = useState<TechInstallation | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showEnlargedImage, setShowEnlargedImage] = useState(false);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerStartedAt, setTimerStartedAt] = useState<Date | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');

  // Complete modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [techNotes, setTechNotes] = useState('');

  const techId = parseInt(localStorage.getItem('tech_id') || '0');
  const techName = localStorage.getItem('tech_name') || 'Técnico';

  // Initialize timer from installation data
  useEffect(() => {
    if (installation) {
      if (installation.timer_started_at && !installation.timer_ended_at) {
        setTimerRunning(true);
        setTimerStartedAt(new Date(installation.timer_started_at));
      } else if (installation.timer_ended_at) {
        setTimerRunning(false);
      }
    }
  }, [installation]);

  // Real-time timer update
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    
    if (timerRunning && timerStartedAt) {
      interval = setInterval(() => {
        const now = new Date();
        const diffMs = now.getTime() - timerStartedAt.getTime();
        const totalSeconds = Math.floor(diffMs / 1000);
        setElapsedMinutes(Math.floor(totalSeconds / 60));
        setElapsedSeconds(totalSeconds % 60);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerStartedAt]);

  useEffect(() => {
    if (!techId || !id) {
      navigate('/tech/login');
      return;
    }
    fetchInstallation();
  }, [techId, id, navigate]);

  const fetchInstallation = async () => {
    try {
      const data = await techApi.getInstallation(parseInt(id!), techId);
      setInstallation(data);

      // Pre-fill payment amount with remaining balance
      const remaining = data.total_price - data.amount_paid;
      setPaymentAmount(remaining.toString());
    } catch (error) {
      console.error('Error fetching installation:', error);
      navigate('/tech/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const startTimer = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tech/installations/${id}/timer/start?technician_id=${techId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTimerRunning(data.is_running);
        if (data.timer_started_at) {
          setTimerStartedAt(new Date(data.timer_started_at));
        }
      }
    } catch (error) {
      console.error('Error starting timer:', error);
    }
  }, [id, techId]);

  const stopTimer = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/tech/installations/${id}/timer/stop?technician_id=${techId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTimerRunning(false);
        if (installation) {
          setInstallation({
            ...installation,
            installation_duration_minutes: data.installation_duration_minutes
          });
        }
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
    }
  }, [id, techId, installation]);

  const handleStatusUpdate = async (newStatus: string) => {
    setUpdating(true);
    try {
      await techApi.updateStatus(parseInt(id!), techId, newStatus);
      setInstallation((prev) => prev ? { ...prev, status: newStatus } : null);
      
      // Auto-start timer when starting installation
      if (newStatus === 'en_progreso') {
        await startTimer();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) return;

    setUpdating(true);
    try {
      const result = await techApi.confirmPayment(
        parseInt(id!),
        techId,
        parseFloat(paymentAmount),
        paymentMethod
      );
      setInstallation((prev) =>
        prev
          ? {
              ...prev,
              amount_paid: result.amount_paid,
              payment_status: result.payment_status,
            }
          : null
      );
      setShowPaymentModal(false);
    } catch (error) {
      console.error('Error confirming payment:', error);
    } finally {
      setUpdating(false);
    }
  };

  const sendCompletionWhatsApp = () => {
    if (!installation) return;

    const fullAddress = installation.city
      ? `${installation.address}, ${installation.city}`
      : installation.address;

    const durationText = installation.installation_duration_minutes 
      ? `\n⏱️ *Duración:* ${Math.floor(installation.installation_duration_minutes / 60)}h ${installation.installation_duration_minutes % 60}min`
      : '';

    const message = `✅ *INSTALACIÓN EXITOSA*\n\n👨‍🔧 *Técnico:* ${techName}\n👤 *Cliente:* ${installation.lead_name}\n📱 *Tel Cliente:* ${installation.lead_phone}\n🔐 *Producto:* ${installation.product_name} (${installation.product_model})\n📍 *Dirección:* ${fullAddress}\n💰 *Total:* $${installation.total_price.toLocaleString()}\n💳 *Pagado:* $${installation.amount_paid.toLocaleString()}${durationText}\n${techNotes ? `📝 *Notas:* ${techNotes}` : ''}\n\n🕐 ${new Date().toLocaleString('es-CO')}`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${encodedMessage}`, '_blank');
  };

  const handleComplete = async () => {
    setUpdating(true);
    try {
      // Stop timer first if running
      if (timerRunning) {
        await stopTimer();
      }
      
      await techApi.completeInstallation(parseInt(id!), techId, techNotes || undefined);
      setInstallation((prev) =>
        prev ? { ...prev, status: 'completada' } : null
      );
      setShowCompleteModal(false);
      
      // Send WhatsApp notification to admin
      sendCompletionWhatsApp();
    } catch (error) {
      console.error('Error completing installation:', error);
    } finally {
      setUpdating(false);
    }
  };

  const openMaps = () => {
    if (!installation) return;
    const fullAddress = installation.city
      ? `${installation.address}, ${installation.city}`
      : installation.address;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
    window.open(url, '_blank');
  };

  const callPhone = () => {
    if (!installation) return;
    window.open(`tel:${installation.lead_phone}`, '_self');
  };

  const openWhatsApp = () => {
    if (!installation) return;
    const cleanPhone = installation.lead_phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const formatTime = (minutes: number, seconds: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const secs = seconds;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!installation) {
    return null;
  }

  const status = statusLabels[installation.status] || statusLabels.pendiente;
  const remaining = installation.total_price - installation.amount_paid;
  const isCompleted = installation.status === 'completada';
  const isPaid = installation.payment_status === 'pagado';
  const isInProgress = installation.status === 'en_progreso';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-cyan-500 text-white px-4 pt-6 pb-4 safe-area-top">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/tech/dashboard')}
            className="p-2 hover:bg-cyan-600 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Instalacion #{installation.id}</h1>
            <span className={`text-xs px-2 py-0.5 rounded ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Success Banner for Completed */}
        {isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-semibold text-green-800">¡Instalación Completada!</p>
              <p className="text-sm text-green-600">Buen trabajo 🎉</p>
              {installation.installation_duration_minutes && (
                <p className="text-xs text-green-600 mt-1">
                  Duración: {Math.floor(installation.installation_duration_minutes / 60)}h {installation.installation_duration_minutes % 60}min
                </p>
              )}
            </div>
          </div>
        )}

        {/* Timer Display - Show when in progress */}
        {isInProgress && (
          <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5" />
                <span className="font-medium">Timer de Instalación</span>
              </div>
              {timerRunning && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full animate-pulse">
                  En curso
                </span>
              )}
            </div>
            <div className="text-center my-4">
              <div className="text-4xl font-mono font-bold">
                {formatTime(elapsedMinutes, elapsedSeconds)}
              </div>
            </div>
            <div className="flex gap-2">
              {!timerRunning ? (
                <button
                  onClick={startTimer}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
                >
                  <Play className="w-5 h-5" />
                  Iniciar Timer
                </button>
              ) : (
                <button
                  onClick={stopTimer}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/80 hover:bg-red-500 rounded-lg font-medium transition-colors"
                >
                  <Square className="w-5 h-5" />
                  Detener Timer
                </button>
              )}
            </div>
          </div>
        )}

        {/* ⚠️ PRODUCTO - IMAGEN GRANDE Y PROMINENTE */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-cyan-400">
          {/* Header de advertencia */}
          <div className="bg-cyan-500 text-white px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-bold text-sm uppercase">Verifica el producto antes de salir</span>
          </div>
          
          {/* Imagen del producto - GRANDE y TOCABLE */}
          {installation.product_image ? (
            <div 
              className="bg-gray-100 p-4 cursor-pointer relative"
              onClick={() => setShowEnlargedImage(true)}
            >
              <img
                src={installation.product_image}
                alt={installation.product_name}
                className="w-full h-48 object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="absolute bottom-6 right-6 bg-cyan-500 text-white px-3 py-1.5 rounded-full flex items-center gap-1 text-sm font-medium shadow-lg">
                <ZoomIn className="w-4 h-4" />
                Ampliar
              </div>
            </div>
          ) : (
            <div className="bg-gray-100 p-8 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <Package className="w-16 h-16 mx-auto mb-2" />
                <p className="text-sm">Sin imagen disponible</p>
              </div>
            </div>
          )}
          
          {/* Info del producto */}
          <div className="p-4 bg-cyan-50">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-cyan-600 text-white text-lg font-bold px-3 py-1 rounded">
                {installation.product_model}
              </span>
            </div>
            <p className="font-medium text-gray-900 text-lg">{installation.product_name}</p>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            {installation.lead_name}
          </h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <a
                href={`tel:${installation.lead_phone}`}
                className="text-cyan-600 font-medium"
              >
                {installation.lead_phone}
              </a>
            </div>

            {installation.scheduled_time && (
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <span className="text-gray-700">{installation.scheduled_time}</span>
              </div>
            )}
          </div>

          {/* Quick Contact Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={callPhone}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cyan-500 text-white rounded-lg font-medium"
            >
              <Phone className="w-4 h-4" />
              Llamar
            </button>
            <button
              onClick={openWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-lg font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-gray-900 font-medium">{installation.address}</p>
              {installation.city && (
                <p className="text-gray-500 text-sm">{installation.city}</p>
              )}
              {installation.address_notes && (
                <p className="text-cyan-600 text-sm mt-1">
                  {installation.address_notes}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={openMaps}
            className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-blue-500 text-white rounded-lg font-medium"
          >
            <Navigation className="w-4 h-4" />
            Abrir en Google Maps
          </button>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-500">Total</span>
            <span className="text-xl font-bold text-gray-900">
              ${installation.total_price.toLocaleString()}
            </span>
          </div>

          {installation.amount_paid > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-500">Pagado</span>
              <span className="text-green-600 font-medium">
                ${installation.amount_paid.toLocaleString()}
              </span>
            </div>
          )}

          {remaining > 0 && (
            <div className="flex items-center justify-between mb-3 pt-2 border-t">
              <span className="text-gray-700 font-medium">Por cobrar</span>
              <span className="text-lg font-bold text-cyan-600">
                ${remaining.toLocaleString()}
              </span>
            </div>
          )}

          {!isPaid && !isCompleted && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-lg font-medium"
            >
              <CircleDollarSign className="w-4 h-4" />
              Registrar Pago
            </button>
          )}
        </div>

        {/* Customer Notes */}
        {installation.customer_notes && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-sm font-medium text-yellow-800 mb-1">Notas del cliente:</p>
            <p className="text-yellow-700">{installation.customer_notes}</p>
          </div>
        )}

        {/* Re-send notification button for completed installations */}
        {isCompleted && (
          <button
            onClick={sendCompletionWhatsApp}
            className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-xl font-medium"
          >
            <Send className="w-5 h-5" />
            Reenviar Notificación al Admin
          </button>
        )}
      </div>

      {/* Bottom Action Bar */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-area-bottom">
          <div className="flex gap-2">
            {(installation.status === 'pendiente' || installation.status === 'programada') && (
              <button
                onClick={() => handleStatusUpdate('en_camino')}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Truck className="w-5 h-5" />
                )}
                En Camino
              </button>
            )}

            {installation.status === 'en_camino' && (
              <button
                onClick={() => handleStatusUpdate('en_progreso')}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Iniciar Instalacion
                  </>
                )}
              </button>
            )}

            {installation.status === 'en_progreso' && (
              <button
                onClick={() => setShowCompleteModal(true)}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle className="w-5 h-5" />
                )}
                Completar Instalacion
              </button>
            )}
          </div>
        </div>
      )}

      {/* Enlarged Image Modal */}
      {showEnlargedImage && installation.product_image && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4"
          onClick={() => setShowEnlargedImage(false)}
        >
          <div className="relative w-full max-w-lg">
            <button
              onClick={() => setShowEnlargedImage(false)}
              className="absolute -top-12 right-0 text-white p-2"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="bg-white rounded-xl overflow-hidden">
              <img 
                src={installation.product_image} 
                alt={installation.product_name}
                className="w-full h-auto"
              />
              <div className="p-4 bg-cyan-50">
                <span className="bg-cyan-600 text-white text-xl font-bold px-4 py-2 rounded">
                  {installation.product_model}
                </span>
                <p className="mt-3 font-medium text-gray-900 text-lg">{installation.product_name}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Registrar Pago"
        subtitle="Confirma el pago recibido del cliente"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowPaymentModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handlePaymentConfirm}
              disabled={updating || !paymentAmount}
              className="px-4 py-2 bg-green-500 text-white rounded-lg disabled:opacity-50"
            >
              {updating ? 'Guardando...' : 'Confirmar Pago'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto Recibido (COP)
            </label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metodo de Pago
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'efectivo', label: 'Efectivo', icon: Banknote },
                { value: 'transferencia', label: 'Transferencia', icon: CreditCard },
                { value: 'nequi', label: 'Nequi', icon: CreditCard },
                { value: 'daviplata', label: 'Daviplata', icon: CreditCard },
              ].map((method) => (
                <button
                  key={method.value}
                  onClick={() => setPaymentMethod(method.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border ${
                    paymentMethod === method.value
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <method.icon className="w-4 h-4" />
                  {method.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Complete Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        title="Completar Instalacion"
        subtitle="Se notificará al administrador por WhatsApp"
        size="sm"
        footer={
          <>
            <button
              onClick={() => setShowCompleteModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleComplete}
              disabled={updating}
              className="px-4 py-2 bg-green-500 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              {updating ? (
                'Completando...'
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Completar y Notificar
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {timerRunning && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm text-purple-700 flex items-center gap-2">
                <Timer className="w-4 h-4" />
                El timer se detendrá automáticamente al completar.
                <br />
                Tiempo actual: <strong>{formatTime(elapsedMinutes, elapsedSeconds)}</strong>
              </p>
            </div>
          )}
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-700">
              Al completar, se enviará un mensaje de WhatsApp con el resumen de la instalación al administrador.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas de la Instalacion (opcional)
            </label>
            <textarea
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
              placeholder="Ej: Se instalo sin problemas, puerta de madera..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
