import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Phone, Loader2 } from 'lucide-react';
import { techApi } from '../../services/api';

export default function TechLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await techApi.login(phone, pin);

      // Store tech session
      localStorage.setItem('tech_token', response.access_token);
      localStorage.setItem('tech_id', response.technician_id.toString());
      localStorage.setItem('tech_name', response.technician_name);

      navigate('/tech/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Error al iniciar sesion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-500 to-cyan-700 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Lock className="w-10 h-10 text-cyan-600" />
        </div>
        <h1 className="text-2xl font-bold text-white">ZAFESYS</h1>
        <p className="text-cyan-100">App de Tecnicos</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Iniciar Sesion</h2>
        <p className="text-gray-500 text-sm mb-6">Ingresa con tu telefono y PIN</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefono
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="3001234567"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-lg"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PIN
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="****"
                maxLength={6}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-lg tracking-widest"
                required
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Si es tu primera vez, crea un PIN de 4-6 digitos
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !phone || !pin}
            className="w-full py-3 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Ingresando...
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>
      </div>

      <p className="mt-6 text-cyan-100 text-sm">
        Problemas para ingresar? Contacta a soporte
      </p>
    </div>
  );
}
