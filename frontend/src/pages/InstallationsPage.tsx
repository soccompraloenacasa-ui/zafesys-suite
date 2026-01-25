import { useState, useEffect } from 'react';
import { Clock, User, ChevronLeft, ChevronRight, Plus, MapPin, Phone, Package, Calendar, MessageSquare, X, UserPlus, Percent, DollarSign, Edit3 } from 'lucide-react';
import { installationsApi, leadsApi, productsApi, techniciansApi } from '../services/api';
import type { Installation, Lead, Product, Technician, LeadStatus, LeadSource } from '../types';
import Modal from '../components/common/Modal';
import { CITIES } from '../constants/cities';

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

// Opciones de precio de instalación
const INSTALLATION_PRICES = [
  { value: '189000', label: '$189,000 - Instalación estándar' },
  { value: '250000', label: '$250,000 - Instalación + desplazamiento' },
];

type DiscountType = 'none' | 'percentage' | 'value';

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
  installation_price: string;
  discount_type: DiscountType;
  discount_value: string;
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
  city: '',
  address_notes: '',
  installation_price: '189000',
  discount_type: 'none',
  discount_value: '',
  total_price: '',
  customer_notes: '',
};

// Quick lead form
interface QuickLeadFormData {
  name: string;
  phone: string;
  city: string;
  address: string;
}

const initialQuickLeadData: QuickLeadFormData = {
  name: '',
  phone: '',
  city: '',
  address: '',
};

// Extended installation with lead and product details
interface InstallationDetail extends Installation {
  lead?: Lead;
  product?: Product;
  technician?: Technician;
}

