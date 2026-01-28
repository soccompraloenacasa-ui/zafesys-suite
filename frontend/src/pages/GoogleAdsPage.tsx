import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { googleAdsApi } from '../services/api';
import AccountCard from '../components/google-ads/AccountCard';
import type { GoogleAdsStatus, GoogleAdsSpendSummary } from '../types';

export default function GoogleAdsPage() {
  const [status, setStatus] = useState<GoogleAdsStatus | null>(null);
  const [spendAccount1, setSpendAccount1] = useState<GoogleAdsSpendSummary | null>(null);
  const [spendAccount2, setSpendAccount2] = useState<GoogleAdsSpendSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingAccount, setConnectingAccount] = useState<1 | 2 | null>(null);
  const [disconnectingAccount, setDisconnectingAccount] = useState<1 | 2 | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError('No se pudo cargar el estado de las cuentas. Verifica que el backend esté configurado correctamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');

    if (oauthSuccess) {
      // Refresh status after successful OAuth
      fetchStatus();
      // Clean URL
      window.history.replaceState({}, '', '/google-ads');
    }

    if (oauthError) {
      setError('Error durante la autenticación con Google. Por favor, intenta de nuevo.');
      window.history.replaceState({}, '', '/google-ads');
    }
  }, [fetchStatus]);

  const handleConnect = async (account: 1 | 2) => {
    try {
      setConnectingAccount(account);
      setError(null);
      const { auth_url } = await googleAdsApi.getAuthUrl(account);
      // Redirect to Google OAuth
      window.location.href = auth_url;
    } catch (err) {
      console.error('Error getting auth URL:', err);
      setError('No se pudo iniciar la conexión con Google. Verifica la configuración del servidor.');
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
    } catch (err) {
      console.error('Error disconnecting account:', err);
      setError('No se pudo desconectar la cuenta. Por favor, intenta de nuevo.');
    } finally {
      setDisconnectingAccount(null);
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchStatus();
  };

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
              <p className="text-gray-500">Conecta tus cuentas publicitarias</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-700 text-sm">
          <strong>Nota:</strong> Puedes conectar hasta 2 cuentas de Google Ads para monitorear tus campañas.
          Los datos de gasto se actualizan cada hora.
        </p>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

      {/* Setup Instructions */}
      {!status?.account1.connected && !status?.account2.connected && !loading && (
        <div className="mt-8 p-6 bg-white rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración Inicial</h2>
          <div className="space-y-4 text-sm text-gray-600">
            <p>Para conectar tus cuentas de Google Ads necesitas:</p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>Tener acceso de administrador a la cuenta de Google Ads</li>
              <li>Permitir el acceso cuando Google te lo solicite</li>
              <li>Seleccionar la cuenta de cliente correcta (si tienes varias)</li>
            </ol>
            <p className="mt-4 text-gray-500">
              Los permisos solicitados son solo de lectura y no permiten modificar tus campañas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
