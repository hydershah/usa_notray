/**
 * LocationService - Handle geolocation and location tracking for user activities
 */

interface LocationData {
  // GPS coordinates (when available)
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  
  // IP-based location (fallback)
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  ispName?: string;
  connectionType?: string;
  
  // Metadata
  source: 'gps' | 'ip' | 'unknown';
  timestamp: Date;
}

interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  timestamp: number;
}

class LocationService {
  private currentLocation: LocationData | null = null;
  private locationPromise: Promise<LocationData> | null = null;

  /**
   * Get current location with GPS fallback to IP-based detection
   */
  async getCurrentLocation(): Promise<LocationData> {
    // Return cached location if available and recent (within 5 minutes)
    if (this.currentLocation && 
        (Date.now() - this.currentLocation.timestamp.getTime()) < 5 * 60 * 1000) {
      return this.currentLocation;
    }

    // Avoid multiple concurrent location requests
    if (this.locationPromise) {
      return this.locationPromise;
    }

    this.locationPromise = this.fetchLocation();
    const location = await this.locationPromise;
    this.locationPromise = null;
    
    this.currentLocation = location;
    return location;
  }

  /**
   * Private method to fetch location data
   */
  private async fetchLocation(): Promise<LocationData> {
    // Try GPS first
    try {
      const gpsLocation = await this.getGPSLocation();
      return {
        ...gpsLocation,
        source: 'gps',
        timestamp: new Date()
      };
    } catch (gpsError) {
      console.warn('GPS location failed, falling back to IP location:', gpsError);
    }

    // Fallback to IP-based location
    try {
      const ipLocation = await this.getIPLocation();
      return {
        ...ipLocation,
        source: 'ip',
        timestamp: new Date()
      };
    } catch (ipError) {
      console.warn('IP location failed:', ipError);
    }

    // Return unknown location
    return {
      source: 'unknown',
      timestamp: new Date()
    };
  }

  /**
   * Get GPS location from browser geolocation API
   */
  private getGPSLocation(): Promise<Partial<LocationData>> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000, // 10 seconds timeout
        maximumAge: 5 * 60 * 1000 // Use cached position if less than 5 minutes old
      };

      navigator.geolocation.getCurrentPosition(
        (position: GeolocationPosition) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          reject(new Error(`GPS location error: ${error.message}`));
        },
        options
      );
    });
  }

  /**
   * Get IP-based location and connection info
   */
  private async getIPLocation(): Promise<Partial<LocationData>> {
    try {
      // Using ipapi.co for IP geolocation (free tier: 1000 requests/day)
      const response = await fetch('https://ipapi.co/json/', {
        timeout: 5000
      } as RequestInit);

      if (!response.ok) {
        throw new Error(`IP location API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        city: data.city,
        state: data.region,
        country: data.country_name,
        timezone: data.timezone,
        ispName: data.org,
        connectionType: this.getConnectionType()
      };
    } catch (error) {
      console.warn('IP location API failed:', error);
      
      // Fallback: get basic timezone from browser
      return {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        connectionType: this.getConnectionType()
      };
    }
  }

  /**
   * Detect connection type from browser
   */
  private getConnectionType(): string {
    // Check for Network Information API (experimental)
    const navigator = window.navigator as any;
    if (navigator.connection) {
      const connection = navigator.connection;
      
      // Map effective types to readable names
      switch (connection.effectiveType) {
        case 'slow-2g':
        case '2g':
          return 'mobile-2g';
        case '3g':
          return 'mobile-3g';
        case '4g':
          return 'mobile-4g';
        default:
          return connection.type || 'unknown';
      }
    }

    // Fallback: detect mobile vs desktop
    const userAgent = navigator.userAgent;
    if (/Mobi|Android/i.test(userAgent)) {
      return 'mobile';
    }
    
    return 'broadband';
  }

  /**
   * Request location permission
   */
  async requestLocationPermission(): Promise<boolean> {
    if (!navigator.geolocation) {
      return false;
    }

    try {
      // Check current permission status
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        if (permission.state === 'granted') {
          return true;
        }
        if (permission.state === 'denied') {
          return false;
        }
      }

      // Try to get location (this will prompt for permission)
      await this.getGPSLocation();
      return true;
    } catch (error) {
      console.warn('Location permission request failed:', error);
      return false;
    }
  }

  /**
   * Get location for activity logging
   */
  async getLocationForLogging(): Promise<Partial<LocationData>> {
    try {
      const location = await this.getCurrentLocation();
      
      // Return only the fields we want to log
      return {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        city: location.city,
        state: location.state,
        country: location.country,
        timezone: location.timezone,
        ispName: location.ispName,
        connectionType: location.connectionType
      };
    } catch (error) {
      console.warn('Failed to get location for logging:', error);
      
      // Return minimal fallback data
      return {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        connectionType: this.getConnectionType()
      };
    }
  }
}

// Export singleton instance
export const locationService = new LocationService();
export type { LocationData }; 