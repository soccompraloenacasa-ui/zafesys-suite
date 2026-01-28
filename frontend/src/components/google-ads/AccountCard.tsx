import { CheckCircle, XCircle, Loader2, Link2, Unlink } from 'lucide-react';
import type { GoogleAdsAccount, GoogleAdsSpendSummary } from '../../types';

interface AccountCardProps {
  accountNumber: 1 | 2;
  account: GoogleAdsAccount;
  spendSummary?: GoogleAdsSpendSummary;
  isLoading: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function AccountCard({
  accountNumber,
  account,
  spendSummary,
  isLoading,
  isConnecting,
  onConnect,
  onDisconnect,
}: AccountCardProps) {
  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

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
                <span className="text-sm font-mono text-gray-700">
                  {account.customer_id || 'N/A'}
                </span>
              </div>
            </div>
          </div>

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
