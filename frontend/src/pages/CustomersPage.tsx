import { useState, useEffect } from 'react';
import { Plus, Users, Search, Edit2, Trash2, Phone, Mail, MapPin, Package, Calendar, Receipt } from 'lucide-react';
import { customersApi, productsApi, installationsApi } from '../services/api';
import type { Customer, Product } from '../types';
import Modal from '../components/common/Modal';
import { CITIES } from '../constants/cities';

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  document_type: string;
  document_number: string;
  address: string;
  city: string;
  notes: string;
}

interface SaleFormData {
  include_sale: boolean;
  product_id: string;
  quantity: string;
  installation_type: string;
  discount_percent: string;
  sale_date: string;
  sale_notes: string;
}

const initialFormData: CustomerFormData = {
  name: '',
  phone: '',
  email: '',
  document_type: '',
  document_number: '',
  address: '',
  city: '',
  notes: '',
};

const initialSaleData: SaleFormData = {
  include_sale: false,
  product_id: '',
  quantity: '1',
  installation_type: 'none',
  discount_percent: '0',
  sale_date: new Date().toISOString().split('T')[0],
  sale_notes: '',
};

const DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'NIT', label: 'NIT' },
  { value: 'PP', label: 'Pasaporte' },
];

const INSTALLATION_TYPES = [
  { value: 'none', label: 'Sin instalación', price: 0 },
  { value: 'standard', label: 'Instalación Estándar', price: 189000 },
  { value: 'remote', label: 'Instalación Remota + Viáticos', price: 250000 },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [saleData, setSaleData] = useState<SaleFormData>(initialSaleData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const fetchCustomers = async () => {
    try {
      const data = await customersApi.getAll();
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
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
    fetchCustomers();
    fetchProducts();
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenModal = () => {
    setFormData(initialFormData);
    setSaleData(initialSaleData);
    setEditingCustomer(null);
    setError(null);
    setIsModalOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      document_type: customer.document_type || '',
      document_number: customer.document_number || '',
      address: customer.address || '',
      city: customer.city || '',
      notes: customer.notes || '',
    });
    setSaleData(initialSaleData);
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormData);
    setSaleData(initialSaleData);
    setEditingCustomer(null);
    setError(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setSaleData((prev) => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setSaleData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Calculate sale breakdown
  const calculateSaleBreakdown = () => {
    const product = products.find(p => p.id.toString() === saleData.product_id);
    if (!product) return null;

    const quantity = parseInt(saleData.quantity) || 1;
    const installationType = INSTALLATION_TYPES.find(t => t.value === saleData.installation_type);
    const discountPercent = parseFloat(saleData.discount_percent) || 0;

    const productSubtotal = product.price * quantity;
    const installationTotal = (installationType?.price || 0) * quantity;
    const subtotal = productSubtotal + installationTotal;
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal - discountAmount;

    return {
      product,
      quantity,
      productPrice: product.price,
      productSubtotal,
      installationType: installationType?.label || 'Sin instalación',
      installationPrice: installationType?.price || 0,
      installationTotal,
      subtotal,
      discountPercent,
      discountAmount,
      total,
    };
  };

  const saleBreakdown = saleData.include_sale && saleData.product_id ? calculateSaleBreakdown() : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const customerData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        document_type: formData.document_type || undefined,
        document_number: formData.document_number || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        notes: formData.notes || undefined,
      };

      let customer: Customer;

      if (editingCustomer) {
        customer = await customersApi.update(editingCustomer.id, customerData);
      } else {
        customer = await customersApi.create(customerData);
        
        // If including sale info, create an installation record
        if (saleData.include_sale && saleData.product_id && saleBreakdown) {
          const installationType = INSTALLATION_TYPES.find(t => t.value === saleData.installation_type);
          
          // Build sale details for notes
          const saleDetails = [
            `[VENTA: ${saleData.sale_date}]`,
            `Producto: ${saleBreakdown.product.name} (${saleBreakdown.product.sku})`,
            `Cantidad: ${saleBreakdown.quantity}`,
            `Precio unitario: $${saleBreakdown.productPrice.toLocaleString()}`,
            `Tipo instalación: ${saleBreakdown.installationType}`,
            saleBreakdown.discountPercent > 0 ? `Descuento: ${saleBreakdown.discountPercent}%` : '',
            `TOTAL: $${saleBreakdown.total.toLocaleString()}`,
            saleData.sale_notes ? `Notas: ${saleData.sale_notes}` : '',
          ].filter(Boolean).join('\n');

          // Create installation record
          const installationData = {
            lead_id: customer.id, // We use customer id as lead_id for now
            customer_id: customer.id,
            product_id: parseInt(saleData.product_id),
            quantity: parseInt(saleData.quantity) || 1,
            scheduled_date: saleData.sale_date,
            address: formData.address || 'Sin dirección',
            city: formData.city || undefined,
            status: 'completada' as const,
            total_price: saleBreakdown.total,
            installation_price: saleBreakdown.installationTotal,
            discount_amount: saleBreakdown.discountAmount,
            payment_status: 'pagado' as const,
            amount_paid: saleBreakdown.total,
            customer_notes: saleDetails,
            completed_at: saleData.sale_date,
          };

          try {
            await installationsApi.create(installationData);
          } catch (installError) {
            console.error('Error creating installation:', installError);
            // Don't fail the whole operation, just log it
          }
        }
      }
      
      handleCloseModal();
      fetchCustomers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || `Error al ${editingCustomer ? 'actualizar' : 'crear'} el cliente`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`¿Eliminar cliente ${customer.name}?`)) return;
    
    try {
      await customersApi.delete(customer.id);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  };

  const callPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_self');
  };

  const openWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/57${cleanPhone}`, '_blank');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Gestiona tus clientes registrados</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Cliente
        </button>
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-50 rounded-lg">
              <Users className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
              <p className="text-sm text-gray-500">Total Clientes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Users className="w-12 h-12 mb-3 text-gray-300" />
          <p>No hay clientes registrados</p>
          <button
            onClick={handleOpenModal}
            className="mt-4 text-cyan-600 hover:underline"
          >
            Agregar primer cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
                    <span className="text-cyan-600 font-semibold">
                      {customer.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                    {customer.document_number && (
                      <p className="text-xs text-gray-500">
                        {customer.document_type}: {customer.document_number}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditCustomer(customer)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4 text-gray-400 hover:text-cyan-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(customer)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
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
                {customer.city && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{customer.city}</span>
                  </div>
                )}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Customer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
        subtitle={editingCustomer ? `Editando: ${editingCustomer.name}` : 'Registra un nuevo cliente con su compra'}
        size="xl"
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
              {saving ? 'Guardando...' : editingCustomer ? 'Actualizar' : 'Crear Cliente'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Customer Info Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-500" />
              Información del Cliente
            </h3>
            
            <div className="space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Documento
                  </label>
                  <select
                    name="document_type"
                    value={formData.document_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número de Documento
                  </label>
                  <input
                    type="text"
                    name="document_number"
                    value={formData.document_number}
                    onChange={handleInputChange}
                    placeholder="123456789"
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={2}
                  placeholder="Notas adicionales sobre el cliente..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Sale Info Section - Only for new customers */}
          {!editingCustomer && (
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="include_sale"
                    checked={saleData.include_sale}
                    onChange={handleSaleInputChange}
                    className="w-4 h-4 text-cyan-500 border-gray-300 rounded focus:ring-cyan-500"
                  />
                  <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-green-500" />
                    Registrar información de la venta
                  </span>
                </label>
              </div>

              {saleData.include_sale && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Fecha de la Venta *
                      </label>
                      <input
                        type="date"
                        name="sale_date"
                        value={saleData.sale_date}
                        onChange={handleSaleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Package className="w-4 h-4 inline mr-1" />
                        Cerradura *
                      </label>
                      <select
                        name="product_id"
                        value={saleData.product_id}
                        onChange={handleSaleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      >
                        <option value="">Seleccionar producto...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} - {product.name} (${product.price.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        name="quantity"
                        value={saleData.quantity}
                        onChange={handleSaleInputChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Instalación
                      </label>
                      <select
                        name="installation_type"
                        value={saleData.installation_type}
                        onChange={handleSaleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      >
                        {INSTALLATION_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label} {type.price > 0 && `($${type.price.toLocaleString()})`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descuento (%)
                      </label>
                      <input
                        type="number"
                        name="discount_percent"
                        value={saleData.discount_percent}
                        onChange={handleSaleInputChange}
                        min="0"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notas de la venta
                    </label>
                    <input
                      type="text"
                      name="sale_notes"
                      value={saleData.sale_notes}
                      onChange={handleSaleInputChange}
                      placeholder="Ej: Referido por cliente X, promoción especial..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    />
                  </div>

                  {/* Sale Breakdown */}
                  {saleBreakdown && (
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3">Desglose de la Venta</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            {saleBreakdown.product.name} x {saleBreakdown.quantity}
                          </span>
                          <span className="font-medium">${saleBreakdown.productSubtotal.toLocaleString()}</span>
                        </div>
                        {saleBreakdown.installationTotal > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">{saleBreakdown.installationType}</span>
                            <span className="font-medium">${saleBreakdown.installationTotal.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="font-medium">${saleBreakdown.subtotal.toLocaleString()}</span>
                        </div>
                        {saleBreakdown.discountAmount > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Descuento ({saleBreakdown.discountPercent}%)</span>
                            <span>-${saleBreakdown.discountAmount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t pt-2 text-lg font-bold text-green-600">
                          <span>TOTAL</span>
                          <span>${saleBreakdown.total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
