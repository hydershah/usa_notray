import { locationService, LocationData } from './location-service';
import fetch from 'node-fetch';

class EnhancedLocationService {
  private readonly USE_REAL_IP_FOR_TESTING = process.env.FORCE_REAL_IP_COORDINATES === 'true';

  /**
   * Get comprehensive location data with optional real IP override for testing
   */
  async getComprehensiveLocationData(req: any, forceRealIP: boolean = false): Promise<{
    ip: string;
    location: LocationData;
    userAgent: string;
    deviceInfo: {
      browser?: string;
      os?: string;
      device?: string;
      mobile?: boolean;
    };
    timestamp: Date;
  }> {
    let ip = locationService.extractClientIP(req);
    
    // If localhost and we want real coordinates, get external IP
    if ((forceRealIP || this.USE_REAL_IP_FOR_TESTING) && locationService['isLocalIP'](ip)) {
      try {
        console.log('🌐 Localhost detected - fetching real external IP for coordinate tracking...');
        const realIP = await this.getRealExternalIP();
        if (realIP && !locationService['isLocalIP'](realIP)) {
          console.log(`📡 Using real external IP: ${realIP} instead of localhost`);
          ip = realIP;
        }
      } catch (error) {
        console.error('⚠️ Failed to get real external IP:', error.message);
      }
    }

    const userAgent = req.get('user-agent') || 'Unknown';
    const location = await locationService.getLocationData(ip);

    return {
      ip,
      location,
      userAgent,
      deviceInfo: this.parseUserAgent(userAgent),
      timestamp: new Date()
    };
  }

  /**
   * Get real external IP address
   */
  private async getRealExternalIP(): Promise<string | null> {
    try {
      const response = await fetch('https://api.ipify.org?format=json', { timeout: 5000 });
      const data = await response.json() as { ip: string };
      return data.ip;
    } catch (error) {
      // Fallback to another service
      try {
        const response = await fetch('https://httpbin.org/ip', { timeout: 5000 });
        const data = await response.json() as { origin: string };
        return data.origin.split(',')[0].trim();
      } catch {
        return null;
      }
    }
  }

  /**
   * Parse user agent string to extract device information
   */
  private parseUserAgent(userAgent: string): {
    browser?: string;
    os?: string;
    device?: string;
    mobile?: boolean;
  } {
    const mobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
    
    let browser = 'Unknown';
    let os = 'Unknown';
    let device = 'Desktop';

    // Browser detection
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    else if (userAgent.includes('Opera')) browser = 'Opera';

    // OS detection
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Mac OS X')) os = 'macOS';
    else if (userAgent.includes('Linux')) os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (userAgent.includes('iOS')) os = 'iOS';

    // Device detection
    if (userAgent.includes('iPhone')) device = 'iPhone';
    else if (userAgent.includes('iPad')) device = 'iPad';
    else if (userAgent.includes('Android')) device = 'Android Device';
    else if (mobile) device = 'Mobile Device';

    return {
      browser,
      os,
      device,
      mobile
    };
  }

  /**
   * Force coordinate capture for next login (testing mode)
   */
  enableCoordinateCaptureForTesting(): void {
    process.env.FORCE_REAL_IP_COORDINATES = 'true';
    console.log('🔧 Coordinate capture enabled for localhost testing');
  }

  /**
   * Disable coordinate capture forcing (production mode)
   */
  disableCoordinateCaptureForTesting(): void {
    process.env.FORCE_REAL_IP_COORDINATES = 'false';
    console.log('🔧 Coordinate capture disabled - using normal IP detection');
  }
}

export const enhancedLocationService = new EnhancedLocationService();
export default enhancedLocationService; 