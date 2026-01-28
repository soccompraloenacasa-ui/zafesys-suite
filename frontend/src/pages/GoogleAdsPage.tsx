import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, RefreshCw, AlertCircle, DollarSign, Eye, MousePointer, Target, BarChart3, Calendar, ChevronDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { googleAdsApi } from '../services/api';
import AccountCard from '../components/google-ads/AccountCard';
import type { GoogleAdsStatus, GoogleAdsSpendSummary, GoogleAdsMetrics } from '../types';

// Date period options
type DatePeriod = 'today' | 'yesterday' | 'last_7_days' | 'last_14_days' | 'last_30_days' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'last_year' | 'custom';

interface DateRange {
  startDate: string;
  endDate: string;
}

const DATE_PERIOD_LABELS: Record<DatePeriod, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  last_7_days: 'Últimos 7 días',
  last_14_days: 'Últimos 14 días',
  last_30_days: 'Últimos 30 días',
  this_month: 'Este mes',
  last_month: 'Mes pasado',
  last_3_months: 'Últimos 3 meses',
  this_year: 'Este año',
  last_year: 'Año pasado',
  custom: 'Personalizado',
};

function getDateRange(period: DatePeriod): DateRange {
  const today = new Date();
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  switch (period) {
    case 'today':
      return { startDate: formatDate(today), endDate: formatDate(today) };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { startDate: formatDate(yesterday), endDate: formatDate(yesterday) };
    }
    case 'last_7_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'last_14_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 13);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'last_30_days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }
    case 'last_3_months': {
      const start = new Date(today);
      start.setMonth(start.getMonth() - 3);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'this_year': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { startDate: formatDate(start), endDate: formatDate(today) };
    }
    case 'last_year': {
      const start = new Date(today.getFullYear() - 1, 0, 1);
      const end = new Date(today.getFullYear() - 1, 11, 31);
      return { startDate: formatDate(start), endDate: formatDate(end) };
    }
    default:
      return { startDate: formatDate(today), endDate: formatDate(today) };
  }
}

