/**
 * InstallationTimer Component
 * Controls for starting/stopping installation timer with real-time elapsed display
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Play, Square, Clock, User, Shield } from 'lucide-react';
import { TimerResponse, TimerStartedBy } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://zafesys-suite-production.up.railway.app';

interface InstallationTimerProps {
  installationId: number;
  initialTimerData?: {
    timer_started_at?: string;
    timer_ended_at?: string;
    timer_started_by?: TimerStartedBy;
    installation_duration_minutes?: number;
  };
  onTimerUpdate?: (data: TimerResponse) => void;
  disabled?: boolean;
}

export const InstallationTimer: React.FC<InstallationTimerProps> = ({
  installationId,
  initialTimerData,
  onTimerUpdate,
  disabled = false
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [startedBy, setStartedBy] = useState<TimerStartedBy | null>(null);
  const [completedDuration, setCompletedDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from props
  useEffect(() => {
    if (initialTimerData) {
      if (initialTimerData.timer_started_at && !initialTimerData.timer_ended_at) {
        // Timer is running
        setIsRunning(true);
        setStartedAt(new Date(initialTimerData.timer_started_at));
        setStartedBy(initialTimerData.timer_started_by || null);
      } else if (initialTimerData.timer_ended_at && initialTimerData.installation_duration_minutes) {
        // Timer completed
        setIsRunning(false);
        setCompletedDuration(initialTimerData.installation_duration_minutes);
        setStartedBy(initialTimerData.timer_started_by || null);
      }
    }
  }, [initialTimerData]);

  // Real-time elapsed time update
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRunning && startedAt) {
      interval = setInterval(() => {
        const now = new Date();
        const diffMs = now.getTime() - startedAt.getTime();
        const totalSeconds = Math.floor(diffMs / 1000);
        setElapsedMinutes(Math.floor(totalSeconds / 60));
        setElapsedSeconds(totalSeconds % 60);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, startedAt]);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }, []);

  const startTimer = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/installations/${installationId}/timer/start`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ started_by: 'admin' })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al iniciar timer');
      }
      
      const data: TimerResponse = await response.json();
      setIsRunning(data.is_running);
      setStartedAt(data.timer_started_at ? new Date(data.timer_started_at) : null);
      setStartedBy(data.timer_started_by || null);
      setElapsedMinutes(data.elapsed_minutes || 0);
      setElapsedSeconds(0);
      
      if (onTimerUpdate) {
        onTimerUpdate(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const stopTimer = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/installations/${installationId}/timer/stop`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Error al detener timer');
      }
      
      const data: TimerResponse = await response.json();
      setIsRunning(false);
      setCompletedDuration(data.installation_duration_minutes || null);
      
      if (onTimerUpdate) {
        onTimerUpdate(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (minutes: number, seconds: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${seconds}s`;
    }
    return `${mins}m ${seconds}s`;
  };

  const formatDuration = (totalMinutes: number) => {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}min`;
    }
    return `${mins} minutos`;
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-gray-900 dark:text-white">Timer de Instalación</span>
        </div>
        {startedBy && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {startedBy === 'admin' ? (
              <><Shield className="w-3 h-3" /> Admin</>
            ) : (
              <><User className="w-3 h-3" /> Técnico</>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-100 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {/* Timer Display */}
      <div className="text-center mb-4">
        {isRunning ? (
          <div className="text-3xl font-mono font-bold text-green-600 dark:text-green-400">
            {formatTime(elapsedMinutes, elapsedSeconds)}
          </div>
        ) : completedDuration ? (
          <div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatDuration(completedDuration)}
            </div>
            <div className="text-sm text-gray-500">Duración total</div>
          </div>
        ) : (
          <div className="text-2xl font-mono text-gray-400">00:00</div>
        )}
      </div>

      {/* Timer Button */}
      {!completedDuration && (
        <button
          onClick={isRunning ? stopTimer : startTimer}
          disabled={loading || disabled}
          className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-colors ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          } ${(loading || disabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : isRunning ? (
            <><Square className="w-5 h-5" /> Detener Timer</>
          ) : (
            <><Play className="w-5 h-5" /> Iniciar Timer</>
          )}
        </button>
      )}

      {/* Completed indicator */}
      {completedDuration && (
        <div className="text-center text-sm text-green-600 dark:text-green-400 font-medium">
          ✓ Instalación completada
        </div>
      )}
    </div>
  );
};

export default InstallationTimer;
