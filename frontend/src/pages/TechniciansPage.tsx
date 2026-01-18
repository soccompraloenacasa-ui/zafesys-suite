import { useState, useEffect } from 'react';
import { Plus, Wrench, Phone, Mail, MapPin, Star, Calendar } from 'lucide-react';
import { techniciansApi } from '../services/api';
import type { Technician } from '../types';

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    fetchTechnicians();
  }, []);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Técnicos</h1>
          <p className="text-gray-500">Gestiona tu equipo de instaladores</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors">
          <Plus className="w-4 h-4" />
          Nuevo Técnico
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
          <p>No hay técnicos registrados</p>
          <button className="mt-4 text-cyan-600 hover:underline">
            Agregar primer técnico
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {technicians.map((tech) => (
            <div
              key={tech.id}
              className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center">
                  <span className="text-white text-xl font-bold">
                    {tech.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{tech.name}</h3>
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
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${tech.phone}`} className="hover:text-cyan-600">
                    {tech.phone}
                  </a>
                </div>

                {tech.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a href={`mailto:${tech.email}`} className="hover:text-cyan-600 truncate">
                      {tech.email}
                    </a>
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
                <button className="text-sm text-cyan-600 hover:underline flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Ver agenda
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
