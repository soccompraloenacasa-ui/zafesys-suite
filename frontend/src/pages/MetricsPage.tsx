import { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  Trophy,
  TrendingUp,
  Users,
  Package,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format, startOfMonth, startOfWeek, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import api from '../services/api';

interface Summary {
  total_installations: number;
  avg_per_day: number;
  avg_duration_minutes: number;
  top_technician: { name: string; count: number } | null;
}

interface DayData {
  date: string;
  count: number;
}

interface ProductData {
  product_name: string;
  count: number;
  percentage: number;
}

interface TechnicianData {
  id: number;
  name: string;
  installations: number;
  avg_per_day: number;
  avg_duration: number;
  ranking: number;
}

interface DurationByProduct {
  product_name: string;
  avg_minutes: number;
}

interface AnalyticsData {
  summary: Summary;
  by_day: DayData[];
  by_product: ProductData[];
  by_technician: TechnicianData[];
  duration_by_product: DurationByProduct[];
}

interface Technician {
  id: number;
  name: string;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

export default function MetricsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedTechnician, setSelectedTechnician] = useState<string>('');

  const getDateRange = (p: PeriodType): { start: Date; end: Date } => {
    const today = new Date();
    switch (p) {
      case 'today':
        return { start: today, end: today };
      case 'week':
        return { start: startOfWeek(today, { weekStartsOn: 1 }), end: today };
      case 'month':
        return { start: startOfMonth(today), end: today };
      case 'year':
        return { start: startOfYear(today), end: today };
      case 'custom':
        return {
          start: startDate ? new Date(startDate) : startOfMonth(today),
          end: endDate ? new Date(endDate) : today,
        };
      default:
        return { start: startOfMonth(today), end: today };
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(period);
      const params = new URLSearchParams({
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
      });
      if (selectedTechnician) {
        params.append('technician_id', selectedTechnician);
      }

      const response = await api.get(`/analytics/installations?${params}`);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const response = await api.get('/analytics/technicians');
      setTechnicians(response.data);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

  useEffect(() => {
    fetchTechnicians();
  }, []);

  useEffect(() => {
    fetchData();
  }, [period, startDate, endDate, selectedTechnician]);

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd MMM', { locale: es });
    } catch {
      return dateStr;
    }
  };

  const getRankingBadge = (ranking: number) => {
    if (ranking === 1) return 'bg-yellow-100 text-yellow-700';
    if (ranking === 2) return 'bg-gray-100 text-gray-700';
    if (ranking === 3) return 'bg-orange-100 text-orange-700';
    return 'bg-gray-50 text-gray-500';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500 rounded-lg">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Metricas de Instalaciones</h1>
            <p className="text-gray-500">Analisis de rendimiento y productividad</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 mb-6 border border-gray-100 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Period Buttons */}
          <div className="flex gap-2">
            {[
              { value: 'today', label: 'Hoy' },
              { value: 'week', label: 'Esta semana' },
              { value: 'month', label: 'Este mes' },
              { value: 'year', label: 'Este ano' },
              { value: 'custom', label: 'Personalizado' },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value as PeriodType)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === opt.value
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {period === 'custom' && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          {/* Technician Filter */}
          <select
            value={selectedTechnician}
            onChange={(e) => setSelectedTechnician(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Todos los tecnicos</option>
            {technicians.map((tech) => (
              <option key={tech.id} value={tech.id}>
                {tech.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      ) : !data ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No hay datos disponibles</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <span className="text-sm text-gray-500">Total Instalaciones</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{data.summary.total_installations}</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-cyan-600" />
                </div>
                <span className="text-sm text-gray-500">Promedio por Dia</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">{data.summary.avg_per_day}</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
                <span className="text-sm text-gray-500">Tiempo Promedio</span>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {data.summary.avg_duration_minutes}
                <span className="text-lg text-gray-400 ml-1">min</span>
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Trophy className="w-5 h-5 text-yellow-600" />
                </div>
                <span className="text-sm text-gray-500">Tecnico Top</span>
              </div>
              {data.summary.top_technician ? (
                <div>
                  <p className="text-xl font-bold text-gray-900">{data.summary.top_technician.name}</p>
                  <p className="text-sm text-gray-500">{data.summary.top_technician.count} instalaciones</p>
                </div>
              ) : (
                <p className="text-gray-400">Sin datos</p>
              )}
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Installations by Day */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-gray-900">Instalaciones por Dia</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.by_day}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      labelFormatter={(label) => format(new Date(label), 'dd MMMM yyyy', { locale: es })}
                      formatter={(value: number) => [value, 'Instalaciones']}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Installations by Product (Pie Chart) */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-gray-900">Por Tipo de Cerradura</h3>
              </div>
              <div className="h-64">
                {data.by_product.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.by_product}
                        dataKey="count"
                        nameKey="product_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ product_name, percentage }) =>
                          `${product_name.substring(0, 15)}... ${percentage}%`
                        }
                        labelLine={false}
                      >
                        {data.by_product.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [value, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    Sin datos de productos
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Technicians Table */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-gray-900">Rendimiento por Tecnico</h3>
            </div>
            {data.by_technician.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Ranking</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Tecnico</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Instalaciones</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Promedio/Dia</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Tiempo Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_technician.map((tech) => (
                      <tr key={tech.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${getRankingBadge(
                              tech.ranking
                            )}`}
                          >
                            {tech.ranking}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">{tech.name}</td>
                        <td className="py-3 px-4 text-center text-gray-700">{tech.installations}</td>
                        <td className="py-3 px-4 text-center text-gray-700">{tech.avg_per_day}</td>
                        <td className="py-3 px-4 text-center text-gray-700">{tech.avg_duration} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">Sin datos de tecnicos</div>
            )}
          </div>

          {/* Duration by Product (Horizontal Bar Chart) */}
          <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-gray-900">Tiempo Promedio por Tipo de Cerradura</h3>
            </div>
            <div className="h-64">
              {data.duration_by_product.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.duration_by_product} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" unit=" min" />
                    <YAxis
                      dataKey="product_name"
                      type="category"
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                      width={150}
                    />
                    <Tooltip formatter={(value: number) => [`${value} min`, 'Tiempo promedio']} />
                    <Bar dataKey="avg_minutes" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  Sin datos de duracion
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
