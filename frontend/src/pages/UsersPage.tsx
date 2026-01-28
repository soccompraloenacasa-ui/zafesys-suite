import { useState, useEffect } from 'react';
import { Plus, Users, Phone, Mail, Shield, Edit2, Eye, EyeOff, Trash2 } from 'lucide-react';
import { usersApi } from '../services/api';
import Modal from '../components/common/Modal';

interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: string;
  is_active: boolean;
}

interface UserFormData {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
}

const initialFormData: UserFormData = {
  email: '',
  password: '',
  full_name: '',
  phone: '',
  role: 'sales',
  is_active: true,
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  sales: 'Ventas',
  technician: 'Tecnico',
  warehouse: 'Bodega',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  sales: 'bg-blue-100 text-blue-700',
  technician: 'bg-green-100 text-green-700',
  warehouse: 'bg-orange-100 text-orange-700',
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await usersApi.getAll(filterRole || undefined);
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [filterRole]);

  const handleOpenModal = () => {
    setFormData(initialFormData);
    setError(null);
    setIsEditMode(false);
    setEditingId(null);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setFormData({
      email: user.email,
      password: '',
      full_name: user.full_name,
      phone: user.phone || '',
      role: user.role,
      is_active: user.is_active,
    });
    setEditingId(user.id);
    setIsEditMode(true);
    setError(null);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(initialFormData);
    setError(null);
    setIsEditMode(false);
    setEditingId(null);
    setShowPassword(false);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (isEditMode && editingId) {
        const updateData: Partial<UserFormData> = {
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone || undefined,
          role: formData.role,
          is_active: formData.is_active,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await usersApi.update(editingId, updateData);
      } else {
        if (!formData.password) {
          setError('La contrasena es requerida');
          setSaving(false);
          return;
        }
        await usersApi.create(formData);
      }
      handleCloseModal();
      fetchUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Error al guardar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Desactivar usuario "${user.full_name}"?`)) return;

    try {
      await usersApi.delete(user.id);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500 rounded-lg">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
            <p className="text-gray-500">Gestiona los usuarios del sistema</p>
          </div>
        </div>
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="sales">Ventas</option>
          <option value="technician">Tecnico</option>
          <option value="warehouse">Bodega</option>
        </select>
      </div>

      {/* Users Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <div
              key={user.id}
              className={`bg-white rounded-xl p-6 shadow-sm border border-gray-100 ${
                !user.is_active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{user.full_name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-700'}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditUser(user)}
                    className="p-2 text-gray-400 hover:text-purple-500 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {user.is_active && (
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {user.email}
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {user.phone}
                  </div>
                )}
              </div>

              {!user.is_active && (
                <div className="mt-3 text-xs text-red-500 font-medium">
                  Usuario desactivado
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={isEditMode ? 'Editar Usuario' : 'Nuevo Usuario'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo *
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contrasena {isEditMode ? '(dejar vacio para no cambiar)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required={!isEditMode}
                className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefono
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol *
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="admin">Administrador</option>
              <option value="sales">Ventas</option>
              <option value="technician">Tecnico</option>
              <option value="warehouse">Bodega</option>
            </select>
          </div>

          {isEditMode && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="is_active"
                id="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="w-4 h-4 text-purple-500 border-gray-300 rounded focus:ring-purple-500"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">
                Usuario activo
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : isEditMode ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