export default function InstallationsPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<InstallationFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Edit mode state
  const [editingInstallation, setEditingInstallation] = useState<Installation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Quick lead modal state
  const [isQuickLeadModalOpen, setIsQuickLeadModalOpen] = useState(false);
  const [quickLeadData, setQuickLeadData] = useState<QuickLeadFormData>(initialQuickLeadData);
  const [savingLead, setSavingLead] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);

  // Detail modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState<InstallationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  // Calculate total price with discount
  const calculateTotalPrice = (
    productId: string,
    quantity: string,
    installationPrice: string,
    discountType: DiscountType,
    discountValue: string,
    productsList: Product[]
  ): { subtotal: number; discount: number; total: number } => {
    if (!productId || !quantity || !installationPrice) {
      return { subtotal: 0, discount: 0, total: 0 };
    }
    
    const selectedProduct = productsList.find((p) => p.id === parseInt(productId));
    if (!selectedProduct) {
      return { subtotal: 0, discount: 0, total: 0 };
    }
    
    const productTotal = selectedProduct.price * parseInt(quantity);
    const installTotal = parseInt(installationPrice);
    const subtotal = productTotal + installTotal;
    
    let discount = 0;
    if (discountType === 'percentage' && discountValue) {
      const percentage = parseFloat(discountValue) || 0;
      discount = Math.round(subtotal * (percentage / 100));
    } else if (discountType === 'value' && discountValue) {
      discount = parseInt(discountValue) || 0;
    }
    
    const total = Math.max(0, subtotal - discount);
    
    return { subtotal, discount, total };
  };

  // Detail modal handlers
  const handleOpenDetail = async (installation: Installation) => {
    setSelectedInstallation(installation as InstallationDetail);
    setIsDetailModalOpen(true);
    setLoadingDetail(true);

    try {
      // Fetch additional details
      const [leadsData, productsData, techniciansData] = await Promise.all([
        leadsApi.getAll(),
        productsApi.getAll(),
        techniciansApi.getAll(),
      ]);

      const lead = leadsData.find((l: Lead) => l.id === installation.lead_id);
      const product = productsData.find((p: Product) => p.id === installation.product_id);
      const technician = techniciansData.find((t: Technician) => t.id === installation.technician_id);

      setSelectedInstallation({
        ...installation,
        lead,
        product,
        technician,
      });
    } catch (err) {
      console.error('Error loading installation details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedInstallation(null);
  };

  const openMaps = (address: string, city?: string) => {
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

  // Modal handlers for CREATE
  const handleOpenModal = async () => {
    setFormData(initialFormData);
    setError(null);
    setIsEditMode(false);
    setEditingInstallation(null);
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

  // Modal handlers for EDIT
  const handleOpenEditModal = async (installation: InstallationDetail) => {
    setError(null);
    setIsEditMode(true);
    setEditingInstallation(installation);
    setIsDetailModalOpen(false);
    setIsModalOpen(true);
    setLoadingOptions(true);

    try {
      const [leadsData, productsData, techniciansData] = await Promise.all([
        leadsApi.getAll(),
        productsApi.getAll(),
        techniciansApi.getAll(), // Get all technicians for editing, not just available
      ]);
      setLeads(leadsData);
      setProducts(productsData);
      setTechnicians(techniciansData);

      // Calculate initial price based on existing data
      const defaultInstallPrice = '189000';
      const priceData = calculateTotalPrice(
        installation.product_id?.toString() || '',
        installation.quantity?.toString() || '1',
        defaultInstallPrice,
        'none',
        '',
        productsData
      );

      // Pre-fill form with existing data
      setFormData({
        lead_id: installation.lead_id?.toString() || '',
        product_id: installation.product_id?.toString() || '',
        technician_id: installation.technician_id?.toString() || '',
        quantity: installation.quantity?.toString() || '1',
        scheduled_date: installation.scheduled_date || '',
        scheduled_time: installation.scheduled_time || '',
        address: installation.address || '',
        city: installation.city || '',
        address_notes: installation.address_notes || '',
        installation_price: defaultInstallPrice,
        discount_type: 'none',
        discount_value: '',
        total_price: priceData.total > 0 ? priceData.total.toString() : (installation.total_price?.toString() || ''),
        customer_notes: installation.customer_notes || '',
      });
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
    setIsEditMode(false);
    setEditingInstallation(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    // Auto-fill address when lead is selected
    if (name === 'lead_id' && value) {
      const selectedLead = leads.find((l) => l.id === parseInt(value));
      if (selectedLead?.address) {
        setFormData((prev) => ({
          ...prev,
          lead_id: value,
          address: selectedLead.address || '',
          city: selectedLead.city || '',
        }));
        return;
      }
    }

    // Reset discount value when changing type
    if (name === 'discount_type') {
      const newDiscountType = value as DiscountType;
      const priceData = calculateTotalPrice(
        formData.product_id, 
        formData.quantity, 
        formData.installation_price,
        newDiscountType,
        '', // Reset discount value
        products
      );

      setFormData((prev) => ({
        ...prev,
        discount_type: newDiscountType,
        discount_value: '',
        total_price: priceData.total.toString(),
      }));
      return;
    }

    // Auto-calculate price when product, quantity, installation price, or discount changes
    if (name === 'product_id' || name === 'quantity' || name === 'installation_price' || name === 'discount_value') {
      const newProductId = name === 'product_id' ? value : formData.product_id;
      const newQuantity = name === 'quantity' ? value : formData.quantity;
      const newInstallPrice = name === 'installation_price' ? value : formData.installation_price;
      const newDiscountValue = name === 'discount_value' ? value : formData.discount_value;

      const priceData = calculateTotalPrice(
        newProductId, 
        newQuantity, 
        newInstallPrice, 
        formData.discount_type,
        newDiscountValue,
        products
      );

      setFormData((prev) => ({
        ...prev,
        [name]: value,
        total_price: priceData.total.toString(),
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
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
        city: formData.city || undefined,
        address_notes: formData.address_notes || undefined,
        total_price: parseFloat(formData.total_price) || 0,
        customer_notes: formData.customer_notes || undefined,
      };

      if (isEditMode && editingInstallation) {
        // UPDATE existing installation
        await installationsApi.update(editingInstallation.id, installationData);
        
        // Navigate to the new date if it changed
        if (formData.scheduled_date) {
          const newDate = new Date(formData.scheduled_date);
          setCurrentDate(newDate);
        }
      } else {
        // CREATE new installation
        await installationsApi.create(installationData);
      }
      
      handleCloseModal();
      fetchInstallations();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || `Error al ${isEditMode ? 'actualizar' : 'crear'} la instalacion`);
    } finally {
      setSaving(false);
    }
  };

  // Quick Lead handlers
  const handleOpenQuickLead = () => {
    setQuickLeadData(initialQuickLeadData);
    setLeadError(null);
    setIsQuickLeadModalOpen(true);
  };

  const handleCloseQuickLead = () => {
    setIsQuickLeadModalOpen(false);
    setQuickLeadData(initialQuickLeadData);
    setLeadError(null);
  };

  const handleQuickLeadChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setQuickLeadData((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError(null);
    setSavingLead(true);

    try {
      const leadStatus: LeadStatus = 'nuevo';
      const leadSource: LeadSource = 'otro';
      
      const leadData = {
        name: quickLeadData.name,
        phone: quickLeadData.phone,
        city: quickLeadData.city || undefined,
        address: quickLeadData.address || undefined,
        source: leadSource,
        status: leadStatus,
      };

      const newLead = await leadsApi.create(leadData);
      
      // Add to leads list and select it
      setLeads((prev) => [...prev, newLead]);
      setFormData((prev) => ({
        ...prev,
        lead_id: newLead.id.toString(),
        address: newLead.address || prev.address,
        city: newLead.city || prev.city,
      }));
      
      handleCloseQuickLead();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setLeadError(error.response?.data?.detail || 'Error al crear el cliente');
    } finally {
      setSavingLead(false);
    }
  };

  // Get selected product for price display
  const selectedProduct = formData.product_id 
    ? products.find((p) => p.id === parseInt(formData.product_id)) 
    : null;

  // Calculate price breakdown for display
  const priceBreakdown = selectedProduct 
    ? calculateTotalPrice(
        formData.product_id,
        formData.quantity,
        formData.installation_price,
        formData.discount_type,
        formData.discount_value,
        products
      )
    : null;

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
                          onClick={() => handleOpenDetail(inst)}
                          className="p-2 bg-gray-50 rounded-lg hover:bg-cyan-50 cursor-pointer transition-colors border border-transparent hover:border-cyan-200"
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

      {/* Installation Detail Modal */}
      {isDetailModalOpen && selectedInstallation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-cyan-500 text-white px-6 py-4 rounded-t-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Instalación #{selectedInstallation.id}</h2>
                <span className={`text-xs px-2 py-0.5 rounded ${statusLabels[selectedInstallation.status]?.color || 'bg-gray-100'}`}>
                  {statusLabels[selectedInstallation.status]?.label || selectedInstallation.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Edit Button */}
                <button
                  onClick={() => handleOpenEditModal(selectedInstallation)}
                  className="p-2 hover:bg-cyan-600 rounded-lg transition-colors"
                  title="Editar instalación"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCloseDetail}
                  className="p-2 hover:bg-cyan-600 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {/* Cliente */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Cliente</h3>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedInstallation.lead?.name || 'Sin nombre'}
                  </p>
                  {selectedInstallation.lead?.phone && (
                    <div className="flex items-center gap-2 mt-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a href={`tel:${selectedInstallation.lead.phone}`} className="text-cyan-600">
                        {selectedInstallation.lead.phone}
                      </a>
                    </div>
                  )}
                  
                  {/* Contact buttons */}
                  {selectedInstallation.lead?.phone && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => callPhone(selectedInstallation.lead!.phone)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium"
                      >
                        <Phone className="w-4 h-4" />
                        Llamar
                      </button>
                      <button
                        onClick={() => openWhatsApp(selectedInstallation.lead!.phone)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-lg text-sm font-medium"
                      >
                        <MessageSquare className="w-4 h-4" />
                        WhatsApp
                      </button>
                    </div>
                  )}
                </div>

                {/* Fecha y Hora */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Programación</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">
                      {selectedInstallation.scheduled_date 
                        ? new Date(selectedInstallation.scheduled_date).toLocaleDateString('es-CO', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        : 'Sin fecha'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900">
                      {selectedInstallation.scheduled_time || 'Sin hora'}
                    </span>
                  </div>
                </div>

                {/* Dirección */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Dirección</h3>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-900">{selectedInstallation.address}</p>
                      {selectedInstallation.city && (
                        <p className="text-gray-500 text-sm">{selectedInstallation.city}</p>
                      )}
                      {selectedInstallation.address_notes && (
                        <p className="text-cyan-600 text-sm mt-1">{selectedInstallation.address_notes}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => openMaps(selectedInstallation.address, selectedInstallation.city || undefined)}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
                  >
                    <MapPin className="w-4 h-4" />
                    Ver en Google Maps
                  </button>
                </div>

                {/* Producto */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Producto</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-cyan-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedInstallation.product?.name || `Producto #${selectedInstallation.product_id}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {selectedInstallation.product?.model || ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Técnico */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Técnico Asignado</h3>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <User className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {selectedInstallation.technician?.full_name || 'Sin asignar'}
                      </p>
                      {selectedInstallation.technician?.phone && (
                        <p className="text-sm text-gray-500">
                          {selectedInstallation.technician.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pago */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Pago</h3>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500">Total</span>
                    <span className="text-xl font-bold text-gray-900">
                      ${selectedInstallation.total_price?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-500">Pagado</span>
                    <span className="text-green-600 font-medium">
                      ${selectedInstallation.amount_paid?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-gray-700 font-medium">Por cobrar</span>
                    <span className="text-cyan-600 font-bold">
                      ${((selectedInstallation.total_price || 0) - (selectedInstallation.amount_paid || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className={`text-xs px-2 py-1 rounded ${paymentLabels[selectedInstallation.payment_status]?.color || 'bg-gray-100'}`}>
                      {paymentLabels[selectedInstallation.payment_status]?.label || selectedInstallation.payment_status}
                    </span>
                  </div>
                </div>

                {/* Notas */}
                {selectedInstallation.customer_notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-yellow-800 mb-1">Notas del cliente</h3>
                    <p className="text-yellow-700">{selectedInstallation.customer_notes}</p>
                  </div>
                )}

                {/* Edit Button at bottom */}
                <button
                  onClick={() => handleOpenEditModal(selectedInstallation)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors"
                >
                  <Edit3 className="w-5 h-5" />
                  Editar Instalación
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Lead Modal */}
      {isQuickLeadModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Agregar Cliente Rápido</h3>
                <p className="text-sm text-gray-500">Solo datos básicos</p>
              </div>
              <button
                onClick={handleCloseQuickLead}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleQuickLeadSubmit} className="p-6 space-y-4">
              {leadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {leadError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  name="name"
                  value={quickLeadData.name}
                  onChange={handleQuickLeadChange}
                  placeholder="Nombre del cliente"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={quickLeadData.phone}
                  onChange={handleQuickLeadChange}
                  placeholder="3001234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ciudad
                </label>
                <select
                  name="city"
                  value={quickLeadData.city}
                  onChange={handleQuickLeadChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {CITIES.map((city) => (
                    <option key={city.value} value={city.label}>
                      {city.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección
                </label>
                <input
                  type="text"
                  name="address"
                  value={quickLeadData.address}
                  onChange={handleQuickLeadChange}
                  placeholder="Dirección de instalación"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseQuickLead}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingLead || !quickLeadData.name || !quickLeadData.phone}
                  className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingLead ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Installation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={isEditMode ? 'Editar Instalación' : 'Nueva Instalacion'}
        subtitle={isEditMode ? 'Modifica los datos de la instalación' : 'Programa una instalacion de cerradura'}
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
              {saving ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Crear Instalacion'}
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

            {/* Lead Selection with Add Button */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente (Lead) *
              </label>
              <div className="flex gap-2">
                <select
                  name="lead_id"
                  value={formData.lead_id}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none disabled:bg-gray-100"
                  required
                  disabled={isEditMode} // Cannot change lead in edit mode
                >
                  <option value="">Seleccionar cliente...</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.name} - {lead.phone}
                    </option>
                  ))}
                </select>
                {!isEditMode && (
                  <button
                    type="button"
                    onClick={handleOpenQuickLead}
                    className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                    title="Agregar cliente nuevo"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                )}
              </div>
              {isEditMode && (
                <p className="text-xs text-gray-500 mt-1">El cliente no se puede cambiar</p>
              )}
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
                <select
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                >
                  <option value="">Seleccionar...</option>
                  {CITIES.map((city) => (
                    <option key={city.value} value={city.label}>
                      {city.label}
                    </option>
                  ))}
                </select>
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

            {/* Installation Price Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio de Instalación *
              </label>
              <select
                name="installation_price"
                value={formData.installation_price}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              >
                {INSTALLATION_PRICES.map((price) => (
                  <option key={price.value} value={price.value}>
                    {price.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Discount Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descuento
              </label>
              <div className="flex gap-2">
                <select
                  name="discount_type"
                  value={formData.discount_type}
                  onChange={handleInputChange}
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                >
                  <option value="none">Sin descuento</option>
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="value">Valor fijo ($)</option>
                </select>
                
                {formData.discount_type !== 'none' && (
                  <div className="flex-1 relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      {formData.discount_type === 'percentage' ? (
                        <Percent className="w-4 h-4 text-gray-400" />
                      ) : (
                        <DollarSign className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                    <input
                      type="number"
                      name="discount_value"
                      value={formData.discount_value}
                      onChange={handleInputChange}
                      placeholder={formData.discount_type === 'percentage' ? 'Ej: 10' : 'Ej: 50000'}
                      min="0"
                      max={formData.discount_type === 'percentage' ? '100' : undefined}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Price Breakdown */}
            {selectedProduct && priceBreakdown && priceBreakdown.subtotal > 0 && (
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-cyan-800 mb-3">Resumen de Precio</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {selectedProduct.name} x {formData.quantity}
                    </span>
                    <span className="font-medium">
                      ${(selectedProduct.price * parseInt(formData.quantity || '1')).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Instalación</span>
                    <span className="font-medium">
                      ${parseInt(formData.installation_price).toLocaleString()}
                    </span>
                  </div>
                  
                  {/* Subtotal before discount */}
                  {priceBreakdown.discount > 0 && (
                    <>
                      <div className="flex justify-between pt-2 border-t border-cyan-200">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="font-medium">
                          ${priceBreakdown.subtotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-red-600">
                        <span>
                          Descuento 
                          {formData.discount_type === 'percentage' && ` (${formData.discount_value}%)`}
                        </span>
                        <span className="font-medium">
                          -${priceBreakdown.discount.toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between pt-3 border-t border-cyan-200">
                    <span className="font-bold text-cyan-900 text-base">TOTAL A COBRAR</span>
                    <span className="font-bold text-cyan-700 text-xl">
                      ${priceBreakdown.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

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
