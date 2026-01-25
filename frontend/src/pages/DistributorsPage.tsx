import { useState, useEffect, useMemo } from 'react';
import { Plus, Building2, Search, Edit2, Trash2, X, Phone, MapPin, ShoppingCart, DollarSign, Package, ChevronRight, Calendar, TrendingUp, Wrench, Percent, Filter, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { distributorsApi, productsApi } from '../services/api';
import type { DistributorWithSales } from '../services/api';
import type { Distributor, DistributorSale, Product } from '../types';
import Modal from '../components/common/Modal';
import { CITIES } from '../constants/cities';

interface DistributorFormData {
  name: string;
  company_name: string;
  nit: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  zone: string;
  contact_person: string;
  discount_percentage: string;
  notes: string;
}

const initialFormData: DistributorFormData = {
  name: '',
  company_name: '',
  nit: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  zone: '',
  contact_person: '',
  discount_percentage: '0',
  notes: '',
};

// Installation prices
const INSTALLATION_OPTIONS = [
  { value: '', label: 'Sin instalación', price: 0 },
  { value: 'standard', label: 'Instalación estándar', price: 189000 },
  { value: 'remote', label: 'Instalación + desplazamiento', price: 250000 },
];

interface SaleFormData {
  product_id: string;
  quantity: string;
  unit_price: string;
  include_installation: string;
  installation_price: string;
  sale_date: string;
  invoice_number: string;
  notes: string;
}

const initialSaleFormData: SaleFormData = {
  product_id: '',
  quantity: '1',
  unit_price: '',
  include_installation: '',
  installation_price: '0',
  sale_date: new Date().toISOString().split('T')[0],
  invoice_number: '',
  notes: '',
};

// Chart colors
const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Distributor modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<DistributorFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingDistributor, setEditingDistributor] = useState<Distributor | null>(null);
  
  // Detail modal - use DistributorWithSales for full detail
  const [selectedDistributor, setSelectedDistributor] = useState<DistributorWithSales | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [distributorSales, setDistributorSales] = useState<DistributorSale[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Date filter for detail view
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Sale modal
  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [saleFormData, setSaleFormData] = useState<SaleFormData>(initialSaleFormData);
  const [savingSale, setSavingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);

  const fetchDistributors = async () => {
    try {
      const data = await distributorsApi.getAll();
      setDistributors(data);
    } catch (error) {
      console.error('Error fetching distributors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const data = await productsApi.getAll();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  useEffect(() => {
    fetchDistributors();
    fetchProducts();
  }, []);

  const filteredDistributors = distributors.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.company_name && d.company_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      d.phone.includes(searchTerm)
  );

  // Filter sales by date
  const filteredSales = useMemo(() => {
    if (!distributorSales.length) return [];
    
    return distributorSales.filter((sale) => {
      const saleDate = new Date(sale.sale_date);
      if (dateFrom && saleDate < new Date(dateFrom)) return false;
      if (dateTo && saleDate > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [distributorSales, dateFrom, dateTo]);

  // Calculate chart data
  const chartData = useMemo(() => {
    if (!filteredSales.length) return { monthly: [], products: [], timeline: [] };

    // Group by month
    const monthlyMap = new Map<string, { month: string; total: number; units: number }>();
    const productMap = new Map<string, { name: string; quantity: number; total: number }>();
    
    filteredSales.forEach((sale) => {
      const date = new Date(sale.sale_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
      
      // Monthly
      const existing = monthlyMap.get(monthKey) || { month: monthLabel, total: 0, units: 0 };
      existing.total += sale.total_price || 0;
      existing.units += sale.quantity || 0;
      monthlyMap.set(monthKey, existing);
      
      // Products
      const productName = sale.product_name || 'Sin nombre';
      const productExisting = productMap.get(productName) || { name: productName, quantity: 0, total: 0 };
      productExisting.quantity += sale.quantity || 0;
      productExisting.total += sale.total_price || 0;
      productMap.set(productName, productExisting);
    });

    // Sort monthly by date
    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);
    
    // Products for pie chart
    const productsList = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity);

    return { monthly, products: productsList };
  }, [filteredSales]);

  // Calculate totals for filtered sales
  const filteredTotals = useMemo(() => {
    const totalAmount = filteredSales.reduce((acc, s) => acc + (s.total_price || 0), 0);
    const totalUnits = filteredSales.reduce((acc, s) => acc + (s.quantity || 0), 0);
    const installationTotal = filteredSales.reduce((acc, s) => {
      // Parse installation from notes if present
      const match = s.notes?.match(/Instalación: \$([0-9,]+)/);
      return acc + (match ? parseInt(match[1].replace(/,/g, '')) : 0);
    }, 0);
    
    return { totalAmount, totalUnits, installationTotal };
  }, [filteredSales]);

  // Distributor CRUD handlers
  const handleOpenModal = () => {
    setFormData(initialFormData);
    setEditingDistributor(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleEditDistributor = (distributor: Distributor) => {
    setEditingDistributor(distributor);
    setFormData({
      name: distributor.name,
      company_name: distributor.company_name || '',
      nit: distributor.nit || '',
      phone: distributor.phone,
      email: distributor.email || '',
      address: distributor.address || '',
      city: distributor.city || '',
      zone: distributor.zone || '',
      contact_person: distributor.contact_person || '',
      discount_percentage: (distributor.discount_percentage || 0).toString(),
      notes: distributor.notes || '',
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormData);
    setEditingDistributor(null);
    setError(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const distributorData = {
        name: formData.name,
        company_name: formData.company_name || undefined,
        nit: formData.nit || undefined,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        zone: formData.zone || undefined,
        contact_person: formData.contact_person || undefined,
        discount_percentage: parseFloat(formData.discount_percentage) || 0,
        notes: formData.notes || undefined,
      };

      if (editingDistributor) {
        await distributorsApi.update(editingDistributor.id, distributorData);
      } else {
        await distributorsApi.create(distributorData);
      }
      handleCloseModal();
      fetchDistributors();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || `Error al ${editingDistributor ? 'actualizar' : 'crear'} el distribuidor`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (distributor: Distributor) => {
    if (!confirm(`¿Eliminar distribuidor ${distributor.name}?`)) return;
    
    try {
      await distributorsApi.delete(distributor.id);
      fetchDistributors();
    } catch (error) {
      console.error('Error deleting distributor:', error);
    }
  };

  // Detail modal handlers
  const handleOpenDetail = async (distributor: Distributor) => {
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    setDateFrom('');
    setDateTo('');
    
    try {
      const data = await distributorsApi.getById(distributor.id);
      setSelectedDistributor(data);
      setDistributorSales(data.sales || []);
    } catch (error) {
      console.error('Error loading distributor details:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedDistributor(null);
    setDistributorSales([]);
    setDateFrom('');
    setDateTo('');
  };

  // Sale modal handlers
  const handleOpenSaleModal = () => {
    setSaleFormData({
      ...initialSaleFormData,
      sale_date: new Date().toISOString().split('T')[0],
    });
    setSaleError(null);
    setIsSaleModalOpen(true);
  };

  const handleCloseSaleModal = () => {
    setIsSaleModalOpen(false);
    setSaleFormData(initialSaleFormData);
    setSaleError(null);
  };

  const handleSaleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    // Auto-fill price when product is selected
    if (name === 'product_id' && value) {
      const product = products.find((p) => p.id === parseInt(value));
      if (product && selectedDistributor) {
        const discount = selectedDistributor.discount_percentage || 0;
        const discountedPrice = product.price * (1 - discount / 100);
        setSaleFormData((prev) => ({
          ...prev,
          product_id: value,
          unit_price: Math.round(discountedPrice).toString(),
        }));
        return;
      }
    }
    
    // Update installation price when option is selected
    if (name === 'include_installation') {
      const option = INSTALLATION_OPTIONS.find((o) => o.value === value);
      setSaleFormData((prev) => ({
        ...prev,
        include_installation: value,
        installation_price: (option?.price || 0).toString(),
      }));
      return;
    }
    
    setSaleFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDistributor) return;
    
    setSaleError(null);
    setSavingSale(true);

    try {
      const installationPrice = parseInt(saleFormData.installation_price) || 0;
      const installationOption = INSTALLATION_OPTIONS.find((o) => o.value === saleFormData.include_installation);
      
      // Build notes with installation info
      let notes = saleFormData.notes || '';
      if (installationPrice > 0 && installationOption) {
        notes = `[Instalación: $${installationPrice.toLocaleString()} - ${installationOption.label}]\n${notes}`;
      }
      
      const saleData = {
        distributor_id: selectedDistributor.id,
        product_id: parseInt(saleFormData.product_id),
        quantity: parseInt(saleFormData.quantity),
        unit_price: parseFloat(saleFormData.unit_price) + (installationPrice / parseInt(saleFormData.quantity || '1')),
        sale_date: saleFormData.sale_date,
        invoice_number: saleFormData.invoice_number || undefined,
        notes: notes || undefined,
      };

      await distributorsApi.createSale(selectedDistributor.id, saleData);
      handleCloseSaleModal();
      
      // Refresh distributor details
      const data = await distributorsApi.getById(selectedDistributor.id);
      setSelectedDistributor(data);
      setDistributorSales(data.sales || []);
      
      // Refresh main list to update totals
      fetchDistributors();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setSaleError(error.response?.data?.detail || 'Error al registrar la venta');
    } finally {
      setSavingSale(false);
    }
  };

  // Calculate sale total
  const productTotal = saleFormData.unit_price && saleFormData.quantity
    ? parseFloat(saleFormData.unit_price) * parseInt(saleFormData.quantity)
    : 0;
  const installationTotal = parseInt(saleFormData.installation_price) || 0;
  const saleTotal = productTotal + installationTotal;

  // Calculate totals
  const totalSales = distributors.reduce((acc, d) => acc + (d.total_sales || 0), 0);
  const totalUnits = distributors.reduce((acc, d) => acc + (d.total_units || 0), 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Distribuidores</h1>
          <p className="text-gray-500">Gestiona tus distribuidores y sus compras</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Distribuidor
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, empresa o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-50 rounded-lg">
              <Building2 className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{distributors.length}</p>
              <p className="text-sm text-gray-500">Distribuidores</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">${totalSales.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Ventas</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Package className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalUnits}</p>
              <p className="text-sm text-gray-500">Unidades Vendidas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Distributors Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : filteredDistributors.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Building2 className="w-12 h-12 mb-3 text-gray-300" />
          <p>No hay distribuidores registrados</p>
          <button
            onClick={handleOpenModal}
            className="mt-4 text-cyan-600 hover:underline"
          >
            Agregar primer distribuidor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDistributors.map((distributor) => (
            <div
              key={distributor.id}
              className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleOpenDetail(distributor)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{distributor.name}</h3>
                    {distributor.company_name && (
                      <p className="text-xs text-gray-500">{distributor.company_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEditDistributor(distributor)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4 text-gray-400 hover:text-cyan-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(distributor)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-3">
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{distributor.phone}</span>
                </div>
                {distributor.city && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{distributor.city}</span>
                  </div>
                )}
              </div>

              {/* Sales summary */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm">
                  <span className="text-gray-500">Ventas: </span>
                  <span className="font-semibold text-green-600">
                    ${(distributor.total_sales || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center text-sm text-cyan-600">
                  <span>Ver detalle</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>

              {/* Discount badge */}
              {distributor.discount_percentage > 0 && (
                <div className="mt-2">
                  <span className="inline-block text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                    {distributor.discount_percentage}% descuento
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Distributor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingDistributor ? 'Editar Distribuidor' : 'Nuevo Distribuidor'}
        subtitle={editingDistributor ? `Editando: ${editingDistributor.name}` : 'Registra un nuevo distribuidor'}
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
              disabled={saving || !formData.name || !formData.phone}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : editingDistributor ? 'Actualizar' : 'Crear Distribuidor'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre Contacto *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Nombre del contacto"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Empresa
              </label>
              <input
                type="text"
                name="company_name"
                value={formData.company_name}
                onChange={handleInputChange}
                placeholder="Nombre de la empresa"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NIT
              </label>
              <input
                type="text"
                name="nit"
                value={formData.nit}
                onChange={handleInputChange}
                placeholder="900123456-1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="distribuidor@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                % Descuento
              </label>
              <input
                type="number"
                name="discount_percentage"
                value={formData.discount_percentage}
                onChange={handleInputChange}
                min="0"
                max="100"
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>
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
                placeholder="Dirección"
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

      {/* Distributor Detail Modal with Dashboard */}
      {isDetailModalOpen && selectedDistributor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedDistributor.name}</h2>
                  {selectedDistributor.company_name && (
                    <p className="text-indigo-200">{selectedDistributor.company_name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedDistributor.discount_percentage > 0 && (
                  <span className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-semibold">
                    {selectedDistributor.discount_percentage}% Descuento
                  </span>
                )}
                <button
                  onClick={handleCloseDetail}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingDetail ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Contact info */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                      <Phone className="w-4 h-4" />
                      Teléfono
                    </div>
                    <p className="font-medium">{selectedDistributor.phone}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                      <MapPin className="w-4 h-4" />
                      Ciudad
                    </div>
                    <p className="font-medium">{selectedDistributor.city || '-'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                      <Percent className="w-4 h-4" />
                      Descuento
                    </div>
                    <p className="font-medium">{selectedDistributor.discount_percentage || 0}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                      <ShoppingCart className="w-4 h-4" />
                      Total Compras
                    </div>
                    <p className="font-medium">{filteredSales.length}</p>
                  </div>
                </div>

                {/* Date filter */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Filter className="w-5 h-5 text-indigo-600" />
                    <span className="font-medium text-indigo-900">Filtrar por fecha</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Desde:</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Hasta:</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      />
                    </div>
                    {(dateFrom || dateTo) && (
                      <button
                        onClick={() => { setDateFrom(''); setDateTo(''); }}
                        className="text-sm text-indigo-600 hover:underline"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2 opacity-80">
                      <DollarSign className="w-5 h-5" />
                      <span className="text-sm">Total Ventas</span>
                    </div>
                    <p className="text-3xl font-bold">${filteredTotals.totalAmount.toLocaleString()}</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2 opacity-80">
                      <Package className="w-5 h-5" />
                      <span className="text-sm">Unidades</span>
                    </div>
                    <p className="text-3xl font-bold">{filteredTotals.totalUnits}</p>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-4 text-white">
                    <div className="flex items-center gap-2 mb-2 opacity-80">
                      <Wrench className="w-5 h-5" />
                      <span className="text-sm">Instalaciones</span>
                    </div>
                    <p className="text-3xl font-bold">${filteredTotals.installationTotal.toLocaleString()}</p>
                  </div>
                </div>

                {/* Charts */}
                {chartData.monthly.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Monthly sales chart */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-gray-500" />
                        <h3 className="font-semibold text-gray-900">Ventas por Mes</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData.monthly}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
                          <Tooltip 
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ventas']}
                            contentStyle={{ borderRadius: 8 }}
                          />
                          <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Products chart */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-gray-500" />
                        <h3 className="font-semibold text-gray-900">Productos Vendidos</h3>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={chartData.products}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="quantity"
                            label={({ name, quantity }) => `${name.slice(0, 15)}... (${quantity})`}
                            labelLine={false}
                          >
                            {chartData.products.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: number) => [`${value} unidades`, 'Cantidad']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Add sale button */}
                <button
                  onClick={handleOpenSaleModal}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl hover:from-cyan-600 hover:to-cyan-700 transition-all shadow-lg"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Registrar Nueva Venta
                </button>

                {/* Sales history */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Historial de Ventas</h3>
                    <span className="text-sm text-gray-500">{filteredSales.length} ventas</span>
                  </div>
                  
                  {filteredSales.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl">
                      <ShoppingCart className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500">Sin ventas registradas</p>
                      <p className="text-sm text-gray-400">
                        {dateFrom || dateTo ? 'No hay ventas en el período seleccionado' : 'Registra la primera venta'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {filteredSales.map((sale) => (
                        <div
                          key={sale.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{sale.product_name}</p>
                              <p className="text-sm text-gray-500">
                                {sale.quantity} × ${sale.unit_price?.toLocaleString()}
                              </p>
                              {sale.notes && sale.notes.includes('Instalación') && (
                                <p className="text-xs text-cyan-600 flex items-center gap-1 mt-1">
                                  <Wrench className="w-3 h-3" />
                                  Con instalación
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600 text-lg">
                              ${sale.total_price?.toLocaleString()}
                            </p>
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(sale.sale_date).toLocaleDateString('es-CO')}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                sale.payment_status === 'pagado' 
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {sale.payment_status === 'pagado' ? 'Pagado' : 'Pendiente'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Sale Modal */}
      <Modal
        isOpen={isSaleModalOpen}
        onClose={handleCloseSaleModal}
        title="Registrar Venta"
        subtitle={`Venta para ${selectedDistributor?.name} (${selectedDistributor?.discount_percentage || 0}% descuento)`}
        size="md"
        footer={
          <>
            <button
              onClick={handleCloseSaleModal}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmitSale}
              disabled={savingSale || !saleFormData.product_id || !saleFormData.quantity || !saleFormData.unit_price}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingSale ? 'Guardando...' : 'Registrar Venta'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitSale} className="space-y-4">
          {saleError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {saleError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Package className="w-4 h-4 inline mr-1" />
              Producto (Cerradura) *
            </label>
            <select
              name="product_id"
              value={saleFormData.product_id}
              onChange={handleSaleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              required
            >
              <option value="">Seleccionar cerradura...</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} - ${product.price.toLocaleString()} (Stock: {product.stock})
                </option>
              ))}
            </select>
            {selectedDistributor?.discount_percentage > 0 && saleFormData.product_id && (
              <p className="text-xs text-green-600 mt-1">
                Precio con {selectedDistributor.discount_percentage}% descuento aplicado
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cantidad *
              </label>
              <input
                type="number"
                name="quantity"
                value={saleFormData.quantity}
                onChange={handleSaleInputChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Precio Unitario *
              </label>
              <input
                type="number"
                name="unit_price"
                value={saleFormData.unit_price}
                onChange={handleSaleInputChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Installation option */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Wrench className="w-4 h-4 inline mr-1" />
              ¿Incluye instalación?
            </label>
            <select
              name="include_installation"
              value={saleFormData.include_installation}
              onChange={handleSaleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            >
              {INSTALLATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} {option.price > 0 && `- $${option.price.toLocaleString()}`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Fecha de Venta *
              </label>
              <input
                type="date"
                name="sale_date"
                value={saleFormData.sale_date}
                onChange={handleSaleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                # Factura
              </label>
              <input
                type="text"
                name="invoice_number"
                value={saleFormData.invoice_number}
                onChange={handleSaleInputChange}
                placeholder="FAC-001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* Total preview */}
          {saleTotal > 0 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 space-y-2">
              {productTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Productos ({saleFormData.quantity} × ${parseInt(saleFormData.unit_price).toLocaleString()})</span>
                  <span className="font-medium">${productTotal.toLocaleString()}</span>
                </div>
              )}
              {installationTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Instalación</span>
                  <span className="font-medium">${installationTotal.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-green-200">
                <span className="text-green-700 font-semibold">Total de la Venta</span>
                <span className="text-2xl font-bold text-green-700">
                  ${saleTotal.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas
            </label>
            <textarea
              name="notes"
              value={saleFormData.notes}
              onChange={handleSaleInputChange}
              rows={2}
              placeholder="Notas adicionales..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
