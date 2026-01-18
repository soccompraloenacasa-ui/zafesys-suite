import { useState, useEffect } from 'react';
import { Users, Package, Calendar, Wrench, TrendingUp } from 'lucide-react';
import { leadsApi, installationsApi } from '../services/api';

interface Stats {
  leads: Record<string, number>;
  installations: {
    by_status: Record<string, number>;
    today_count: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [leadStats, installationStats] = await Promise.all([
          leadsApi.getStats(),
          installationsApi.getAll().then(() => ({ by_status: {}, today_count: 0 })).catch(() => ({ by_status: {}, today_count: 0 })),
        ]);
        setStats({
          leads: leadStats,
          installations: installationStats,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const totalLeads = stats ? Object.values(stats.leads).reduce((a, b) => a + b, 0) : 0;
  const newLeads = stats?.leads.nuevo || 0;
  const closedLeads = stats?.leads.venta_cerrada || 0;

  const cards = [
    {
      title: 'Total Leads',
      value: totalLeads,
      icon: Users,
      color: 'bg-blue-500',
      change: '+12%',
    },
    {
      title: 'Leads Nuevos',
      value: newLeads,
      icon: TrendingUp,
      color: 'bg-cyan-500',
      change: '+5',
    },
    {
      title: 'Ventas Cerradas',
      value: closedLeads,
      icon: Package,
      color: 'bg-green-500',
      change: '+3',
    },
    {
      title: 'Instalaciones Hoy',
      value: stats?.installations.today_count || 0,
      icon: Calendar,
      color: 'bg-purple-500',
      change: '2 pendientes',
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Resumen de tu operación</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm text-green-600 font-medium">{card.change}</span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-1">
              {loading ? '...' : card.value}
            </h3>
            <p className="text-sm text-gray-500">{card.title}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Pipeline */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline de Leads</h2>
          <div className="space-y-4">
            {[
              { label: 'Nuevo', count: stats?.leads.nuevo || 0, color: 'bg-blue-500' },
              { label: 'En conversación', count: stats?.leads.en_conversacion || 0, color: 'bg-yellow-500' },
              { label: 'Potencial', count: stats?.leads.potencial || 0, color: 'bg-purple-500' },
              { label: 'Venta cerrada', count: stats?.leads.venta_cerrada || 0, color: 'bg-green-500' },
              { label: 'Perdido', count: stats?.leads.perdido || 0, color: 'bg-red-500' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="flex-1 text-sm text-gray-600">{item.label}</span>
                <span className="font-semibold text-gray-900">{loading ? '...' : item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h2>
          <div className="grid grid-cols-2 gap-3">
            <a
              href="/leads"
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg hover:bg-cyan-50 hover:border-cyan-200 border border-transparent transition-colors"
            >
              <Users className="w-8 h-8 text-cyan-500" />
              <span className="text-sm font-medium text-gray-700">Ver Leads</span>
            </a>
            <a
              href="/installations"
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg hover:bg-purple-50 hover:border-purple-200 border border-transparent transition-colors"
            >
              <Calendar className="w-8 h-8 text-purple-500" />
              <span className="text-sm font-medium text-gray-700">Agenda</span>
            </a>
            <a
              href="/products"
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg hover:bg-green-50 hover:border-green-200 border border-transparent transition-colors"
            >
              <Package className="w-8 h-8 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Inventario</span>
            </a>
            <a
              href="/technicians"
              className="flex flex-col items-center gap-2 p-4 bg-gray-50 rounded-lg hover:bg-orange-50 hover:border-orange-200 border border-transparent transition-colors"
            >
              <Wrench className="w-8 h-8 text-orange-500" />
              <span className="text-sm font-medium text-gray-700">Técnicos</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
