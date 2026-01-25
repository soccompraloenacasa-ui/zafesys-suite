import { useEffect, useState } from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Calendar,
  User,
  Mic,
  Edit3,
  Trash2,
  Save,
  Percent,
  DollarSign,
  Wrench,
} from 'lucide-react';
import { leadsApi, productsApi } from '../../services/api';
import { CITIES } from '../../constants/cities';
import type { Lead, LeadStatus, Product } from '../../types';

interface LeadDetailModalProps {
  leadId: number;
  onClose: () => void;
  onStatusChange?: (id: number, status: LeadStatus) => void;
  onLeadDeleted?: (id: number) => void;
  onLeadUpdated?: () => void;
}

const statusLabels: Record<LeadStatus, { label: string; color: string }> = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-700' },
  en_conversacion: { label: 'En conversación', color: 'bg-yellow-100 text-yellow-700' },
  potencial: { label: 'Potencial', color: 'bg-purple-100 text-purple-700' },
  venta_cerrada: { label: 'Venta cerrada', color: 'bg-green-100 text-green-700' },
  perdido: { label: 'Perdido', color: 'bg-red-100 text-red-700' },
};

const sourceLabels: Record<string, string> = {
  website: 'Sitio Web',
  whatsapp: 'WhatsApp',
  elevenlabs: 'ElevenLabs',
  ana_voice: 'Ana (Voz)',
  referido: 'Referido',
  otro: 'Otro',
};

// Opciones de precio de instalación
const INSTALLATION_PRICES = [
  { value: '', label: 'Sin definir' },
  { value: '189000', label: '$189,000 - Instalación estándar' },
  { value: '250000', label: '$250,000 - Instalación + desplazamiento' },
];

type DiscountType = 'none' | 'percentage' | 'value';

interface EditFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  product_interest: string;
  installation_price: string;
  discount_type: DiscountType;
  discount_value: string;
  notes: string;
}