export default function GoogleAdsPage() {
  const [status, setStatus] = useState<GoogleAdsStatus | null>(null);
  const [spendAccount1, setSpendAccount1] = useState<GoogleAdsSpendSummary | null>(null);
  const [spendAccount2, setSpendAccount2] = useState<GoogleAdsSpendSummary | null>(null);
  const [metrics, setMetrics] = useState<GoogleAdsMetrics | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [connectingAccount, setConnectingAccount] = useState<1 | 2 | null>(null);
  const [disconnectingAccount, setDisconnectingAccount] = useState<1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Date filter state
  const [selectedPeriod, setSelectedPeriod] = useState<DatePeriod>('last_30_days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  // Calculate current date range
  const dateRange = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      return { startDate: customStartDate, endDate: customEndDate };
    }
    return getDateRange(selectedPeriod);
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Format date range for display
  const dateRangeLabel = useMemo(() => {
    if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate + 'T00:00:00');
      const end = new Date(customEndDate + 'T00:00:00');
      return `${start.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return DATE_PERIOD_LABELS[selectedPeriod];
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showPeriodDropdown && !target.closest('[data-period-dropdown]')) {
        setShowPeriodDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPeriodDropdown]);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const statusData = await googleAdsApi.getStatus();
      setStatus(statusData);

      // Fetch spend data for connected accounts
      if (statusData.account1.connected) {
        try {
          const spend1 = await googleAdsApi.getSpendSummary(1);
          setSpendAccount1(spend1);
        } catch {
          console.error('Error fetching spend for account 1');
        }
      } else {
        setSpendAccount1(null);
      }

      if (statusData.account2.connected) {
        try {
          const spend2 = await googleAdsApi.getSpendSummary(2);
          setSpendAccount2(spend2);
        } catch {
          console.error('Error fetching spend for account 2');
        }
      } else {
        setSpendAccount2(null);
      }
    } catch (err) {
      console.error('Error fetching Google Ads status:', err);
      setError('No se pudo cargar el estado de las cuentas.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMetrics = useCallback(async (account: 1 | 2, range: DateRange) => {
    try {
      setMetricsLoading(true);
      const metricsData = await googleAdsApi.getMetrics(account, {
        startDate: range.startDate,
        endDate: range.endDate,
      });
      setMetrics(metricsData);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');

    if (oauthSuccess) {
      fetchStatus();
      window.history.replaceState({}, '', '/google-ads');
    }

    if (oauthError) {
      setError('Error durante la autenticación con Google. Por favor, intenta de nuevo.');
      window.history.replaceState({}, '', '/google-ads');
    }
  }, [fetchStatus]);

  // Fetch metrics when an account is connected or date range changes
  useEffect(() => {
    if (status?.account1.connected && selectedAccount === 1) {
      fetchMetrics(1, dateRange);
    } else if (status?.account2.connected && selectedAccount === 2) {
      fetchMetrics(2, dateRange);
    } else if (status?.account1.connected) {
      fetchMetrics(1, dateRange);
      setSelectedAccount(1);
    } else if (status?.account2.connected) {
      fetchMetrics(2, dateRange);
      setSelectedAccount(2);
    }
  }, [status, fetchMetrics, dateRange, selectedAccount]);

  const handleConnect = async (account: 1 | 2) => {
    try {
      setConnectingAccount(account);
      setError(null);
      const { auth_url } = await googleAdsApi.getAuthUrl(account);
      window.location.href = auth_url;
    } catch (err) {
      console.error('Error getting auth URL:', err);
      setError('No se pudo iniciar la conexión con Google.');
      setConnectingAccount(null);
    }
  };

  const handleDisconnect = async (account: 1 | 2) => {
    if (!confirm(`¿Estás seguro de que deseas desconectar la Cuenta ${account}?`)) {
      return;
    }

    try {
      setDisconnectingAccount(account);
      setError(null);
      await googleAdsApi.disconnect(account);
      await fetchStatus();
      if (selectedAccount === account) {
        setMetrics(null);
      }
    } catch (err) {
      console.error('Error disconnecting account:', err);
      setError('No se pudo desconectar la cuenta.');
    } finally {
      setDisconnectingAccount(null);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchStatus();
    if (metrics) {
      fetchMetrics(selectedAccount, dateRange);
    }
  };

  const handleAccountChange = (account: 1 | 2) => {
    setSelectedAccount(account);
    const accountStatus = account === 1 ? status?.account1 : status?.account2;
    if (accountStatus?.connected) {
      fetchMetrics(account, dateRange);
    }
  };

  const handlePeriodChange = (period: DatePeriod) => {
    setSelectedPeriod(period);
    setShowPeriodDropdown(false);
    if (period !== 'custom') {
      setCustomStartDate('');
      setCustomEndDate('');
    }
  };

  const handleCustomDateChange = () => {
    if (customStartDate && customEndDate) {
      // Validate date range
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      if (start > end) {
        setError('La fecha de inicio no puede ser posterior a la fecha de fin.');
        return;
      }

      if (diffDays > 365) {
        setError('El rango de fechas no puede exceder 1 año.');
        return;
      }

      setError(null);
      setSelectedPeriod('custom');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('es-CO').format(num);
  };

  const hasConnectedAccount = status?.account1.connected || status?.account2.connected;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-500 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Google Ads</h1>
              <p className="text-gray-500">Métricas y rendimiento de campañas</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || metricsLoading}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading || metricsLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 font-medium">Error</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <AccountCard
          accountNumber={1}
          account={status?.account1 || { connected: false }}
          spendSummary={spendAccount1 || undefined}
          isLoading={disconnectingAccount === 1}
          isConnecting={connectingAccount === 1}
          onConnect={() => handleConnect(1)}
          onDisconnect={() => handleDisconnect(1)}
        />
        <AccountCard
          accountNumber={2}
          account={status?.account2 || { connected: false }}
          spendSummary={spendAccount2 || undefined}
          isLoading={disconnectingAccount === 2}
          isConnecting={connectingAccount === 2}
          onConnect={() => handleConnect(2)}
          onDisconnect={() => handleDisconnect(2)}
        />
      </div>

      {/* Metrics Section */}
      {hasConnectedAccount && (
        <>
          {/* Account Selector and Date Filters */}
          <div className="mb-6 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex flex-wrap items-center gap-4">
              {/* Account Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Cuenta:</span>
                <div className="flex gap-2">
                  {status?.account1.connected && (
                    <button
                      onClick={() => handleAccountChange(1)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedAccount === 1
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Cuenta 1
                    </button>
                  )}
                  {status?.account2.connected && (
                    <button
                      onClick={() => handleAccountChange(2)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedAccount === 2
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Cuenta 2
                    </button>
                  )}
                </div>
              </div>

              {/* Separator */}
              <div className="hidden md:block h-8 w-px bg-gray-200" />

              {/* Date Period Selector */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Período:</span>
                <div className="relative" data-period-dropdown>
                  <button
                    onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors min-w-[160px]"
                  >
                    <span>{dateRangeLabel}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showPeriodDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown */}
                  {showPeriodDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 max-h-80 overflow-y-auto">
                      {(Object.keys(DATE_PERIOD_LABELS) as DatePeriod[]).map((period) => (
                        <button
                          key={period}
                          onClick={() => handlePeriodChange(period)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                            selectedPeriod === period ? 'bg-cyan-50 text-cyan-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          {DATE_PERIOD_LABELS[period]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Date Pickers */}
              {selectedPeriod === 'custom' && (
                <>
                  <div className="hidden md:block h-8 w-px bg-gray-200" />
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      max={customEndDate || new Date().toISOString().split('T')[0]}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    <span className="text-gray-500">-</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      min={customStartDate}
                      max={new Date().toISOString().split('T')[0]}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleCustomDateChange}
                      disabled={!customStartDate || !customEndDate}
                      className="px-4 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Aplicar
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Date range info */}
            {metrics && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                Mostrando datos del {new Date(metrics.period_start + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })} al {new Date(metrics.period_end + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>

          {metricsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
          ) : metrics ? (
            <>
              {/* Info message when no data */}
              {metrics.message && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-blue-700 text-sm">{metrics.message}</p>
                </div>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-green-500">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(metrics.total_spend)}
                  </h3>
                  <p className="text-sm text-gray-500">Gasto Total</p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-blue-500">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {formatNumber(metrics.total_impressions)}
                  </h3>
                  <p className="text-sm text-gray-500">Impresiones</p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-purple-500">
                      <MousePointer className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {formatNumber(metrics.total_clicks)}
                  </h3>
                  <p className="text-sm text-gray-500">Clics (CTR: {metrics.average_ctr}%)</p>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 rounded-lg bg-orange-500">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-1">
                    {formatCurrency(metrics.average_cpc)}
                  </h3>
                  <p className="text-sm text-gray-500">CPC Promedio</p>
                </div>
              </div>

              {/* ROI Card */}
              {metrics.roi && (
                <div className="bg-gradient-to-r from-cyan-500 to-teal-500 rounded-xl p-6 shadow-sm mb-8 text-white">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Retorno de Inversión (ROI)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-cyan-100 text-sm mb-1">Ventas Totales</p>
                      <p className="text-2xl font-bold">{formatCurrency(metrics.roi.total_sales)}</p>
                    </div>
                    <div>
                      <p className="text-cyan-100 text-sm mb-1">Instalaciones</p>
                      <p className="text-2xl font-bold">{metrics.roi.total_installations}</p>
                    </div>
                    <div>
                      <p className="text-cyan-100 text-sm mb-1">ROI</p>
                      <p className={`text-2xl font-bold ${metrics.roi.roi_percentage >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        {metrics.roi.roi_percentage >= 0 ? '+' : ''}{metrics.roi.roi_percentage.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-cyan-100 text-sm mb-1">Costo por Instalación</p>
                      <p className="text-2xl font-bold">{formatCurrency(metrics.roi.cost_per_installation)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Daily Spend Chart */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Gasto Diario</h2>
                {metrics.daily_spend.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metrics.daily_spend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatCurrency(value), 'Gasto']}
                          labelFormatter={(label) => {
                            const date = new Date(label);
                            return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="spend"
                          stroke="#06b6d4"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <div className="text-center">
                      <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">Sin datos de gasto</p>
                      <p className="text-gray-400 text-sm mt-1">No hay registros de gasto en este período</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Campaigns Table */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Rendimiento por Campaña</h2>
                {metrics.campaigns.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Campaña</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Gasto</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Impresiones</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Clics</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">CTR</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">CPC</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Conversiones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.campaigns.map((campaign) => (
                          <tr key={campaign.campaign_id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <span className="font-medium text-gray-900">{campaign.campaign_name}</span>
                            </td>
                            <td className="py-3 px-4 text-right text-gray-700">
                              {formatCurrency(campaign.spend)}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-700">
                              {formatNumber(campaign.impressions)}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-700">
                              {formatNumber(campaign.clicks)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className={`font-medium ${campaign.ctr >= 2 ? 'text-green-600' : campaign.ctr >= 1 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {campaign.ctr.toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right text-gray-700">
                              {formatCurrency(campaign.cpc)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {campaign.conversions}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No hay campañas activas</p>
                      <p className="text-gray-400 text-sm mt-1">No se encontraron campañas con actividad en este período</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Clicks Chart */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Clics Diarios</h2>
                {metrics.daily_spend.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.daily_spend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => {
                            const date = new Date(value);
                            return `${date.getDate()}/${date.getMonth() + 1}`;
                          }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip
                          formatter={(value: number) => [formatNumber(value), 'Clics']}
                          labelFormatter={(label) => {
                            const date = new Date(label);
                            return date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
                          }}
                        />
                        <Bar dataKey="clicks" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <div className="text-center">
                      <MousePointer className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">Sin datos de clics</p>
                      <p className="text-gray-400 text-sm mt-1">No hay registros de clics en este período</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </>
      )}

      {/* Setup Instructions (only show if no accounts connected) */}
      {!hasConnectedAccount && !loading && (
        <div className="mt-8 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración Inicial</h2>
          <div className="space-y-4 text-sm text-gray-600">
            <p>Para ver métricas de tus campañas de Google Ads:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Haz clic en "Conectar con Google Ads" en una de las cuentas</li>
              <li>Inicia sesión con tu cuenta de Google que tiene acceso a Google Ads</li>
              <li>Autoriza el acceso cuando Google te lo solicite</li>
              <li>Las métricas se cargarán automáticamente</li>
            </ol>
            <p className="mt-4 text-gray-500">
              Los datos mostrados son de los últimos 30 días y se actualizan cada hora.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
