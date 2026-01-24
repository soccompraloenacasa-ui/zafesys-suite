import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { Plus, RefreshCw } from 'lucide-react';
import KanbanColumn from '../components/leads/KanbanColumn';
import LeadCard from '../components/leads/LeadCard';
import LeadDetailModal from '../components/leads/LeadDetailModal';
import Modal from '../components/common/Modal';
import { leadsApi, productsApi } from '../services/api';
import type { KanbanData, LeadKanban, LeadStatus, LeadSource, Product } from '../types';

const columns: { id: LeadStatus; title: string; color: string }[] = [
  { id: 'nuevo', title: 'Nuevo', color: 'bg-blue-500' },
  { id: 'en_conversacion', title: 'En conversación', color: 'bg-yellow-500' },
  { id: 'potencial', title: 'Potencial', color: 'bg-purple-500' },
  { id: 'venta_cerrada', title: 'Venta cerrada', color: 'bg-green-500' },
  { id: 'perdido', title: 'Perdido', color: 'bg-red-500' },
];

const sourceOptions: { value: LeadSource; label: string }[] = [
  { value: 'website', label: 'Sitio Web' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'ana_voice', label: 'Ana (Voz)' },
  { value: 'referido', label: 'Referido' },
  { value: 'otro', label: 'Otro' },
];

interface LeadFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  source: LeadSource;
  product_interest: string;
  notes: string;
}

const initialFormData: LeadFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  source: 'whatsapp',
  product_interest: '',
  notes: '',
};

export default function LeadsPage() {
  const [kanbanData, setKanbanData] = useState<KanbanData>({
    nuevo: [],
    en_conversacion: [],
    potencial: [],
    venta_cerrada: [],
    perdido: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<LeadFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchKanban = async () => {
    try {
      setLoading(true);
      const data = await leadsApi.getKanban();
      setKanbanData(data);
    } catch (error) {
      console.error('Error fetching kanban:', error);
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
    fetchKanban();
    fetchProducts();
  }, []);

  const findLead = (id: number): LeadKanban | undefined => {
    for (const status of Object.keys(kanbanData) as LeadStatus[]) {
      const lead = kanbanData[status].find((l) => l.id === id);
      if (lead) return lead;
    }
    return undefined;
  };

  const findColumn = (id: number): LeadStatus | undefined => {
    for (const status of Object.keys(kanbanData) as LeadStatus[]) {
      if (kanbanData[status].some((l) => l.id === id)) {
        return status;
      }
    }
    return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id;

    const activeColumn = findColumn(activeId);
    let overColumn: LeadStatus | undefined;

    // Check if dropping over a column directly
    if (columns.some((c) => c.id === overId)) {
      overColumn = overId as LeadStatus;
    } else {
      // Dropping over another card
      overColumn = findColumn(overId as number);
    }

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    // Move lead to new column
    setKanbanData((prev) => {
      const lead = prev[activeColumn].find((l) => l.id === activeId);
      if (!lead) return prev;

      return {
        ...prev,
        [activeColumn]: prev[activeColumn].filter((l) => l.id !== activeId),
        [overColumn]: [...prev[overColumn], { ...lead, status: overColumn }],
      };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id;

    // Determine the target column
    let targetColumn: LeadStatus | undefined;

    if (columns.some((c) => c.id === overId)) {
      targetColumn = overId as LeadStatus;
    } else {
      targetColumn = findColumn(overId as number);
    }

    if (!targetColumn) return;

    // Update in backend
    try {
      await leadsApi.updateStatus(activeId, targetColumn);
    } catch (error) {
      console.error('Error updating lead status:', error);
      // Revert on error
      fetchKanban();
    }
  };

  const activeLead = activeId ? findLead(activeId) : null;

  const handleLeadClick = (lead: LeadKanban) => {
    setSelectedLeadId(lead.id);
  };

  const handleModalClose = () => {
    setSelectedLeadId(null);
  };

  const handleStatusChange = (id: number, newStatus: LeadStatus) => {
    setKanbanData((prev) => {
      // Find and remove lead from current column
      let lead: LeadKanban | undefined;
      const newData = { ...prev };

      for (const status of Object.keys(newData) as LeadStatus[]) {
        const index = newData[status].findIndex((l) => l.id === id);
        if (index !== -1) {
          lead = { ...newData[status][index], status: newStatus };
          newData[status] = newData[status].filter((l) => l.id !== id);
          break;
        }
      }

      if (lead) {
        newData[newStatus] = [...newData[newStatus], lead];
      }

      return newData;
    });
  };

  const handleOpenCreateModal = () => {
    setFormData(initialFormData);
    setError(null);
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    setFormData(initialFormData);
    setError(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const leadData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        address: formData.address || undefined,
        city: formData.city || undefined,
        source: formData.source,
        product_interest: formData.product_interest || undefined,
        notes: formData.notes || undefined,
        status: 'nuevo' as LeadStatus,
      };

      await leadsApi.create(leadData);
      handleCloseCreateModal();
      fetchKanban();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Error al crear el lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-sm text-gray-500">Gestiona tus prospectos con el tablero Kanban</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchKanban}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
          <button 
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Lead
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        {loading && kanbanData.nuevo.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full">
              {columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  id={column.id}
                  title={column.title}
                  color={column.color}
                  leads={kanbanData[column.id]}
                  onLeadClick={handleLeadClick}
                />
              ))}
            </div>

            <DragOverlay>
              {activeLead ? (
                <div className="kanban-card dragging opacity-90">
                  <LeadCard lead={activeLead} onClick={() => {}} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLeadId && (
        <LeadDetailModal
          leadId={selectedLeadId}
          onClose={handleModalClose}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Create Lead Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={handleCloseCreateModal}
        title="Nuevo Lead"
        subtitle="Agrega un prospecto manualmente"
        size="lg"
        footer={
          <>
            <button
              onClick={handleCloseCreateModal}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateLead}
              disabled={saving || !formData.name || !formData.phone}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Crear Lead'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

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
                placeholder="Nombre del cliente"
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
                placeholder="+57 300 123 4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
                required
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
                placeholder="correo@ejemplo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fuente
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Producto de interés
            </label>
            <select
              name="product_interest"
              value={formData.product_interest}
              onChange={handleInputChange}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ciudad
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                placeholder="Bogotá, Medellín..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="Calle 123 # 45-67"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              />
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
              rows={3}
              placeholder="Información adicional sobre el prospecto..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
