import { useState, useEffect, useRef } from 'react';
import { Clock, User, ChevronLeft, ChevronRight, Plus, MapPin, Phone, Package, Calendar, MessageSquare, X, UserPlus, Percent, DollarSign, Edit3, Search, Trash2, ZoomIn, TrendingUp, TrendingDown } from 'lucide-react';
import { installationsApi, leadsApi, productsApi, techniciansApi } from '../services/api';
import type { Installation, Lead, Product, Technician, LeadStatus, LeadSource } from '../types';
import Modal from '../components/common/Modal';
import { CITIES } from '../constants/cities';

const statusLabels: Record&lt;string, { label: string; color: string }&gt; = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  programada: { label: 'Programada', color: 'bg-blue-100 text-blue-700' },
  en_camino: { label: 'En camino', color: 'bg-indigo-100 text-indigo-700' },
  en_progreso: { label: 'En progreso', color: 'bg-purple-100 text-purple-700' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
};

const paymentLabels: Record&lt;string, { label: string; color: string }&gt; = {
  pendiente: { label: 'Sin pagar', color: 'bg-red-100 text-red-700' },
  parcial: { label: 'Parcial', color: 'bg-yellow-100 text-yellow-700' },
  pagado: { label: 'Pagado', color: 'bg-green-100 text-green-700' },
};

// Opciones de precio de instalación
const INSTALLATION_PRICES = [
  { value: '189000', label: '$189,000 - Instalación estándar' },
  { value: '250000', label: '$250,000 - Instalación + desplazamiento' },
];

// Price adjustment types - includes both discounts and surcharges
type PriceAdjustmentType = 'none' | 'discount_percentage' | 'discount_value' | 'surcharge_percentage' | 'surcharge_value';

