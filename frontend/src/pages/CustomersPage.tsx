import { useState, useEffect } from 'react';
import { Plus, Users, Search, Phone, Mail, MapPin, Package, Calendar, Wrench, CheckCircle, LayoutGrid, List, Pencil, Trash2, X, ZoomIn } from 'lucide-react';
import { installationsApi, leadsApi, productsApi, techniciansApi } from '../services/api';
import type { Installation, Lead, Product, Technician } from '../types';
import Modal from '../components/common/Modal';
import { CITIES } from '../constants/cities';
import { getColombiaDate } from '../utils/timezone';

// Opciones de precio de instalación
const INSTALLATION_PRICES = [
  { value: '189000', label: '$189,000 - Instalación estándar' },
  { value: '250000', label: '$250,000 - Instalación + desplazamiento' },
];

// Installation status labels with colors
const installationStatusLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  pendiente: { label: 'Pendiente', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  programada: { label: 'Programada', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  en_camino: { label: 'En camino', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  en_progreso: { label: 'En progreso', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  completada: { label: 'Completada', color: 'text-green-700', bgColor: 'bg-green-100' },
  cancelada: { label: 'Cancelada', color: 'text-red-700', bgColor: 'bg-red-100' },
};

// Customer type derived from lead with installation
interface CustomerWithInstallation {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
  product_interest?: string;
  created_at: string;
  installation: Installation;
  installationStatus: string;
  isManual?: boolean;
}

// Form data for manual customer creation
interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  notes: string;
  // Installation fields
  product_id: string;
  technician_id: string;
  scheduled_date: string;
  scheduled_time: string;
  price_adjustment: string; // Can be positive (aumento) or negative (descuento) for product
  // Installation service fields
  installation_price: string; // Base installation price (189000 or 250000)
  installation_adjustment: string; // Adjustment for installation (positive or negative)
}

const initialFormData: CustomerFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  notes: '',
  product_id: '',
  technician_id: '',
  scheduled_date: '',
  scheduled_time: '',
  price_adjustment: '0',
  installation_price: '189000', // Default: instalación estándar
  installation_adjustment: '0',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modal state for manual customer creation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  // Products and technicians for installation creation
  const [products, setProducts] = useState<Product[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);

  // Edit mode
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithInstallation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Delete confirmation
  const [deletingCustomer, setDeletingCustomer] = useState<CustomerWithInstallation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Image lightbox
  const [enlargedImage, setEnlargedImage] = useState<{ url: string; name: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Get all installations and leads
      const [installationsData, leadsData] = await Promise.all([
        installationsApi.getAll(),
        leadsApi.getAll(),
      ]);

      // Create map of leads by ID for quick lookup
      const leadsMap = new Map<number, Lead>();
      leadsData.forEach((lead: Lead) => leadsMap.set(lead.id, lead));

      // Build customers from leads that have installations
      const customersFromInstallations: CustomerWithInstallation[] = [];
      const processedLeadIds = new Set<number>();

      installationsData.forEach((inst: Installation) => {
        const lead = leadsMap.get(inst.lead_id);
        if (lead && !processedLeadIds.has(lead.id)) {
          processedLeadIds.add(lead.id);

          // Find the most recent installation for this lead
          const leadInstallations = installationsData.filter((i: Installation) => i.lead_id === lead.id);
          const latestInstallation = leadInstallations.sort(
            (a: Installation, b: Installation) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0];

          customersFromInstallations.push({
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            address: lead.address,
            city: lead.city,
            notes: lead.notes,
            product_interest: lead.product_interest,
            created_at: lead.created_at,
            installation: latestInstallation,
            installationStatus: latestInstallation.status,
          });
        }
      });

      setCustomers(customersFromInstallations);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Filter customers by search and status
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      filterStatus === 'all' ||
      c.installationStatus === filterStatus ||
      (filterStatus === 'en_progreso' && (c.installationStatus === 'en_progreso' || c.installationStatus === 'en_camino'));

    return matchesSearch && matchesStatus;
  });

  // Stats by installation status
  const stats = {
    total: customers.length,
    pendiente: customers.filter((c) => c.installationStatus === 'pendiente').length,
    programada: customers.filter((c) => c.installationStatus === 'programada').length,
    en_progreso: customers.filter((c) => c.installationStatus === 'en_progreso' || c.installationStatus === 'en_camino').length,
    completada: customers.filter((c) => c.installationStatus === 'completada').length,
  };

  const callPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/57${cleanPhone}`, '_blank');
  };

  const openMaps = (address: string, city?: string) => {
    const fullAddress = city ? `${address}, ${city}` : address;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`, '_blank');
  };

  // Modal handlers
  const handleOpenModal = async () => {
    setFormData({
      ...initialFormData,
      scheduled_date: getColombiaDate().toISOString().split('T')[0], // Today in Colombia
    });
    setIsModalOpen(true);

    // Fetch products and technicians
    try {
      const [productsData, techniciansData] = await Promise.all([
        productsApi.getAll(),
        techniciansApi.getAvailable(),
      ]);
      setProducts(productsData);
      setTechnicians(techniciansData);
    } catch (error) {
      console.error('Error fetching data for modal:', error);
    }
  };

  // Calculate final price (using integers to avoid floating point issues)
  const selectedProduct = products.find(p => p.id === parseInt(formData.product_id));
  const basePrice = Math.round(Number(selectedProduct?.installation_price) || 0);
  const productAdjustment = parseInt(formData.price_adjustment.replace(/[^0-9-]/g, '')) || 0;
  const productFinalPrice = basePrice + productAdjustment;

  // Installation service price calculation
  const installationBasePrice = parseInt(formData.installation_price) || 189000;
  const installationAdjustment = parseInt(formData.installation_adjustment.replace(/[^0-9-]/g, '')) || 0;
  const installationFinalPrice = installationBasePrice + installationAdjustment;

  // Total price = product price + installation service price
  const finalPrice = productFinalPrice + installationFinalPrice;

  // Image lightbox handlers
  const handleOpenImage = (url: string, name: string) => {
    setEnlargedImage({ url, name });
  };

  const handleCloseImage = () => {
    setEnlargedImage(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormData);
    setEditingCustomer(null);
    setIsEditMode(false);
  };

  // Open edit modal
  const handleEditCustomer = async (customer: CustomerWithInstallation) => {
    setEditingCustomer(customer);
    setIsEditMode(true);

    // Fetch products and technicians
    try {
      const [productsData, techniciansData] = await Promise.all([
        productsApi.getAll(),
        techniciansApi.getAvailable(),
      ]);
      setProducts(productsData);
      setTechnicians(techniciansData);

      // Calculate adjustment from stored price vs product price
      // Assume stored total_price includes both product and installation
      const product = productsData.find((p: Product) => p.id === customer.installation.product_id);
      const storedTotalPrice = Number(customer.installation.total_price) || 0;
      const productBasePrice = Number(product?.installation_price) || 0;

      // Try to detect installation type based on price pattern
      // If total is close to productBase + 189000, it's standard installation
      // If total is close to productBase + 250000, it's with displacement
      const standardTotal = productBasePrice + 189000;
      const displacementTotal = productBasePrice + 250000;

      let detectedInstallationPrice = '189000';
      let calculatedProductAdjustment = 0;
      let calculatedInstallationAdjustment = 0;

      // Simple heuristic: if stored price is closer to displacement total, use that
      if (Math.abs(storedTotalPrice - displacementTotal) < Math.abs(storedTotalPrice - standardTotal)) {
        detectedInstallationPrice = '250000';
        // Any remaining difference is adjustments (split to product adjustment for simplicity)
        calculatedProductAdjustment = storedTotalPrice - (productBasePrice + 250000);
      } else {
        detectedInstallationPrice = '189000';
        calculatedProductAdjustment = storedTotalPrice - (productBasePrice + 189000);
      }

      setFormData({
        name: customer.name,
        phone: customer.phone,
        email: customer.email || '',
        address: customer.address || '',
        city: customer.city || '',
        notes: customer.notes || '',
        product_id: customer.installation.product_id?.toString() || '',
        technician_id: customer.installation.technician_id?.toString() || '',
        scheduled_date: customer.installation.scheduled_date || '',
        scheduled_time: customer.installation.scheduled_time || '',
        price_adjustment: calculatedProductAdjustment.toString(),
        installation_price: detectedInstallationPrice,
        installation_adjustment: calculatedInstallationAdjustment.toString(),
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching data for edit:', error);
    }
  };

  // Delete customer (lead + installation)
  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    setDeleting(true);

    try {
      // Delete installation first
      await installationsApi.delete(deletingCustomer.installation.id);
      // Then delete lead
      await leadsApi.delete(deletingCustomer.id);

      setDeletingCustomer(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting customer:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEditMode && editingCustomer) {
        // UPDATE MODE
        // 1. Update lead
        await leadsApi.update(editingCustomer.id, {
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
          notes: formData.notes || undefined,
          product_interest: selectedProduct?.name || undefined,
        });

        // 2. Update installation
        await installationsApi.update(editingCustomer.installation.id, {
          product_id: parseInt(formData.product_id),
          technician_id: formData.technician_id ? parseInt(formData.technician_id) : undefined,
          scheduled_date: formData.scheduled_date || undefined,
          scheduled_time: formData.scheduled_time || undefined,
          address: formData.address || 'Por confirmar',
          city: formData.city || undefined,
          total_price: finalPrice,
          customer_notes: formData.notes || undefined,
        });
      } else {
        // CREATE MODE
        // 1. Create the lead first
        const lead = await leadsApi.create({
          name: formData.name,
          phone: formData.phone,
          email: formData.email || undefined,
          address: formData.address || undefined,
          city: formData.city || undefined,
          notes: formData.notes || undefined,
          product_interest: selectedProduct?.name || undefined,
          status: 'nuevo',
          source: 'otro',
        });

        // 2. Create the installation if product is selected
        if (formData.product_id && lead.id) {
          await installationsApi.create({
            lead_id: lead.id,
            product_id: parseInt(formData.product_id),
            technician_id: formData.technician_id ? parseInt(formData.technician_id) : undefined,
            quantity: 1,
            scheduled_date: formData.scheduled_date || undefined,
            scheduled_time: formData.scheduled_time || undefined,
            address: formData.address || 'Por confirmar',
            city: formData.city || undefined,
            total_price: finalPrice,
            customer_notes: formData.notes || undefined,
          });
        }
      }

      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Leads con instalaciones agendadas o completadas</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white shadow-sm text-cyan-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista de tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white shadow-sm text-cyan-600' : 'text-gray-500 hover:text-gray-700'}`}
              title="Vista de tabla"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* New customer button */}
          <button
            onClick={handleOpenModal}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
        />
      </div>

      {/* Stats - Clickable filter buttons */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <button
          onClick={() => setFilterStatus('all')}
          className={`bg-white rounded-xl p-3 border transition-all ${filterStatus === 'all' ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-gray-100 hover:border-gray-200'}`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-50 rounded-lg">
              <Users className="w-5 h-5 text-cyan-500" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('pendiente')}
          className={`bg-white rounded-xl p-3 border transition-all ${filterStatus === 'pendiente' ? 'border-yellow-500 ring-2 ring-yellow-100' : 'border-gray-100 hover:border-gray-200'}`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-yellow-50 rounded-lg">
              <Calendar className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-gray-900">{stats.pendiente}</p>
              <p className="text-xs text-gray-500">Pendientes</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('programada')}
          className={`bg-white rounded-xl p-3 border transition-all ${filterStatus === 'programada' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-200'}`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-gray-900">{stats.programada}</p>
              <p className="text-xs text-gray-500">Programadas</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('en_progreso')}
          className={`bg-white rounded-xl p-3 border transition-all ${filterStatus === 'en_progreso' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-gray-100 hover:border-gray-200'}`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-purple-50 rounded-lg">
              <Wrench className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-gray-900">{stats.en_progreso}</p>
              <p className="text-xs text-gray-500">En Progreso</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterStatus('completada')}
          className={`bg-white rounded-xl p-3 border transition-all ${filterStatus === 'completada' ? 'border-green-500 ring-2 ring-green-100' : 'border-gray-100 hover:border-gray-200'}`}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-gray-900">{stats.completada}</p>
              <p className="text-xs text-gray-500">Completadas</p>
            </div>
          </div>
        </button>
      </div>

      {/* Customers Display */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Users className="w-12 h-12 mb-3 text-gray-300" />
          <p>No hay clientes {filterStatus !== 'all' ? `con estado "${installationStatusLabels[filterStatus]?.label || filterStatus}"` : ''}</p>
          <p className="text-sm text-gray-400 mt-2">
            Crea instalaciones o agrega clientes manualmente
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Teléfono</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ciudad</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Instalación</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((customer) => {
                  const statusInfo = installationStatusLabels[customer.installationStatus];
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusInfo?.bgColor || 'bg-gray-100'}`}>
                            <span className={`text-sm font-semibold ${statusInfo?.color || 'text-gray-600'}`}>
                              {customer.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{customer.name}</p>
                            {customer.email && <p className="text-xs text-gray-500">{customer.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{customer.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{customer.city || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo?.bgColor || 'bg-gray-100'} ${statusInfo?.color || 'text-gray-600'}`}>
                          <Wrench className="w-3 h-3" />
                          {statusInfo?.label || customer.installationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        #{customer.installation.id}
                        {customer.installation.scheduled_date && (
                          <span className="ml-1">
                            - {new Date(customer.installation.scheduled_date).toLocaleDateString('es-CO')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => callPhone(customer.phone)}
                            className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                            title="Llamar"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openWhatsApp(customer.phone)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="WhatsApp"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          {customer.address && (
                            <button
                              onClick={() => openMaps(customer.address!, customer.city)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Ver en mapa"
                            >
                              <MapPin className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEditCustomer(customer)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingCustomer(customer)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => {
            const statusInfo = installationStatusLabels[customer.installationStatus];

            return (
              <div
                key={customer.id}
                className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusInfo?.bgColor || 'bg-gray-100'}`}>
                      <span className={`font-semibold ${statusInfo?.color || 'text-gray-600'}`}>
                        {customer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                      {/* Installation status badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo?.bgColor || 'bg-gray-100'} ${statusInfo?.color || 'text-gray-600'}`}>
                        <Wrench className="w-3 h-3" />
                        {statusInfo?.label || customer.installationStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.address && (
                    <button
                      onClick={() => openMaps(customer.address!, customer.city)}
                      className="flex items-center gap-2 text-gray-600 hover:text-cyan-600 transition-colors"
                    >
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{customer.address}</span>
                    </button>
                  )}
                  {customer.city && !customer.address && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{customer.city}</span>
                    </div>
                  )}
                  {customer.product_interest && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{customer.product_interest}</span>
                    </div>
                  )}
                  {/* Installation info */}
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <Calendar className="w-3 h-3" />
                    <span>
                      Instalación #{customer.installation.id}
                      {customer.installation.scheduled_date && ` - ${new Date(customer.installation.scheduled_date).toLocaleDateString('es-CO')}`}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => callPhone(customer.phone)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-cyan-50 text-cyan-600 rounded-lg text-sm font-medium hover:bg-cyan-100 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Llamar
                  </button>
                  <button
                    onClick={() => openWhatsApp(customer.phone)}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                  >
                    WhatsApp
                  </button>
                  <button
                    onClick={() => handleEditCustomer(customer)}
                    className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingCustomer(customer)}
                    className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for customer creation/edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={isEditMode ? "Editar Cliente" : "Nuevo Cliente"}
        subtitle={isEditMode ? "Modificar datos del cliente" : "Agregar cliente manualmente"}
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
              disabled={saving || !formData.name || !formData.phone || !formData.product_id}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Crear Cliente'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Datos del cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono *
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="3001234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="cliente@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Calle 123 #45-67"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
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

          {/* Separador - Datos de instalación */}
          <div className="border-t border-gray-200 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Producto e Instalación
            </h3>

            {/* Product selection with thumbnail */}
            <div className="flex items-start gap-3 mb-4">
              {/* Thumbnail */}
              <div
                className={`w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center border-2 border-dashed border-gray-300 relative group ${selectedProduct?.image_url ? 'cursor-pointer hover:ring-2 hover:ring-cyan-400 border-solid border-cyan-200' : ''}`}
                onClick={() => {
                  if (selectedProduct?.image_url) {
                    handleOpenImage(selectedProduct.image_url, selectedProduct.name);
                  }
                }}
              >
                {selectedProduct?.image_url ? (
                  <>
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (
                  <Package className="w-6 h-6 text-gray-400" />
                )}
              </div>

              {/* Product and Technician selects */}
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Producto *
                  </label>
                  <select
                    name="product_id"
                    value={formData.product_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} - ${product.installation_price?.toLocaleString('es-CO')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Técnico
                  </label>
                  <select
                    name="technician_id"
                    value={formData.technician_id}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm"
                  >
                    <option value="">Sin asignar</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha
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

            {/* Precio del producto y ajuste */}
            <div className="bg-gray-50 rounded-lg p-3 mt-3">
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Precio del Producto</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Base
                  </label>
                  <div className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm">
                    ${basePrice.toLocaleString('es-CO')}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Ajuste (+/-)
                  </label>
                  <input
                    type="number"
                    name="price_adjustment"
                    value={formData.price_adjustment}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Subtotal
                  </label>
                  <div className={`px-2 py-1.5 border rounded-lg font-medium text-sm ${productAdjustment < 0 ? 'bg-green-50 border-green-300 text-green-700' : productAdjustment > 0 ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-300 text-gray-700'}`}>
                    ${productFinalPrice.toLocaleString('es-CO')}
                  </div>
                </div>
              </div>
            </div>

            {/* Precio de instalación y ajuste */}
            <div className="bg-blue-50 rounded-lg p-3 mt-3">
              <p className="text-xs font-semibold text-blue-600 mb-2 uppercase">Servicio de Instalación</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Tipo de instalación
                  </label>
                  <select
                    name="installation_price"
                    value={formData.installation_price}
                    onChange={handleInputChange}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm bg-white"
                  >
                    {INSTALLATION_PRICES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Ajuste (+/-)
                  </label>
                  <input
                    type="number"
                    name="installation_adjustment"
                    value={formData.installation_adjustment}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Subtotal
                  </label>
                  <div className={`px-2 py-1.5 border rounded-lg font-medium text-sm ${installationAdjustment < 0 ? 'bg-green-50 border-green-300 text-green-700' : installationAdjustment > 0 ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-gray-300 text-gray-700'}`}>
                    ${installationFinalPrice.toLocaleString('es-CO')}
                  </div>
                </div>
              </div>
            </div>

            {/* Total final */}
            <div className="bg-cyan-50 rounded-lg p-3 mt-3 border-2 border-cyan-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-cyan-700">TOTAL A COBRAR</span>
                <span className="text-xl font-bold text-cyan-700">
                  ${finalPrice.toLocaleString('es-CO')}
                </span>
              </div>
              <p className="text-xs text-cyan-600 mt-1">
                Producto: ${productFinalPrice.toLocaleString('es-CO')} + Instalación: ${installationFinalPrice.toLocaleString('es-CO')}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={2}
              placeholder="Notas adicionales..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
            />
          </div>
        </form>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deletingCustomer}
        onClose={() => setDeletingCustomer(null)}
        title="Eliminar Cliente"
        subtitle="Esta acción no se puede deshacer"
        footer={
          <>
            <button
              onClick={() => setDeletingCustomer(null)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteCustomer}
              disabled={deleting}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </>
        }
      >
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-gray-700 mb-2">
            ¿Estás seguro que deseas eliminar a <strong>{deletingCustomer?.name}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            Se eliminará el cliente y su instalación asociada (#{deletingCustomer?.installation.id}).
          </p>
        </div>
      </Modal>

      {/* Image Lightbox Modal */}
      {enlargedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
          onClick={handleCloseImage}
        >
          <div
            className="relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleCloseImage}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Product name */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-lg">
              <p className="text-white font-medium text-lg">{enlargedImage.name}</p>
            </div>

            {/* Image */}
            <img
              src={enlargedImage.url}
              alt={enlargedImage.name}
              className="max-w-full max-h-[85vh] object-contain mx-auto rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
