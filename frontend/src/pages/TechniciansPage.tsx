import { useState, useEffect } from 'react';
import { Plus, Wrench, Phone, Mail, MapPin, Star, Calendar, Edit2 } from 'lucide-react';
import { techniciansApi } from '../services/api';
import type { Technician } from '../types';
import Modal from '../components/common/Modal';

interface TechnicianFormData {
  full_name: string;
  phone: string;
  email: string;
  document_id: string;
  zone: string;
  specialties: string;
  is_active: boolean;
}

const initialFormData: TechnicianFormData = {
  full_name: '',
  phone: '',
  email: '',
  document_id: '',
  zone: '',
  specialties: '',
  is_active: true,
};

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<TechnicianFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTechnicians = async () => {
    try {
      const data = await techniciansApi.getAll();
      setTechnicians(data);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const handleOpenModal = () => {
    setFormData(initialFormData);
    setError(null);
    setIsEditMode(false);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleEditTechnician = (tech: Technician) => {
    setFormData({
      full_name: tech.full_name,
      phone: tech.phone,
      email: tech.email || '',
      document_id: tech.document_id || '',
      zone: tech.zone || '',
      specialties: tech.specialties || '',
      is_active: tech.is_active,
    });
    setEditingId(tech.id);
    setIsEditMode(true);
    setError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormData);
    setError(null);
    setIsEditMode(false);
    setEditingId(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleToggleActive = () => {
    setFormData((prev) => ({ ...prev, is_active: !prev.is_active }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const technicianData = {
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email || undefined,
        document_id: formData.document_id || undefined,
        zone: formData.zone || undefined,
        specialties: formData.specialties || undefined,
        is_active: formData.is_active,
      };

      if (isEditMode && editingId) {
        await techniciansApi.update(editingId, technicianData);
      } else {
        await techniciansApi.create(technicianData);
      }
      handleCloseModal();
      fetchTechnicians();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Error al guardar el tecnico');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tecnicos</h1>
          <p className="text-gray-500">Gestiona tu equipo de instaladores</p>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Tecnico
        </button>
      </div>

      {/* Technicians Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : technicians.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Wrench className="w-12 h-12 mb-3 text-gray-300" />
          <p>No hay tecnicos registrados</p>
          <button
            onClick={handleOpenModal}
            className="mt-4 text-cyan-600 hover:underline"
          >
            Agregar primer tecnico
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {technicians.map((tech) => (
            <div
              key={tech.id}
              onClick={() => handleEditTechnician(tech)}
              className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl font-bold">
                    {tech.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{tech.full_name}</h3>
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded mt-1 ${
                      tech.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {tech.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <Edit2 className="w-4 h-4 text-gray-400" />
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{tech.phone}</span>
                </div>

                {tech.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="truncate">{tech.email}</span>
                  </div>
                )}

                {tech.zone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span>{tech.zone}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-medium text-gray-700">4.8</span>
                  <span className="text-xs text-gray-500">(32 instalaciones)</span>
                </div>
                <span className="text-sm text-cyan-600 flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Click para editar
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Technician Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={isEditMode ? 'Editar Tecnico' : 'Nuevo Tecnico'}
        subtitle={isEditMode ? 'Modifica los datos del instalador' : 'Agrega un instalador al equipo'}
        size="md"
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
              disabled={saving || !formData.full_name || !formData.phone}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : isEditMode ? 'Guardar Cambios' : 'Crear Tecnico'}
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

          {/* Active Toggle - Only show in edit mode */}
          {isEditMode && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Estado del Tecnico</p>
                <p className="text-sm text-gray-500">
                  {formData.is_active ? 'Puede recibir instalaciones' : 'No recibe instalaciones'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleActive}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.is_active ? 'bg-cyan-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre Completo *
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              placeholder="Ej: Carlos Martinez"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefono WhatsApp *
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Ej: +573001234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
              required
            />
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
              placeholder="tecnico@ejemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cedula / Documento
            </label>
            <input
              type="text"
              name="document_id"
              value={formData.document_id}
              onChange={handleInputChange}
              placeholder="Ej: 1234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zona de Cobertura
            </label>
            <input
              type="text"
              name="zone"
              value={formData.zone}
              onChange={handleInputChange}
              placeholder="Ej: Bogota Norte, Chapinero"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Especialidades
            </label>
            <textarea
              name="specialties"
              value={formData.specialties}
              onChange={handleInputChange}
              rows={2}
              placeholder="Cerraduras biometricas, cerraduras WiFi, puertas de madera..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none resize-none"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