// Selected product item for multi-product support
interface SelectedProduct {
  product_id: number;
  product_name: string;
  product_price: number;
  product_image?: string;
  quantity: number;
}

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
  price_adjustment_type: PriceAdjustmentType;
  price_adjustment_value: string;
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
  price_adjustment_type: 'none',
  price_adjustment_value: '',
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
  const [installations, setInstallations] = useState&lt;Installation[]&gt;([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState&lt;InstallationFormData&gt;(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState&lt;string | null&gt;(null);
  
  // Edit mode state
  const [editingInstallation, setEditingInstallation] = useState&lt;Installation | null&gt;(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Quick lead modal state
  const [isQuickLeadModalOpen, setIsQuickLeadModalOpen] = useState(false);
  const [quickLeadData, setQuickLeadData] = useState&lt;QuickLeadFormData&gt;(initialQuickLeadData);
  const [savingLead, setSavingLead] = useState(false);
  const [leadError, setLeadError] = useState&lt;string | null&gt;(null);

  // Detail modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedInstallation, setSelectedInstallation] = useState&lt;InstallationDetail | null&gt;(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Image lightbox state
  const [enlargedImage, setEnlargedImage] = useState&lt;{ url: string; name: string } | null&gt;(null);

  // Options for selects
  const [leads, setLeads] = useState&lt;Lead[]&gt;([]);
  const [products, setProducts] = useState&lt;Product[]&gt;([]);
  const [technicians, setTechnicians] = useState&lt;Technician[]&gt;([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // Product search and multi-select state
  const [productSearch, setProductSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState&lt;SelectedProduct[]&gt;([]);
  const [tempQuantity, setTempQuantity] = useState('1');
  const productSearchRef = useRef&lt;HTMLDivElement&gt;(null);

  // Filter products based on search
  const filteredProducts = products.filter(product =&gt; {
    const searchLower = productSearch.toLowerCase();
    return (
      product.name.toLowerCase().includes(searchLower) ||
      (product.model &amp;&amp; product.model.toLowerCase().includes(searchLower))
    );
  });

  // Close dropdown when clicking outside
  useEffect(() =&gt; {
    const handleClickOutside = (event: MouseEvent) =&gt; {
      if (productSearchRef.current &amp;&amp; !productSearchRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () =&gt; document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchInstallations = async () =&gt; {
    try {
      const data = await installationsApi.getAll();
      setInstallations(data);
    } catch (error) {
      console.error('Error fetching installations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() =&gt; {
    fetchInstallations();
  }, []);

  const formatDate = (date: Date) =&gt; {
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const navigateWeek = (direction: number) =&gt; {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const getWeekDays = () =&gt; {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);

    for (let i = 0; i &lt; 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getInstallationsForDay = (day: Date) =&gt; {
    return installations.filter((inst) =&gt; {
      if (!inst.scheduled_date) return false;
      const instDate = new Date(inst.scheduled_date);
      return (
        instDate.getDate() === day.getDate() &amp;&amp;
        instDate.getMonth() === day.getMonth() &amp;&amp;
        instDate.getFullYear() === day.getFullYear()
      );
    });
  };

  const weekDays = getWeekDays();
  const today = new Date();

  // Calculate total price with discount or surcharge (updated for multiple products)
  const calculateTotalPrice = (
    selectedProductsList: SelectedProduct[],
    installationPrice: string,
    adjustmentType: PriceAdjustmentType,
    adjustmentValue: string
  ): { subtotal: number; adjustment: number; total: number; productsTotal: number; isDiscount: boolean } =&gt; {
    if (selectedProductsList.length === 0 || !installationPrice) {
      return { subtotal: 0, adjustment: 0, total: 0, productsTotal: 0, isDiscount: true };
    }
    
    const productsTotal = selectedProductsList.reduce((sum, item) =&gt; {
      return sum + (item.product_price * item.quantity);
    }, 0);
    
    const installTotal = parseInt(installationPrice);
    const subtotal = productsTotal + installTotal;
    
    let adjustment = 0;
    let isDiscount = true;
    
    if (adjustmentType === 'discount_percentage' &amp;&amp; adjustmentValue) {
      const percentage = parseFloat(adjustmentValue) || 0;
      adjustment = Math.round(subtotal * (percentage / 100));
      isDiscount = true;
    } else if (adjustmentType === 'discount_value' &amp;&amp; adjustmentValue) {
      adjustment = parseInt(adjustmentValue) || 0;
      isDiscount = true;
    } else if (adjustmentType === 'surcharge_percentage' &amp;&amp; adjustmentValue) {
      const percentage = parseFloat(adjustmentValue) || 0;
      adjustment = Math.round(subtotal * (percentage / 100));
      isDiscount = false;
    } else if (adjustmentType === 'surcharge_value' &amp;&amp; adjustmentValue) {
      adjustment = parseInt(adjustmentValue) || 0;
      isDiscount = false;
    }
    
    // Calculate total: subtract for discount, add for surcharge
    const total = isDiscount 
      ? Math.max(0, subtotal - adjustment)
      : subtotal + adjustment;
    
    return { subtotal, adjustment, total, productsTotal, isDiscount };
  };

  // Add product to selected list
  const handleAddProduct = (product: Product) =&gt; {
    const quantity = parseInt(tempQuantity) || 1;
    
    // Check if product already exists
    const existingIndex = selectedProducts.findIndex(p =&gt; p.product_id === product.id);
    
    if (existingIndex &gt;= 0) {
      // Update quantity if exists
      const updated = [...selectedProducts];
      updated[existingIndex].quantity += quantity;
      setSelectedProducts(updated);
    } else {
      // Add new product with image
      setSelectedProducts([...selectedProducts, {
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        product_image: product.image_url,
        quantity: quantity
      }]);
    }
    
    // Reset search and quantity
    setProductSearch('');
    setTempQuantity('1');
    setIsProductDropdownOpen(false);
    
    // Update form data with first product (for backend compatibility)
    if (selectedProducts.length === 0) {
      setFormData(prev =&gt; ({
        ...prev,
        product_id: product.id.toString(),
        quantity: quantity.toString()
      }));
    }
  };

  // Remove product from selected list
  const handleRemoveProduct = (productId: number) =&gt; {
    const updated = selectedProducts.filter(p =&gt; p.product_id !== productId);
    setSelectedProducts(updated);
    
    // Update form data
    if (updated.length &gt; 0) {
      setFormData(prev =&gt; ({
        ...prev,
        product_id: updated[0].product_id.toString(),
        quantity: updated[0].quantity.toString()
      }));
    } else {
      setFormData(prev =&gt; ({
        ...prev,
        product_id: '',
        quantity: '1'
      }));
    }
  };

  // Update product quantity in list
  const handleUpdateProductQuantity = (productId: number, newQuantity: number) =&gt; {
    if (newQuantity &lt; 1) return;
    
    const updated = selectedProducts.map(p =&gt; 
      p.product_id === productId ? { ...p, quantity: newQuantity } : p
    );
    setSelectedProducts(updated);
  };

  // Image lightbox handlers
  const handleOpenImage = (url: string, name: string) =&gt; {
    setEnlargedImage({ url, name });
  };

  const handleCloseImage = () =&gt; {
    setEnlargedImage(null);
  };

  // Detail modal handlers
  const handleOpenDetail = async (installation: Installation) =&gt; {
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

      const lead = leadsData.find((l: Lead) =&gt; l.id === installation.lead_id);
      const product = productsData.find((p: Product) =&gt; p.id === installation.product_id);
      const technician = techniciansData.find((t: Technician) =&gt; t.id === installation.technician_id);

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

  const handleCloseDetail = () =&gt; {
    setIsDetailModalOpen(false);
    setSelectedInstallation(null);
  };

  const openMaps = (address: string, city?: string) =&gt; {
    const fullAddress = city ? `${address}, ${city}` : address;
    const url = `https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(fullAddress)}`;
    window.open(url, '_blank');
  };

  const callPhone = (phone: string) =&gt; {
    window.open(`tel:${phone}`, '_self');
  };

  const openWhatsApp = (phone: string) =&gt; {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  // Modal handlers for CREATE
  const handleOpenModal = async () =&gt; {
    setFormData(initialFormData);
    setSelectedProducts([]);
    setProductSearch('');
    setTempQuantity('1');
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
  const handleOpenEditModal = async (installation: InstallationDetail) =&gt; {
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
        techniciansApi.getAll(),
      ]);
      setLeads(leadsData);
      setProducts(productsData);
      setTechnicians(techniciansData);

      // Set selected products from existing installation
      const existingProduct = productsData.find((p: Product) =&gt; p.id === installation.product_id);
      if (existingProduct) {
        setSelectedProducts([{
          product_id: existingProduct.id,
          product_name: existingProduct.name,
          product_price: existingProduct.price,
          product_image: existingProduct.image_url,
          quantity: installation.quantity || 1
        }]);
      }

      // Calculate initial price based on existing data
      const defaultInstallPrice = '189000';

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
        price_adjustment_type: 'none',
        price_adjustment_value: '',
        total_price: installation.total_price?.toString() || '',
        customer_notes: installation.customer_notes || '',
      });
    } catch (err) {
      console.error('Error loading options:', err);
      setError('Error cargando datos. Intente de nuevo.');
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleCloseModal = () =&gt; {
    setIsModalOpen(false);
    setFormData(initialFormData);
    setSelectedProducts([]);
    setProductSearch('');
    setError(null);
    setIsEditMode(false);
    setEditingInstallation(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent&lt;HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement&gt;
  ) =&gt; {
    const { name, value } = e.target;
    
    // Auto-fill address when lead is selected
    if (name === 'lead_id' &amp;&amp; value) {
      const selectedLead = leads.find((l) =&gt; l.id === parseInt(value));
      if (selectedLead?.address) {
        setFormData((prev) =&gt; ({
          ...prev,
          lead_id: value,
          address: selectedLead.address || '',
          city: selectedLead.city || '',
        }));
        return;
      }
    }

    // Reset adjustment value when changing type
    if (name === 'price_adjustment_type') {
      setFormData((prev) =&gt; ({
        ...prev,
        price_adjustment_type: value as PriceAdjustmentType,
        price_adjustment_value: '',
      }));
      return;
    }

    setFormData((prev) =&gt; ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) =&gt; {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Calculate total price
      const priceData = calculateTotalPrice(
        selectedProducts,
        formData.installation_price,
        formData.price_adjustment_type,
        formData.price_adjustment_value
      );

      // Use first product for main record (backend compatibility)
      const mainProduct = selectedProducts[0];
      const totalQuantity = selectedProducts.reduce((sum, p) =&gt; sum + p.quantity, 0);

      const installationData = {
        lead_id: parseInt(formData.lead_id),
        product_id: mainProduct?.product_id || parseInt(formData.product_id),
        technician_id: formData.technician_id ? parseInt(formData.technician_id) : undefined,
        quantity: totalQuantity || 1,
        scheduled_date: formData.scheduled_date || undefined,
        scheduled_time: formData.scheduled_time || undefined,
        address: formData.address,
        city: formData.city || undefined,
        address_notes: formData.address_notes || undefined,
        total_price: priceData.total || 0,
        customer_notes: formData.customer_notes || undefined,
      };

      if (isEditMode &amp;&amp; editingInstallation) {
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
  const handleOpenQuickLead = () =&gt; {
    setQuickLeadData(initialQuickLeadData);
    setLeadError(null);
    setIsQuickLeadModalOpen(true);
  };

  const handleCloseQuickLead = () =&gt; {
    setIsQuickLeadModalOpen(false);
    setQuickLeadData(initialQuickLeadData);
    setLeadError(null);
  };

  const handleQuickLeadChange = (
    e: React.ChangeEvent&lt;HTMLInputElement | HTMLSelectElement&gt;
  ) =&gt; {
    const { name, value } = e.target;
    setQuickLeadData((prev) =&gt; ({ ...prev, [name]: value }));
  };

  const handleQuickLeadSubmit = async (e: React.FormEvent) =&gt; {
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
      setLeads((prev) =&gt; [...prev, newLead]);
      setFormData((prev) =&gt; ({
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

  // Calculate price breakdown for display
  const priceBreakdown = selectedProducts.length &gt; 0 
    ? calculateTotalPrice(
        selectedProducts,
        formData.installation_price,
        formData.price_adjustment_type,
        formData.price_adjustment_value
      )
    : null;

  // Helper to check if adjustment type is percentage
  const isPercentageAdjustment = formData.price_adjustment_type === 'discount_percentage' || formData.price_adjustment_type === 'surcharge_percentage';

  return (
    &lt;div className="p-6"&gt;
      {/* Header */}
      &lt;div className="flex items-center justify-between mb-6"&gt;
        &lt;div&gt;
          &lt;h1 className="text-2xl font-bold text-gray-900"&gt;Instalaciones&lt;/h1&gt;
          &lt;p className="text-gray-500"&gt;Agenda de instalaciones programadas&lt;/p&gt;
        &lt;/div&gt;
        &lt;button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        &gt;
          &lt;Plus className="w-4 h-4" /&gt;
          Nueva Instalacion
        &lt;/button&gt;
      &lt;/div&gt;

      {/* Week Navigation */}
      &lt;div className="flex items-center justify-between mb-6 bg-white rounded-lg p-4 border border-gray-100"&gt;
        &lt;button
          onClick={() =&gt; navigateWeek(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        &gt;
          &lt;ChevronLeft className="w-5 h-5 text-gray-600" /&gt;
        &lt;/button&gt;
        &lt;span className="text-lg font-semibold text-gray-900 capitalize"&gt;
          {formatDate(currentDate)}
        &lt;/span&gt;
        &lt;button
          onClick={() =&gt; navigateWeek(1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        &gt;
          &lt;ChevronRight className="w-5 h-5 text-gray-600" /&gt;
        &lt;/button&gt;
      &lt;/div&gt;

      {/* Calendar Grid */}
      {loading ? (
        &lt;div className="flex items-center justify-center h-64"&gt;
          &lt;div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" /&gt;
        &lt;/div&gt;
      ) : (
        &lt;div className="grid grid-cols-7 gap-4"&gt;
          {weekDays.map((day) =&gt; {
            const isToday =
              day.getDate() === today.getDate() &amp;&amp;
              day.getMonth() === today.getMonth() &amp;&amp;
              day.getFullYear() === today.getFullYear();
            const dayInstallations = getInstallationsForDay(day);

            return (
              &lt;div
                key={day.toISOString()}
                className={`bg-white rounded-lg border ${
                  isToday ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-gray-100'
                } min-h-[300px]`}
              &gt;
                {/* Day Header */}
                &lt;div
                  className={`p-3 border-b ${isToday ? 'bg-cyan-50' : 'bg-gray-50'}`}
                &gt;
                  &lt;p className="text-xs text-gray-500 uppercase"&gt;
                    {day.toLocaleDateString('es-CO', { weekday: 'short' })}
                  &lt;/p&gt;
                  &lt;p
                    className={`text-lg font-bold ${
                      isToday ? 'text-cyan-600' : 'text-gray-900'
                    }`}
                  &gt;
                    {day.getDate()}
                  &lt;/p&gt;
                &lt;/div&gt;

                {/* Installations */}
                &lt;div className="p-2 space-y-2"&gt;
                  {dayInstallations.length === 0 ? (
                    &lt;p className="text-xs text-gray-400 text-center py-4"&gt;
                      Sin instalaciones
                    &lt;/p&gt;
                  ) : (
                    dayInstallations.map((inst) =&gt; {
                      const status = statusLabels[inst.status] || statusLabels.pendiente;
                      return (
                        &lt;div
                          key={inst.id}
                          onClick={() =&gt; handleOpenDetail(inst)}
                          className="p-2 bg-gray-50 rounded-lg hover:bg-cyan-50 cursor-pointer transition-colors border border-transparent hover:border-cyan-200"
                        &gt;
                          &lt;div className="flex items-center gap-1 text-xs text-gray-500 mb-1"&gt;
                            &lt;Clock className="w-3 h-3" /&gt;
                            {inst.scheduled_time || 'Sin hora'}
                          &lt;/div&gt;
                          &lt;p className="text-sm font-medium text-gray-900 truncate"&gt;
                            Instalacion #{inst.id}
                          &lt;/p&gt;
                          &lt;div className="flex items-center gap-1 text-xs text-gray-500 mt-1"&gt;
                            &lt;User className="w-3 h-3" /&gt;
                            &lt;span className="truncate"&gt;
                              {inst.technician_id ? `Tecnico #${inst.technician_id}` : 'Sin asignar'}
                            &lt;/span&gt;
                          &lt;/div&gt;
                          &lt;span
                            className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${status.color}`}
                          &gt;
                            {status.label}
                          &lt;/span&gt;
                        &lt;/div&gt;
                      );
                    })
                  )}
                &lt;/div&gt;
              &lt;/div&gt;
            );
          })}
        &lt;/div&gt;
      )}

      {/* Image Lightbox Modal */}
      {enlargedImage &amp;&amp; (
        &lt;div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
          onClick={handleCloseImage}
        &gt;
          &lt;div 
            className="relative max-w-3xl max-h-[90vh] bg-white rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) =&gt; e.stopPropagation()}
          &gt;
            {/* Close button */}
            &lt;button
              onClick={handleCloseImage}
              className="absolute top-3 right-3 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
            &gt;
              &lt;X className="w-5 h-5" /&gt;
            &lt;/button&gt;
            
            {/* Product name */}
            &lt;div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4"&gt;
              &lt;p className="text-white font-medium text-lg"&gt;{enlargedImage.name}&lt;/p&gt;
            &lt;/div&gt;
            
            {/* Image */}
            &lt;img
              src={enlargedImage.url}
              alt={enlargedImage.name}
              className="max-w-full max-h-[85vh] object-contain"
            /&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      )}

      {/* Installation Detail Modal */}
      {isDetailModalOpen &amp;&amp; selectedInstallation &amp;&amp; (
        &lt;div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"&gt;
          &lt;div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"&gt;
            {/* Header */}
            &lt;div className="sticky top-0 bg-cyan-500 text-white px-6 py-4 rounded-t-xl flex items-center justify-between"&gt;
              &lt;div&gt;
                &lt;h2 className="text-xl font-bold"&gt;Instalación #{selectedInstallation.id}&lt;/h2&gt;
                &lt;span className={`text-xs px-2 py-0.5 rounded ${statusLabels[selectedInstallation.status]?.color || 'bg-gray-100'}`}&gt;
                  {statusLabels[selectedInstallation.status]?.label || selectedInstallation.status}
                &lt;/span&gt;
              &lt;/div&gt;
              &lt;div className="flex items-center gap-2"&gt;
                {/* Edit Button */}
                &lt;button
                  onClick={() =&gt; handleOpenEditModal(selectedInstallation)}
                  className="p-2 hover:bg-cyan-600 rounded-lg transition-colors"
                  title="Editar instalación"
                &gt;
                  &lt;Edit3 className="w-5 h-5" /&gt;
                &lt;/button&gt;
                &lt;button
                  onClick={handleCloseDetail}
                  className="p-2 hover:bg-cyan-600 rounded-lg transition-colors"
                &gt;
                  &lt;X className="w-5 h-5" /&gt;
                &lt;/button&gt;
              &lt;/div&gt;
            &lt;/div&gt;

            {loadingDetail ? (
              &lt;div className="flex items-center justify-center py-12"&gt;
                &lt;div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" /&gt;
              &lt;/div&gt;
            ) : (
              &lt;div className="p-6 space-y-4"&gt;
                {/* Cliente */}
                &lt;div className="bg-gray-50 rounded-lg p-4"&gt;
                  &lt;h3 className="text-sm font-semibold text-gray-500 uppercase mb-2"&gt;Cliente&lt;/h3&gt;
                  &lt;p className="text-lg font-semibold text-gray-900"&gt;
                    {selectedInstallation.lead?.name || 'Sin nombre'}
                  &lt;/p&gt;
                  {selectedInstallation.lead?.phone &amp;&amp; (
                    &lt;div className="flex items-center gap-2 mt-2"&gt;
                      &lt;Phone className="w-4 h-4 text-gray-400" /&gt;
                      &lt;a href={`tel:${selectedInstallation.lead.phone}`} className="text-cyan-600"&gt;
                        {selectedInstallation.lead.phone}
                      &lt;/a&gt;
                    &lt;/div&gt;
                  )}
                  
                  {/* Contact buttons */}
                  {selectedInstallation.lead?.phone &amp;&amp; (
                    &lt;div className="flex gap-2 mt-3"&gt;
                      &lt;button
                        onClick={() =&gt; callPhone(selectedInstallation.lead!.phone)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium"
                      &gt;
                        &lt;Phone className="w-4 h-4" /&gt;
                        Llamar
                      &lt;/button&gt;
                      &lt;button
                        onClick={() =&gt; openWhatsApp(selectedInstallation.lead!.phone)}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-500 text-white rounded-lg text-sm font-medium"
                      &gt;
                        &lt;MessageSquare className="w-4 h-4" /&gt;
                        WhatsApp
                      &lt;/button&gt;
                    &lt;/div&gt;
                  )}
                &lt;/div&gt;

                {/* Fecha y Hora */}
                &lt;div className="bg-gray-50 rounded-lg p-4"&gt;
                  &lt;h3 className="text-sm font-semibold text-gray-500 uppercase mb-2"&gt;Programación&lt;/h3&gt;
                  &lt;div className="flex items-center gap-2"&gt;
                    &lt;Calendar className="w-5 h-5 text-gray-400" /&gt;
                    &lt;span className="text-gray-900"&gt;
                      {selectedInstallation.scheduled_date 
                        ? new Date(selectedInstallation.scheduled_date).toLocaleDateString('es-CO', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })
                        : 'Sin fecha'}
                    &lt;/span&gt;
                  &lt;/div&gt;
                  &lt;div className="flex items-center gap-2 mt-2"&gt;
                    &lt;Clock className="w-5 h-5 text-gray-400" /&gt;
                    &lt;span className="text-gray-900"&gt;
                      {selectedInstallation.scheduled_time || 'Sin hora'}
                    &lt;/span&gt;
                  &lt;/div&gt;
                &lt;/div&gt;

                {/* Dirección */}
                &lt;div className="bg-gray-50 rounded-lg p-4"&gt;
                  &lt;h3 className="text-sm font-semibold text-gray-500 uppercase mb-2"&gt;Dirección&lt;/h3&gt;
                  &lt;div className="flex items-start gap-2"&gt;
                    &lt;MapPin className="w-5 h-5 text-gray-400 mt-0.5" /&gt;
                    &lt;div&gt;
                      &lt;p className="text-gray-900"&gt;{selectedInstallation.address}&lt;/p&gt;
                      {selectedInstallation.city &amp;&amp; (
                        &lt;p className="text-gray-500 text-sm"&gt;{selectedInstallation.city}&lt;/p&gt;
                      )}
                      {selectedInstallation.address_notes &amp;&amp; (
                        &lt;p className="text-cyan-600 text-sm mt-1"&gt;{selectedInstallation.address_notes}&lt;/p&gt;
                      )}
                    &lt;/div&gt;
                  &lt;/div&gt;
                  &lt;button
                    onClick={() =&gt; openMaps(selectedInstallation.address, selectedInstallation.city || undefined)}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium"
                  &gt;
                    &lt;MapPin className="w-4 h-4" /&gt;
                    Ver en Google Maps
                  &lt;/button&gt;
                &lt;/div&gt;

                {/* Producto */}
                &lt;div className="bg-gray-50 rounded-lg p-4"&gt;
                  &lt;h3 className="text-sm font-semibold text-gray-500 uppercase mb-2"&gt;Producto&lt;/h3&gt;
                  &lt;div className="flex items-center gap-3"&gt;
                    &lt;div 
                      className={`w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center overflow-hidden ${selectedInstallation.product?.image_url ? 'cursor-pointer hover:ring-2 hover:ring-cyan-400 transition-all' : ''}`}
                      onClick={() =&gt; {
                        if (selectedInstallation.product?.image_url) {
                          handleOpenImage(selectedInstallation.product.image_url, selectedInstallation.product.name);
                        }
                      }}
                    &gt;
                      {selectedInstallation.product?.image_url ? (
                        &lt;img 
                          src={selectedInstallation.product.image_url} 
                          alt={selectedInstallation.product.name}
                          className="w-full h-full object-cover"
                        /&gt;
                      ) : (
                        &lt;Package className="w-6 h-6 text-cyan-600" /&gt;
                      )}
                    &lt;/div&gt;
                    &lt;div&gt;
                      &lt;p className="font-semibold text-gray-900"&gt;
                        {selectedInstallation.product?.name || `Producto #${selectedInstallation.product_id}`}
                      &lt;/p&gt;
                      &lt;p className="text-sm text-gray-500"&gt;
                        {selectedInstallation.product?.model || ''}
                      &lt;/p&gt;
                    &lt;/div&gt;
                  &lt;/div&gt;
                &lt;/div&gt;

                {/* Técnico */}
                &lt;div className="bg-gray-50 rounded-lg p-4"&gt;
                  &lt;h3 className="text-sm font-semibold text-gray-500 uppercase mb-2"&gt;Técnico Asignado&lt;/h3&gt;
                  &lt;div className="flex items-center gap-3"&gt;
                    &lt;div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center"&gt;
                      &lt;User className="w-6 h-6 text-indigo-600" /&gt;
                    &lt;/div&gt;
                    &lt;div&gt;
                      &lt;p className="font-semibold text-gray-900"&gt;
                        {selectedInstallation.technician?.full_name || 'Sin asignar'}
                      &lt;/p&gt;
                      {selectedInstallation.technician?.phone &amp;&amp; (
                        &lt;p className="text-sm text-gray-500"&gt;
                          {selectedInstallation.technician.phone}
                        &lt;/p&gt;
                      )}
                    &lt;/div&gt;
                  &lt;/div&gt;
                &lt;/div&gt;

                {/* Pago */}
                &lt;div className="bg-gray-50 rounded-lg p-4"&gt;
                  &lt;h3 className="text-sm font-semibold text-gray-500 uppercase mb-2"&gt;Pago&lt;/h3&gt;
                  &lt;div className="flex items-center justify-between mb-2"&gt;
                    &lt;span className="text-gray-500"&gt;Total&lt;/span&gt;
                    &lt;span className="text-xl font-bold text-gray-900"&gt;
                      ${selectedInstallation.total_price?.toLocaleString() || '0'}
                    &lt;/span&gt;
                  &lt;/div&gt;
                  &lt;div className="flex items-center justify-between mb-2"&gt;
                    &lt;span className="text-gray-500"&gt;Pagado&lt;/span&gt;
                    &lt;span className="text-green-600 font-medium"&gt;
                      ${selectedInstallation.amount_paid?.toLocaleString() || '0'}
                    &lt;/span&gt;
                  &lt;/div&gt;
                  &lt;div className="flex items-center justify-between pt-2 border-t"&gt;
                    &lt;span className="text-gray-700 font-medium"&gt;Por cobrar&lt;/span&gt;
                    &lt;span className="text-cyan-600 font-bold"&gt;
                      ${((selectedInstallation.total_price || 0) - (selectedInstallation.amount_paid || 0)).toLocaleString()}
                    &lt;/span&gt;
                  &lt;/div&gt;
                  &lt;div className="mt-2"&gt;
                    &lt;span className={`text-xs px-2 py-1 rounded ${paymentLabels[selectedInstallation.payment_status]?.color || 'bg-gray-100'}`}&gt;
                      {paymentLabels[selectedInstallation.payment_status]?.label || selectedInstallation.payment_status}
                    &lt;/span&gt;
                  &lt;/div&gt;
                &lt;/div&gt;

                {/* Notas */}
                {selectedInstallation.customer_notes &amp;&amp; (
                  &lt;div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"&gt;
                    &lt;h3 className="text-sm font-semibold text-yellow-800 mb-1"&gt;Notas del cliente&lt;/h3&gt;
                    &lt;p className="text-yellow-700"&gt;{selectedInstallation.customer_notes}&lt;/p&gt;
                  &lt;/div&gt;
                )}

                {/* Edit Button at bottom */}
                &lt;button
                  onClick={() =&gt; handleOpenEditModal(selectedInstallation)}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors"
                &gt;
                  &lt;Edit3 className="w-5 h-5" /&gt;
                  Editar Instalación
                &lt;/button&gt;
              &lt;/div&gt;
            )}
          &lt;/div&gt;
        &lt;/div&gt;
      )}

      {/* Quick Lead Modal */}
      {isQuickLeadModalOpen &amp;&amp; (
        &lt;div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"&gt;
          &lt;div className="bg-white rounded-xl w-full max-w-md"&gt;
            &lt;div className="px-6 py-4 border-b flex items-center justify-between"&gt;
              &lt;div&gt;
                &lt;h3 className="text-lg font-semibold text-gray-900"&gt;Agregar Cliente Rápido&lt;/h3&gt;
                &lt;p className="text-sm text-gray-500"&gt;Solo datos básicos&lt;/p&gt;
              &lt;/div&gt;
              &lt;button
                onClick={handleCloseQuickLead}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              &gt;
                &lt;X className="w-5 h-5 text-gray-500" /&gt;
              &lt;/button&gt;
            &lt;/div&gt;

            &lt;form onSubmit={handleQuickLeadSubmit} className="p-6 space-y-4"&gt;
              {leadError &amp;&amp; (
                &lt;div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"&gt;
                  {leadError}
                &lt;/div&gt;
              )}

              &lt;div&gt;
                &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                  Nombre *
                &lt;/label&gt;
                &lt;input
                  type="text"
                  name="name"
                  value={quickLeadData.name}
                  onChange={handleQuickLeadChange}
                  placeholder="Nombre del cliente"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                  autoFocus
                /&gt;
              &lt;/div&gt;

              &lt;div&gt;
                &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                  Teléfono *
                &lt;/label&gt;
                &lt;input
                  type="tel"
                  name="phone"
                  value={quickLeadData.phone}
                  onChange={handleQuickLeadChange}
                  placeholder="3001234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                /&gt;
              &lt;/div&gt;

              &lt;div&gt;
                &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                  Ciudad
                &lt;/label&gt;
                &lt;select
                  name="city"
                  value={quickLeadData.city}
                  onChange={handleQuickLeadChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                &gt;
                  &lt;option value=""&gt;Seleccionar...&lt;/option&gt;
                  {CITIES.map((city) =&gt; (
                    &lt;option key={city.value} value={city.label}&gt;
                      {city.label}
                    &lt;/option&gt;
                  ))}
                &lt;/select&gt;
              &lt;/div&gt;

              &lt;div&gt;
                &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                  Dirección
                &lt;/label&gt;
                &lt;input
                  type="text"
                  name="address"
                  value={quickLeadData.address}
                  onChange={handleQuickLeadChange}
                  placeholder="Dirección de instalación"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                /&gt;
              &lt;/div&gt;

              &lt;div className="flex gap-3 pt-2"&gt;
                &lt;button
                  type="button"
                  onClick={handleCloseQuickLead}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                &gt;
                  Cancelar
                &lt;/button&gt;
                &lt;button
                  type="submit"
                  disabled={savingLead || !quickLeadData.name || !quickLeadData.phone}
                  className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                &gt;
                  {savingLead ? 'Guardando...' : 'Agregar'}
                &lt;/button&gt;
              &lt;/div&gt;
            &lt;/form&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      )}

      {/* Create/Edit Installation Modal */}
      &lt;Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={isEditMode ? 'Editar Instalación' : 'Nueva Instalacion'}
        subtitle={isEditMode ? 'Modifica los datos de la instalación' : 'Programa una instalacion de cerradura'}
        size="lg"
        footer={
          &lt;&gt;
            &lt;button
              onClick={handleCloseModal}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            &gt;
              Cancelar
            &lt;/button&gt;
            &lt;button
              onClick={handleSubmit}
              disabled={saving || !formData.lead_id || selectedProducts.length === 0 || !formData.address}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            &gt;
              {saving ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Crear Instalacion'}
            &lt;/button&gt;
          &lt;/&gt;
        }
      &gt;
        {loadingOptions ? (
          &lt;div className="flex items-center justify-center py-12"&gt;
            &lt;div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" /&gt;
          &lt;/div&gt;
        ) : (
          &lt;form onSubmit={handleSubmit} className="space-y-4"&gt;
            {error &amp;&amp; (
              &lt;div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"&gt;
                {error}
              &lt;/div&gt;
            )}

            {/* Lead Selection with Add Button */}
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                Cliente (Lead) *
              &lt;/label&gt;
              &lt;div className="flex gap-2"&gt;
                &lt;select
                  name="lead_id"
                  value={formData.lead_id}
                  onChange={handleInputChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none disabled:bg-gray-100"
                  required
                  disabled={isEditMode}
                &gt;
                  &lt;option value=""&gt;Seleccionar cliente...&lt;/option&gt;
                  {leads.map((lead) =&gt; (
                    &lt;option key={lead.id} value={lead.id}&gt;
                      {lead.name} - {lead.phone}
                    &lt;/option&gt;
                  ))}
                &lt;/select&gt;
                {!isEditMode &amp;&amp; (
                  &lt;button
                    type="button"
                    onClick={handleOpenQuickLead}
                    className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
                    title="Agregar cliente nuevo"
                  &gt;
                    &lt;UserPlus className="w-4 h-4" /&gt;
                  &lt;/button&gt;
                )}
              &lt;/div&gt;
              {isEditMode &amp;&amp; (
                &lt;p className="text-xs text-gray-500 mt-1"&gt;El cliente no se puede cambiar&lt;/p&gt;
              )}
            &lt;/div&gt;

            {/* Product Search and Selection */}
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                Productos *
              &lt;/label&gt;
              
              {/* Search Input */}
              &lt;div className="relative" ref={productSearchRef}&gt;
                &lt;div className="flex gap-2"&gt;
                  &lt;div className="flex-1 relative"&gt;
                    &lt;Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /&gt;
                    &lt;input
                      type="text"
                      value={productSearch}
                      onChange={(e) =&gt; {
                        setProductSearch(e.target.value);
                        setIsProductDropdownOpen(true);
                      }}
                      onFocus={() =&gt; setIsProductDropdownOpen(true)}
                      placeholder="Buscar producto por nombre o modelo..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    /&gt;
                  &lt;/div&gt;
                  &lt;input
                    type="number"
                    value={tempQuantity}
                    onChange={(e) =&gt; setTempQuantity(e.target.value)}
                    min="1"
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-center"
                    placeholder="Cant"
                  /&gt;
                &lt;/div&gt;

                {/* Dropdown */}
                {isProductDropdownOpen &amp;&amp; (
                  &lt;div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"&gt;
                    {filteredProducts.length === 0 ? (
                      &lt;div className="px-4 py-3 text-gray-500 text-sm"&gt;
                        No se encontraron productos
                      &lt;/div&gt;
                    ) : (
                      filteredProducts.map((product) =&gt; (
                        &lt;button
                          key={product.id}
                          type="button"
                          onClick={() =&gt; handleAddProduct(product)}
                          className="w-full px-4 py-3 text-left hover:bg-cyan-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0"
                        &gt;
                          {/* Product thumbnail in dropdown */}
                          &lt;div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"&gt;
                            {product.image_url ? (
                              &lt;img 
                                src={product.image_url} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              /&gt;
                            ) : (
                              &lt;Package className="w-5 h-5 text-gray-400" /&gt;
                            )}
                          &lt;/div&gt;
                          &lt;div className="flex-1 min-w-0"&gt;
                            &lt;p className="font-medium text-gray-900 truncate"&gt;{product.name}&lt;/p&gt;
                            {product.model &amp;&amp; (
                              &lt;p className="text-xs text-gray-500 truncate"&gt;{product.model}&lt;/p&gt;
                            )}
                          &lt;/div&gt;
                          &lt;span className="font-semibold text-cyan-600 flex-shrink-0"&gt;
                            ${product.price.toLocaleString()}
                          &lt;/span&gt;
                        &lt;/button&gt;
                      ))
                    )}
                  &lt;/div&gt;
                )}
              &lt;/div&gt;

              {/* Selected Products List */}
              {selectedProducts.length &gt; 0 &amp;&amp; (
                &lt;div className="mt-3 space-y-2"&gt;
                  {selectedProducts.map((item) =&gt; (
                    &lt;div
                      key={item.product_id}
                      className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200"
                    &gt;
                      {/* Product thumbnail - small (36px) - clickable */}
                      &lt;div 
                        className={`w-9 h-9 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center relative group ${item.product_image ? 'cursor-pointer hover:ring-2 hover:ring-cyan-400' : ''}`}
                        onClick={() =&gt; {
                          if (item.product_image) {
                            handleOpenImage(item.product_image, item.product_name);
                          }
                        }}
                      &gt;
                        {item.product_image ? (
                          &lt;&gt;
                            &lt;img 
                              src={item.product_image} 
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            /&gt;
                            &lt;div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center"&gt;
                              &lt;ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" /&gt;
                            &lt;/div&gt;
                          &lt;/&gt;
                        ) : (
                          &lt;Package className="w-4 h-4 text-gray-400" /&gt;
                        )}
                      &lt;/div&gt;
                      &lt;div className="flex-1 min-w-0"&gt;
                        &lt;p className="font-medium text-gray-900 text-sm truncate"&gt;{item.product_name}&lt;/p&gt;
                        &lt;p className="text-xs text-gray-500"&gt;
                          ${item.product_price.toLocaleString()} x {item.quantity} = ${(item.product_price * item.quantity).toLocaleString()}
                        &lt;/p&gt;
                      &lt;/div&gt;
                      &lt;div className="flex items-center gap-2 flex-shrink-0"&gt;
                        &lt;input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =&gt; handleUpdateProductQuantity(item.product_id, parseInt(e.target.value) || 1)}
                          min="1"
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                        /&gt;
                        &lt;button
                          type="button"
                          onClick={() =&gt; handleRemoveProduct(item.product_id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        &gt;
                          &lt;Trash2 className="w-4 h-4" /&gt;
                        &lt;/button&gt;
                      &lt;/div&gt;
                    &lt;/div&gt;
                  ))}
                &lt;/div&gt;
              )}

              {selectedProducts.length === 0 &amp;&amp; (
                &lt;p className="text-xs text-gray-500 mt-2"&gt;
                  Busca y selecciona uno o más productos
                &lt;/p&gt;
              )}
            &lt;/div&gt;

            {/* Technician Selection */}
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                Tecnico Asignado
              &lt;/label&gt;
              &lt;select
                name="technician_id"
                value={formData.technician_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              &gt;
                &lt;option value=""&gt;Sin asignar (programar despues)&lt;/option&gt;
                {technicians.map((tech) =&gt; (
                  &lt;option key={tech.id} value={tech.id}&gt;
                    {tech.full_name} - {tech.zone || 'Sin zona'}
                  &lt;/option&gt;
                ))}
              &lt;/select&gt;
            &lt;/div&gt;

            {/* Schedule */}
            &lt;div className="grid grid-cols-2 gap-4"&gt;
              &lt;div&gt;
                &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                  Fecha Programada
                &lt;/label&gt;
                &lt;input
                  type="date"
                  name="scheduled_date"
                  value={formData.scheduled_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                /&gt;
              &lt;/div&gt;

              &lt;div&gt;
                &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                  Hora
                &lt;/label&gt;
                &lt;input
                  type="time"
                  name="scheduled_time"
                  value={formData.scheduled_time}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                /&gt;
              &lt;/div&gt;
            &lt;/div&gt;

            {/* Address */}
            &lt;div className="grid grid-cols-3 gap-4"&gt;
              &lt;div className="col-span-2"&gt;
                &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                  Direccion *
                &lt;/label&gt;
                &lt;input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Ej: Calle 123 #45-67, Apto 101"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  required
                /&gt;
              &lt;/div&gt;

              &lt;div&gt;
                &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                  Ciudad
                &lt;/label&gt;
                &lt;select
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                &gt;
                  &lt;option value=""&gt;Seleccionar...&lt;/option&gt;
                  {CITIES.map((city) =&gt; (
                    &lt;option key={city.value} value={city.label}&gt;
                      {city.label}
                    &lt;/option&gt;
                  ))}
                &lt;/select&gt;
              &lt;/div&gt;
            &lt;/div&gt;

            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                Indicaciones de Acceso
              &lt;/label&gt;
              &lt;input
                type="text"
                name="address_notes"
                value={formData.address_notes}
                onChange={handleInputChange}
                placeholder="Ej: Timbre 101, porteria 24h, llamar al llegar"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              /&gt;
            &lt;/div&gt;

            {/* Installation Price Selection */}
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                Precio de Instalación *
              &lt;/label&gt;
              &lt;select
                name="installation_price"
                value={formData.installation_price}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
              &gt;
                {INSTALLATION_PRICES.map((price) =&gt; (
                  &lt;option key={price.value} value={price.value}&gt;
                    {price.label}
                  &lt;/option&gt;
                ))}
              &lt;/select&gt;
            &lt;/div&gt;

            {/* Price Adjustment Section (Discount or Surcharge) */}
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                Ajuste de Precio
              &lt;/label&gt;
              &lt;div className="flex gap-2"&gt;
                &lt;select
                  name="price_adjustment_type"
                  value={formData.price_adjustment_type}
                  onChange={handleInputChange}
                  className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                &gt;
                  &lt;option value="none"&gt;Sin ajuste&lt;/option&gt;
                  &lt;optgroup label="⬇️ Descuento"&gt;
                    &lt;option value="discount_percentage"&gt;Descuento % (porcentaje)&lt;/option&gt;
                    &lt;option value="discount_value"&gt;Descuento $ (valor fijo)&lt;/option&gt;
                  &lt;/optgroup&gt;
                  &lt;optgroup label="⬆️ Aumento"&gt;
                    &lt;option value="surcharge_percentage"&gt;Aumento % (porcentaje)&lt;/option&gt;
                    &lt;option value="surcharge_value"&gt;Aumento $ (valor fijo)&lt;/option&gt;
                  &lt;/optgroup&gt;
                &lt;/select&gt;
                
                {formData.price_adjustment_type !== 'none' &amp;&amp; (
                  &lt;div className="flex-1 relative"&gt;
                    &lt;div className="absolute left-3 top-1/2 -translate-y-1/2"&gt;
                      {isPercentageAdjustment ? (
                        &lt;Percent className="w-4 h-4 text-gray-400" /&gt;
                      ) : (
                        &lt;DollarSign className="w-4 h-4 text-gray-400" /&gt;
                      )}
                    &lt;/div&gt;
                    &lt;input
                      type="number"
                      name="price_adjustment_value"
                      value={formData.price_adjustment_value}
                      onChange={handleInputChange}
                      placeholder={isPercentageAdjustment ? 'Ej: 10' : 'Ej: 50000'}
                      min="0"
                      max={isPercentageAdjustment ? '100' : undefined}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                    /&gt;
                  &lt;/div&gt;
                )}
              &lt;/div&gt;
              &lt;p className="text-xs text-gray-500 mt-1"&gt;
                Usa descuento para rebajar el precio o aumento para cobrar más a este cliente
              &lt;/p&gt;
            &lt;/div&gt;

            {/* Price Breakdown */}
            {priceBreakdown &amp;&amp; priceBreakdown.subtotal &gt; 0 &amp;&amp; (
              &lt;div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4"&gt;
                &lt;h4 className="text-sm font-semibold text-cyan-800 mb-3"&gt;Resumen de Precio&lt;/h4&gt;
                &lt;div className="space-y-2 text-sm"&gt;
                  {selectedProducts.map((item) =&gt; (
                    &lt;div key={item.product_id} className="flex items-center gap-3"&gt;
                      {/* Product thumbnail - larger (48px) - clickable */}
                      &lt;div 
                        className={`w-12 h-12 bg-white rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center border border-cyan-200 relative group ${item.product_image ? 'cursor-pointer hover:ring-2 hover:ring-cyan-400' : ''}`}
                        onClick={() =&gt; {
                          if (item.product_image) {
                            handleOpenImage(item.product_image, item.product_name);
                          }
                        }}
                      &gt;
                        {item.product_image ? (
                          &lt;&gt;
                            &lt;img 
                              src={item.product_image} 
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            /&gt;
                            &lt;div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center"&gt;
                              &lt;ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" /&gt;
                            &lt;/div&gt;
                          &lt;/&gt;
                        ) : (
                          &lt;Package className="w-6 h-6 text-cyan-400" /&gt;
                        )}
                      &lt;/div&gt;
                      &lt;div className="flex-1 min-w-0"&gt;
                        &lt;span className="text-gray-700 block truncate"&gt;
                          {item.product_name} x {item.quantity}
                        &lt;/span&gt;
                      &lt;/div&gt;
                      &lt;span className="font-medium flex-shrink-0"&gt;
                        ${(item.product_price * item.quantity).toLocaleString()}
                      &lt;/span&gt;
                    &lt;/div&gt;
                  ))}
                  &lt;div className="flex justify-between pt-2 border-t border-cyan-200"&gt;
                    &lt;span className="text-gray-600"&gt;Instalación&lt;/span&gt;
                    &lt;span className="font-medium"&gt;
                      ${parseInt(formData.installation_price).toLocaleString()}
                    &lt;/span&gt;
                  &lt;/div&gt;
                  
                  {/* Subtotal and adjustment */}
                  {priceBreakdown.adjustment &gt; 0 &amp;&amp; (
                    &lt;&gt;
                      &lt;div className="flex justify-between pt-2 border-t border-cyan-200"&gt;
                        &lt;span className="text-gray-600"&gt;Subtotal&lt;/span&gt;
                        &lt;span className="font-medium"&gt;
                          ${priceBreakdown.subtotal.toLocaleString()}
                        &lt;/span&gt;
                      &lt;/div&gt;
                      &lt;div className={`flex justify-between items-center ${priceBreakdown.isDiscount ? 'text-red-600' : 'text-green-600'}`}&gt;
                        &lt;span className="flex items-center gap-1"&gt;
                          {priceBreakdown.isDiscount ? (
                            &lt;TrendingDown className="w-4 h-4" /&gt;
                          ) : (
                            &lt;TrendingUp className="w-4 h-4" /&gt;
                          )}
                          {priceBreakdown.isDiscount ? 'Descuento' : 'Aumento'}
                          {isPercentageAdjustment &amp;&amp; ` (${formData.price_adjustment_value}%)`}
                        &lt;/span&gt;
                        &lt;span className="font-medium"&gt;
                          {priceBreakdown.isDiscount ? '-' : '+'}${priceBreakdown.adjustment.toLocaleString()}
                        &lt;/span&gt;
                      &lt;/div&gt;
                    &lt;/&gt;
                  )}
                  
                  &lt;div className="flex justify-between pt-3 border-t border-cyan-200"&gt;
                    &lt;span className="font-bold text-cyan-900 text-base"&gt;TOTAL A COBRAR&lt;/span&gt;
                    &lt;span className="font-bold text-cyan-700 text-xl"&gt;
                      ${priceBreakdown.total.toLocaleString()}
                    &lt;/span&gt;
                  &lt;/div&gt;
                &lt;/div&gt;
              &lt;/div&gt;
            )}

            {/* Notes */}
            &lt;div&gt;
              &lt;label className="block text-sm font-medium text-gray-700 mb-1"&gt;
                Notas del Cliente
              &lt;/label&gt;
              &lt;textarea
                name="customer_notes"
                value={formData.customer_notes}
                onChange={handleInputChange}
                rows={2}
                placeholder="Instrucciones especiales, tipo de puerta, etc..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
              /&gt;
            &lt;/div&gt;
          &lt;/form&gt;
        )}
      &lt;/Modal&gt;
    &lt;/div&gt;
  );
}
