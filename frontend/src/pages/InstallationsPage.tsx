import { useState, useEffect } from 'react';
import { Clock, User, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { installationsApi, leadsApi, productsApi, techniciansApi } from '../services/api';
import type { Installation, Lead, Product, Technician } from '../types';
import Modal from '../components/common/Modal';

const statusLabels: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-700' },
  en_camino: { label: 'En camino', color: 'bg-indigo-100 text-indigo-700' },
  en_progreso: { label: 'En progreso', color: 'bg-purple-100 text-purple-700' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
};

interface InstallationFormData {
  lead_id: string;
  product_id: string;
  technician_id: string;
  quantity: string;
  scheduled_date: string;
  scheduled_time: string;
  address: string;
  city: string;
  address_notes: string;
  total_price: string;
  customer_notes: string;
}

const initialFormData: InstallationFormData = {
  lead_id: '',
  product_id: '',
  technician_id: '',
  quantity: '1',
  scheduled_date: '',
  scheduled_time: '',
  address: '',
  city: 'Bogota',
  address_notes: '',
  total_price: '',
  customer_notes: '',
};

export default function InstallationsPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<InstallationFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Options for selects
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const fetchInstallations = async () => {
    try {
      const data = await installationsApi.getAll();
      setInstallations(data);
    } catch (error) {
      console.error('Error fetching installations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallations();
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getInstallationsForDay = (day: Date) => {
    return installations.filter((inst) => {
      if (!inst.scheduled_date) return false;
      const instDate = new Date(inst.scheduled_date);
      return (
        instDate.getDate() === day.getDate() &&
        instDate.getMonth() === day.getMonth() &&
        instDate.getFullYear() === day.getFullYear()
      );
    });
  };

  const weekDays = getWeekDays();
  const today = new Date();

  // Modal handlers
  const handleOpenModal = async () => {
    setFormData(initialFormData);
    setError(null);
    setIsModalOpen(true);
    setLoadingOptions(true);

    try {
      const [leadsData, productsData, techniciansData] = await Promise.all([
        leadsApi.getAll(),
        productsApi.getAll(),
        techniciansApi.getAvailable(),
      ]);
      setLeads(leadsData);
      setProducts(productsData);
      setTechnicians(techniciansData);
    } catch (err) {
      console.error('Error loading options:', err);
      setError('Error cargando datos. Intente de nuevo.');
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormData);
    setError(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-fill address when lead is selected
    if (name === 'lead_id' && value) {
      const selectedLead = leads.find((l) => l.id === parseInt(value));
      if (selectedLead?.address) {
        setFormData((prev) => ({
          ...prev,
          lead_id: value,
          address: selectedLead.address || '',
          city: selectedLead.city || 'Bogota',
        }));
      }
    }

    // Auto-calculate price when product/quantity changes
    if (name === 'product_id' || name === 'quantity') {
      const productId = name === 'product_id' ? value : formData.product_id;
      const quantity = name === 'quantity' ? value : formData.quantity;

      if (productId && quantity) {
        const selectedProduct = products.find((p) => p.id === parseInt(productId));
        if (selectedProduct) {
          const totalPrice = (selectedProduct.price + selectedProduct.installation_price) * parseInt(quantity);
          setFormData((prev) => ({
            ...prev,
            [name]: value,
            total_price: totalPrice.toString(),
          }));
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const installationData = {
        lead_id: parseInt(formData.lead_id),
        product_id: parseInt(formData.product_id),
        technician_id: formData.technician_id ? parseInt(formData.technician_id) : undefined,
        quantity: parseInt(formData.quantity) || 1,
        scheduled_date: formData.scheduled_date || undefined,
        scheduled_time: formData.scheduled_time || undefined,
        address: formData.address,
        city: formData.city || 'Bogota',
        address_notes: formData.address_notes || undefined,
        total_price: parseFloat(formData.total_price) || 0,
        customer_notes: formData.customer_notes || undefined,
      };

      await installationsApi.create(installationData);
      handleCloseModal();
      fetchInstallations();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Error al crear la instalacion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instalaciones</h1>
          <p className="text-gray-500">Agenda de instalaciones programadas</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Instalacion
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-lg p-4 border border-gray-100">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-lg font-semibold text-gray-900 capitalize">
          {formatDate(currentDate)}
        </span>
        <button
          onClick={() => navigateWeek(1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const isToday =
              day.getDate() === today.getDate() &&
              day.getMonth() === today.getMonth() &&
              day.getFullYear() === today.getFullYear();
            const dayInstallations = getInstallationsForDay(day);

            return (
              <div
                key={day.toISOString()}
                className={`bg-white rounded-lg border ${
                  isToday ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-gray-100'
                } min-h-[300px]`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 border-b ${isToday ? 'bg-cyan-50' : 'bg-gray-50'}`}
                >
                  <p className="text-xs text-gray-500 uppercase">
                    {day.toLocaleDateString('es-CO', { weekday: 'short' })}
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      isToday ? 'text-cyan-600' : 'text-gray-900'
                    }`}
                  >
                    {day.getDate()}
                  </p>
                </div>

                {/* Installations */}
                <div className="p-2 space-y-2">
                  {dayInstallations.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">
                      Sin instalaciones
                    </p>
                  ) : (
                    dayInstallations.map((inst) => {
                      const status = statusLabels[inst.status] || statusLabels.pendiente;
                      return (
                        <div
                          key={inst.id}
                          className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                            <Clock className="w-3 h-3" />
                            {inst.scheduled_time || 'Sin hora'}
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            Instalacion #{inst.id}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <User className="w-3 h-3" />
                            <span className="truncate">
                              {inst.technician_id ? `Tecnico #${inst.technician_id}` : 'Sin asignar'}
                            </span>
                          </div>
                          <span
                            className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Installation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Nueva Instalacion"
        subtitle="Programa una instalacion de cerradura"
        size="lg"
        footer={
          <>
            <button
              onClick={handleCloseModal}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !formData.lead_id || !formData.product_id || !formData.address || !formData.total_price}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Crear Instalacion'}
            </button>
          </>
        }
      >
        {loadingOptions ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Lead Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente (Lead) *
              </label>
              <select
                name="lead_id"
                value={formData.lead_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              >
                <option value="">Seleccionar cliente...</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name} - {lead.phone}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Producto *
                </label>
                <select
                  name="product_id"
                  value={formData.product_id}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - ${product.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Technician Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tecnico Asignado
              </label>
              <select
                name="technician_id"
                value={formData.technician_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              >
                <option value="">Sin asignar (programar despues)</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.full_name} - {tech.zone || 'Sin zona'}
                  </option>
                ))}
              </select>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha Programada
                </label>
                <input
                  type="date"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hora
                </label>
                <input
                  type="time"
                  name="scheduled_time"
                  value={formData.scheduled_time}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Direccion *
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Ej: Calle 123 #45-67, Apto 101"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="Bogota"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Indicaciones de Acceso
              </label>
              <input
                type="text"
                name="address_notes"
                value={formData.address_notes}
                onChange={handleInputChange}
                placeholder="Ej: Timbre 101, porteria 24h, llamar al llegar"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Total (COP) *
              </label>
              <input
                type="number"
                name="total_price"
                value={formData.total_price}
                onChange={handleInputChange}
                placeholder="Se calcula automaticamente"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Incluye producto + instalacion. Ajustar si aplica descuento.
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas del Cliente
              </label>
              <textarea
                name="customer_notes"
                value={formData.customer_notes}
                onChange={handleInputChange}
                rows={2}
                placeholder="Instrucciones especiales, tipo de puerta, etc..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
