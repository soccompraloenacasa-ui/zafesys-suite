import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, Link2, Unlink, AlertTriangle, Settings, TestTube } from 'lucide-react';
import type { GoogleAdsAccount, GoogleAdsSpendSummary } from '../../types';
import { googleAdsApi } from '../../services/api';

interface AccountCardProps {
  accountNumber: 1 | 2;
  account: GoogleAdsAccount;
  spendSummary?: GoogleAdsSpendSummary;
  isLoading: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh?: () => void;
}

export default function AccountCard({
  accountNumber,
  account,
  spendSummary,
  isLoading,
  isConnecting,
  onConnect,
  onDisconnect,
  onRefresh,
}: AccountCardProps) {
  const [showCustomerIdInput, setShowCustomerIdInput] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [savingCustomerId, setSavingCustomerId] = useState(false);
  const [customerIdError, setCustomerIdError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleSaveCustomerId = async () => {
    if (!customerId.trim()) return;

    setSavingCustomerId(true);
    setCustomerIdError(null);

    try {
      await googleAdsApi.setCustomerId(accountNumber, customerId.trim());
      setShowCustomerIdInput(false);
      setCustomerId('');
      onRefresh?.();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setCustomerIdError(error.response?.data?.detail || 'Error al guardar el Customer ID');
    } finally {
      setSavingCustomerId(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const result = await googleAdsApi.testConnection(accountNumber);

      if (result.error) {
        setTestResult(`Error: ${result.error}`);
      } else if (result.api_test_result === 'SUCCESS - API responding') {
        setTestResult('Conexion exitosa con Google Ads API');
      } else if (result.accessible_customers.length > 0) {
        setTestResult(`Clientes disponibles: ${result.accessible_customers.join(', ')}`);
      } else {
        setTestResult('Conectado pero sin clientes de Google Ads accesibles');
      }
    } catch {
      setTestResult('Error al probar la conexion');
    } finally {
      setTestingConnection(false);
    }
  };

  const needsCustomerId = account.connected && !account.customer_id;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Cuenta {accountNumber}
        </h3>
        <div className="flex items-center gap-2">
          {account.connected ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-600">Conectada</span>
            </>
          ) : (
            <>
              <XCircle className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-500">Desconectada</span>
            </>
          )}
        </div>
      </div>

      {/* Account Info */}
      {account.connected ? (
        <div className="space-y-4">
          {/* Warning: Missing Customer ID */}
          {needsCustomerId && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Customer ID no detectado</p>
                  <p className="text-xs text-amber-600 mt-1">
                    Configura manualmente el Customer ID de tu cuenta de Google Ads para ver metricas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Account Details */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Nombre de cuenta</span>
                <span className="text-sm font-medium text-gray-900">
                  {account.account_name || 'Sin nombre'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Email</span>
                <span className="text-sm font-medium text-gray-900">
                  {account.email || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Customer ID</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-mono ${account.customer_id ? 'text-gray-700' : 'text-red-500'}`}>
                    {account.customer_id || 'No configurado'}
                  </span>
                  <button
                    onClick={() => setShowCustomerIdInput(!showCustomerIdInput)}
                    className="p-1 text-gray-400 hover:text-cyan-500 transition-colors"
                    title="Configurar Customer ID"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Customer ID Input */}
          {showCustomerIdInput && (
            <div className="p-4 bg-cyan-50 border border-cyan-200 rounded-lg space-y-3">
              <p className="text-sm text-cyan-800 font-medium">Configurar Customer ID</p>
              <p className="text-xs text-cyan-600">
                Encuentra tu Customer ID en Google Ads: esquina superior derecha, formato XXX-XXX-XXXX
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="123-456-7890"
                  className="flex-1 px-3 py-2 text-sm border border-cyan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleSaveCustomerId}
                  disabled={savingCustomerId || !customerId.trim()}
                  className="px-4 py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 disabled:opacity-50 transition-colors"
                >
                  {savingCustomerId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
                </button>
              </div>
              {customerIdError && (
                <p className="text-xs text-red-600">{customerIdError}</p>
              )}
            </div>
          )}

          {/* Test Connection Button */}
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {testingConnection ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <TestTube className="w-4 h-4" />
            )}
            Probar conexion
          </button>

          {/* Test Result */}
          {testResult && (
            <div className={`p-3 rounded-lg text-sm ${testResult.includes('Error') || testResult.includes('sin clientes') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {testResult}
            </div>
          )}

          {/* Spend Summary */}
          {spendSummary && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Resumen de Gasto</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-cyan-50 rounded-lg">
                  <p className="text-xs text-cyan-600 mb-1">Últimos 7 días</p>
                  <p className="text-lg font-bold text-cyan-700">
                    {formatCurrency(spendSummary.spend_last_7_days, spendSummary.currency)}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-purple-600 mb-1">Este mes</p>
                  <p className="text-lg font-bold text-purple-700">
                    {formatCurrency(spendSummary.spend_this_month, spendSummary.currency)}
                  </p>
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Gasto total acumulado</p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(spendSummary.total_spend, spendSummary.currency)}
                </p>
              </div>
            </div>
          )}

          {/* Disconnect Button */}
          <button
            onClick={onDisconnect}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlink className="w-4 h-4" />
            )}
            Desconectar cuenta
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Empty State */}
          <div className="p-8 bg-gray-50 rounded-lg text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <Link2 className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 mb-1">Sin cuenta vinculada</p>
            <p className="text-sm text-gray-400">
              Conecta tu cuenta de Google Ads para ver estadísticas
            </p>
          </div>

          {/* Connect Button */}
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Conectar con Google Ads
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
