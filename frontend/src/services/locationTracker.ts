/**
 * GPS Location Tracking Service for Technician PWA
 * Sends location to backend every 2 minutes while tracking is active
 */

import { techApi } from './api';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
}

type LocationCallback = (location: LocationData | null, error?: string) => void;

class LocationTrackingService {
  private watchId: number | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastLocation: LocationData | null = null;
  private technicianId: number | null = null;
  private currentInstallationId: number | null = null;
  private isTracking: boolean = false;
  private callbacks: LocationCallback[] = [];
  
  // Send location every 2 minutes
  private readonly SEND_INTERVAL = 2 * 60 * 1000; // 2 minutes

  /**
   * Start tracking technician location
   */
  startTracking(technicianId: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isTracking) {
        console.log('[GPS] Already tracking');
        resolve(true);
        return;
      }

      this.technicianId = technicianId;
      
      // Check if geolocation is available
      if (!navigator.geolocation) {
        console.error('[GPS] Geolocation not supported');
        this.notifyCallbacks(null, 'Geolocation no soportado');
        resolve(false);
        return;
      }

      // Request permission and start watching
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('[GPS] Permission granted, starting tracking');
          this.handlePosition(position);
          this.startWatching();
          this.startSendingInterval();
          this.isTracking = true;
          resolve(true);
        },
        (error) => {
          console.error('[GPS] Permission denied or error:', error.message);
          this.notifyCallbacks(null, this.getErrorMessage(error));
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });
  }

  /**
   * Stop tracking
   */
  stopTracking(): void {
    console.log('[GPS] Stopping tracking');
    
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isTracking = false;
    this.lastLocation = null;
  }

  /**
   * Set current installation (for context)
   */
  setCurrentInstallation(installationId: number | null): void {
    this.currentInstallationId = installationId;
    
    // Send location immediately when starting/ending an installation
    if (this.lastLocation && this.technicianId) {
      this.sendLocationToServer();
    }
  }

  /**
   * Subscribe to location updates
   */
  onLocationUpdate(callback: LocationCallback): () => void {
    this.callbacks.push(callback);
    
    // Send current location if available
    if (this.lastLocation) {
      callback(this.lastLocation);
    }
    
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Get current tracking status
   */
  getStatus(): { isTracking: boolean; lastLocation: LocationData | null } {
    return {
      isTracking: this.isTracking,
      lastLocation: this.lastLocation
    };
  }

  /**
   * Force send current location
   */
  async sendNow(): Promise<void> {
    if (this.lastLocation && this.technicianId) {
      await this.sendLocationToServer();
    }
  }

  // Private methods

  private startWatching(): void {
    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      (error) => {
        console.error('[GPS] Watch error:', error.message);
        this.notifyCallbacks(null, this.getErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 30000
      }
    );
  }

  private startSendingInterval(): void {
    // Send immediately on start
    this.sendLocationToServer();
    
    // Then send every 2 minutes
    this.intervalId = setInterval(() => {
      this.sendLocationToServer();
    }, this.SEND_INTERVAL);
  }

  private handlePosition(position: GeolocationPosition): void {
    this.lastLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed ?? undefined,
      heading: position.coords.heading ?? undefined,
      altitude: position.coords.altitude ?? undefined
    };

    this.notifyCallbacks(this.lastLocation);
  }

  private async sendLocationToServer(): Promise<void> {
    if (!this.lastLocation || !this.technicianId) {
      return;
    }

    try {
      // Get battery level if available
      let batteryLevel: number | undefined;
      try {
        // @ts-ignore - Battery API might not be available
        const battery = await navigator.getBattery?.();
        if (battery) {
          batteryLevel = Math.round(battery.level * 100);
        }
      } catch {
        // Battery API not available, ignore
      }

      await techApi.updateLocation(this.technicianId, {
        latitude: this.lastLocation.latitude,
        longitude: this.lastLocation.longitude,
        accuracy: this.lastLocation.accuracy,
        speed: this.lastLocation.speed,
        heading: this.lastLocation.heading,
        altitude: this.lastLocation.altitude,
        battery_level: batteryLevel,
        installation_id: this.currentInstallationId ?? undefined
      });

      console.log('[GPS] Location sent successfully');
    } catch (error) {
      console.error('[GPS] Failed to send location:', error);
    }
  }

  private notifyCallbacks(location: LocationData | null, error?: string): void {
    this.callbacks.forEach(callback => {
      try {
        callback(location, error);
      } catch (e) {
        console.error('[GPS] Callback error:', e);
      }
    });
  }

  private getErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Permiso de ubicación denegado';
      case error.POSITION_UNAVAILABLE:
        return 'Ubicación no disponible';
      case error.TIMEOUT:
        return 'Tiempo de espera agotado';
      default:
        return 'Error de ubicación desconocido';
    }
  }
}

// Singleton instance
export const locationTracker = new LocationTrackingService();
