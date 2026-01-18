import { useState, useEffect } from 'react';
import { Calendar, Clock, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { installationsApi } from '../services/api';
import type { Installation } from '../types';

const statusLabels: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  en_progreso: { label: 'En progreso', color: 'bg-blue-100 text-blue-700' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
};

export default function InstallationsPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const fetchInstallations = async () => {
      try {
        const data = await installationsApi.getAll();
        setInstallations(data);
      } catch (error) {
        console.error('Error fetching installations:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchInstallations();
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getInstallationsForDay = (day: Date) => {
    return installations.filter((inst) => {
      if (!inst.scheduled_date) return false;
      const instDate = new Date(inst.scheduled_date);
      return (
        instDate.getDate() === day.getDate() &&
        instDate.getMonth() === day.getMonth() &&
        instDate.getFullYear() === day.getFullYear()
      );
    });
  };

  const weekDays = getWeekDays();
  const today = new Date();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instalaciones</h1>
          <p className="text-gray-500">Agenda de instalaciones programadas</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors">
          <Calendar className="w-4 h-4" />
          Nueva Instalación
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-lg p-4 border border-gray-100">
        <button
          onClick={() => navigateWeek(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <span className="text-lg font-semibold text-gray-900 capitalize">
          {formatDate(currentDate)}
        </span>
        <button
          onClick={() => navigateWeek(1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const isToday =
              day.getDate() === today.getDate() &&
              day.getMonth() === today.getMonth() &&
              day.getFullYear() === today.getFullYear();
            const dayInstallations = getInstallationsForDay(day);

            return (
              <div
                key={day.toISOString()}
                className={`bg-white rounded-lg border ${
                  isToday ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-gray-100'
                } min-h-[300px]`}
              >
                {/* Day Header */}
                <div
                  className={`p-3 border-b ${isToday ? 'bg-cyan-50' : 'bg-gray-50'}`}
                >
                  <p className="text-xs text-gray-500 uppercase">
                    {day.toLocaleDateString('es-CO', { weekday: 'short' })}
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      isToday ? 'text-cyan-600' : 'text-gray-900'
                    }`}
                  >
                    {day.getDate()}
                  </p>
                </div>

                {/* Installations */}
                <div className="p-2 space-y-2">
                  {dayInstallations.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">
                      Sin instalaciones
                    </p>
                  ) : (
                    dayInstallations.map((inst) => {
                      const status = statusLabels[inst.status];
                      return (
                        <div
                          key={inst.id}
                          className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                            <Clock className="w-3 h-3" />
                            {inst.scheduled_time}
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            Instalación #{inst.id}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                            <User className="w-3 h-3" />
                            <span className="truncate">
                              {inst.technician_id ? `Técnico #${inst.technician_id}` : 'Sin asignar'}
                            </span>
                          </div>
                          <span
                            className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${status.color}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
