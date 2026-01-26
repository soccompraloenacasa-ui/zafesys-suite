/**
 * Timer API Service
 * Functions for interacting with installation timer endpoints
 */
import { TimerResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://zafesys-suite-production.up.railway.app';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

/**
 * Start the installation timer
 * @param installationId - ID of the installation
 * @param startedBy - Who is starting the timer ('admin' or 'technician')
 */
export const startTimer = async (
  installationId: number,
  startedBy: 'admin' | 'technician' = 'admin'
): Promise<TimerResponse> => {
  const response = await fetch(`${API_BASE}/api/installations/${installationId}/timer/start`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ started_by: startedBy })
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.detail || 'Error al iniciar timer');
  }
  
  return response.json();
};

/**
 * Stop the installation timer
 * @param installationId - ID of the installation
 */
export const stopTimer = async (installationId: number): Promise<TimerResponse> => {
  const response = await fetch(`${API_BASE}/api/installations/${installationId}/timer/stop`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.detail || 'Error al detener timer');
  }
  
  return response.json();
};

/**
 * Get the current timer status
 * @param installationId - ID of the installation
 */
export const getTimerStatus = async (installationId: number): Promise<TimerResponse> => {
  const response = await fetch(`${API_BASE}/api/installations/${installationId}/timer`, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.detail || 'Error al obtener estado del timer');
  }
  
  return response.json();
};

/**
 * Format minutes to human readable string
 * @param minutes - Total minutes
 */
export const formatDuration = (minutes: number): string => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}min`;
  }
  return `${mins} minutos`;
};

/**
 * Check if timer is currently running
 * @param timerData - Timer data from installation
 */
export const isTimerRunning = (timerData: {
  timer_started_at?: string;
  timer_ended_at?: string;
}): boolean => {
  return !!(timerData.timer_started_at && !timerData.timer_ended_at);
};

/**
 * Calculate elapsed time in seconds
 * @param startedAt - ISO date string when timer started
 */
export const calculateElapsedSeconds = (startedAt: string): number => {
  const start = new Date(startedAt);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / 1000);
};