export default function LeadDetailModal({ 
  leadId, 
  onClose, 
  onStatusChange,
  onLeadDeleted,
  onLeadUpdated,
}: LeadDetailModalProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    product_interest: '',
    installation_price: '',
    discount_type: 'none',
    discount_value: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [leadData, productsData] = await Promise.all([
          leadsApi.getById(leadId),
          productsApi.getAll(),
        ]);
        setLead(leadData);
        setProducts(productsData);
        
        // Initialize edit form with lead data
        setEditForm({
          name: leadData.name || '',
          phone: leadData.phone || '',
          email: leadData.email || '',
          address: leadData.address || '',
          city: leadData.city || '',
          product_interest: leadData.product_interest || '',
          installation_price: '',
          discount_type: 'none',
          discount_value: '',
          notes: leadData.notes || '',
        });
      } catch (error) {
        console.error('Error fetching lead:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [leadId]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return;
    try {
      await leadsApi.updateStatus(lead.id, newStatus);
      setLead({ ...lead, status: newStatus });
      onStatusChange?.(lead.id, newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleEditInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    // Reset discount value when changing type
    if (name === 'discount_type') {
      setEditForm((prev) => ({
        ...prev,
        discount_type: value as DiscountType,
        discount_value: '',
      }));
      return;
    }
    
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    if (!lead) return;
    setSaving(true);
    
    try {
      // Build notes with installation and discount info
      let enrichedNotes = editForm.notes || '';
      
      // Add installation price to notes if set
      if (editForm.installation_price) {
        const priceLabel = INSTALLATION_PRICES.find(p => p.value === editForm.installation_price)?.label || '';
        enrichedNotes = `[Instalación: ${priceLabel}]\n${enrichedNotes}`;
      }
      
      // Add discount to notes if set
      if (editForm.discount_type !== 'none' && editForm.discount_value) {
        const discountLabel = editForm.discount_type === 'percentage' 
          ? `${editForm.discount_value}%`
          : `$${parseInt(editForm.discount_value).toLocaleString()}`;
        enrichedNotes = `[Descuento acordado: ${discountLabel}]\n${enrichedNotes}`;
      }
      
      const updateData = {
        name: editForm.name,
        phone: editForm.phone,
        email: editForm.email || undefined,
        address: editForm.address || undefined,
        city: editForm.city || undefined,
        product_interest: editForm.product_interest || undefined,
        notes: enrichedNotes || undefined,
      };
      
      const updatedLead = await leadsApi.update(lead.id, updateData);
      setLead(updatedLead);
      setIsEditMode(false);
      onLeadUpdated?.();
    } catch (error) {
      console.error('Error updating lead:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lead) return;
    setDeleting(true);
    
    try {
      await leadsApi.delete(lead.id);
      onLeadDeleted?.(lead.id);
      onClose();
    } catch (error) {
      console.error('Error deleting lead:', error);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditMode ? 'Editar Lead' : lead.name}
            </h2>
            <p className="text-sm text-gray-500">Lead #{lead.id}</p>
          </div>
          <div className="flex items-center gap-2">
            {!isEditMode && (
              <>
                <button
                  onClick={() => setIsEditMode(true)}
                  className="p-2 hover:bg-cyan-100 text-cyan-600 rounded-lg transition-colors"
                  title="Editar lead"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                  title="Eliminar lead"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isEditMode ? (
            /* Edit Mode */
            <div className="space-y-4">
              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-cyan-700">
                  💡 Enriquece este lead con la información del cliente para crear instalaciones más rápido
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditInputChange}
                    placeholder="Nombre real del cliente"
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
                    value={editForm.phone}
                    onChange={handleEditInputChange}
                    placeholder="+57 300 123 4567"
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
                  value={editForm.email}
                  onChange={handleEditInputChange}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ciudad
                  </label>
                  <select
                    name="city"
                    value={editForm.city}
                    onChange={handleEditInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  >
                    <option value="">Seleccionar ciudad...</option>
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
                    value={editForm.address}
                    onChange={handleEditInputChange}
                    placeholder="Calle 123 # 45-67, Apto 101"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>

              {/* Producto de interés */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Package className="w-4 h-4 inline mr-1" />
                  Cerradura que quiere
                </label>
                <select
                  name="product_interest"
                  value={editForm.product_interest}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.model}>
                      {product.name} - ${product.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tipo de instalación */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Wrench className="w-4 h-4 inline mr-1" />
                  Tipo de Instalación
                </label>
                <select
                  name="installation_price"
                  value={editForm.installation_price}
                  onChange={handleEditInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                >
                  {INSTALLATION_PRICES.map((price) => (
                    <option key={price.value} value={price.value}>
                      {price.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Descuento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Percent className="w-4 h-4 inline mr-1" />
                  Descuento acordado
                </label>
                <div className="flex gap-2">
                  <select
                    name="discount_type"
                    value={editForm.discount_type}
                    onChange={handleEditInputChange}
                    className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                  >
                    <option value="none">Sin descuento</option>
                    <option value="percentage">Porcentaje (%)</option>
                    <option value="value">Valor fijo ($)</option>
                  </select>
                  
                  {editForm.discount_type !== 'none' && (
                    <div className="flex-1 relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        {editForm.discount_type === 'percentage' ? (
                          <Percent className="w-4 h-4 text-gray-400" />
                        ) : (
                          <DollarSign className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                      <input
                        type="number"
                        name="discount_value"
                        value={editForm.discount_value}
                        onChange={handleEditInputChange}
                        placeholder={editForm.discount_type === 'percentage' ? 'Ej: 10' : 'Ej: 50000'}
                        min="0"
                        max={editForm.discount_type === 'percentage' ? '100' : undefined}
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas adicionales
                </label>
                <textarea
                  name="notes"
                  value={editForm.notes}
                  onChange={handleEditInputChange}
                  rows={3}
                  placeholder="Información adicional del cliente..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
                />
              </div>
            </div>
          ) : (
            /* View Mode */
            <>
              {/* Status */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(statusLabels) as LeadStatus[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        lead.status === status
                          ? statusLabels[status].color
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {statusLabels[status].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contact info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Teléfono</p>
                    <a href={`tel:${lead.phone}`} className="text-sm font-medium text-cyan-600 hover:underline">
                      {lead.phone}
                    </a>
                  </div>
                </div>

                {lead.email && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <a href={`mailto:${lead.email}`} className="text-sm font-medium text-cyan-600 hover:underline">
                        {lead.email}
                      </a>
                    </div>
                  </div>
                )}

                {lead.address && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Dirección</p>
                      <p className="text-sm font-medium">{lead.address}</p>
                      {lead.city && <p className="text-xs text-gray-500">{lead.city}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Product interest */}
              {lead.product_interest && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Producto de interés</span>
                  </div>
                  <span className="inline-block bg-cyan-50 text-cyan-700 px-3 py-1 rounded-lg text-sm">
                    {lead.product_interest}
                  </span>
                </div>
              )}

              {/* Source & dates */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Origen</span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                    (lead.source === 'elevenlabs' || lead.source === 'ana_voice') ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {(lead.source === 'elevenlabs' || lead.source === 'ana_voice') && <Mic className="w-3 h-3" />}
                    {sourceLabels[lead.source] || lead.source}
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Creado</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {new Date(lead.created_at).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {lead.notes && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Notas</span>
                  </div>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                    {lead.notes}
                  </p>
                </div>
              )}

              {/* Conversation transcript */}
              {lead.conversation_transcript && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-medium text-gray-700">Transcripción de Ana</span>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {lead.conversation_transcript}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          {isEditMode ? (
            <>
              <button
                onClick={() => setIsEditMode(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editForm.name || !editForm.phone}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </>
          ) : (
            <>
              <a
                href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                WhatsApp
              </a>

              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Eliminar Lead</h3>
                <p className="text-sm text-gray-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres eliminar a <strong>{lead.name}</strong>? 
              Se perderá toda la información asociada a este lead.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
