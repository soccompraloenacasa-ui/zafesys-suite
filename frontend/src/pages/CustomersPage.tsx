import { useState, useEffect } from 'react';
import { Plus, Users, Search, Phone, Mail, MapPin, Package, Calendar, Wrench, CheckCircle } from 'lucide-react';
import { installationsApi, leadsApi } from '../services/api';
import type { Installation, Lead } from '../types';

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
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithInstallation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Leads con instalaciones agendadas o completadas</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm">
          <CheckCircle className="w-4 h-4" />
          Auto-sincronizado
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

      {/* Info Banner */}
      <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-cyan-700">
          <strong>Clientes automáticos:</strong> Cuando creas una instalación en la pestaña <strong>Instalaciones</strong>, el lead aparece aquí automáticamente con el estado actual de su instalación.
        </p>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Users className="w-12 h-12 mb-3 text-gray-300" />
          <p>No hay clientes {filterStatus !== 'all' ? `con estado "${installationStatusLabels[filterStatus]?.label || filterStatus}"` : ''}</p>
          <p className="text-sm text-gray-400 mt-2">
            Crea instalaciones para ver clientes aquí
          </p>
        </div>
      ) : (
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
