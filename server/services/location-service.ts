import fetch from 'node-fetch';

export interface LocationData {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  continent?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  org?: string;
  as?: string;
  asName?: string;
  proxy?: boolean;
  hosting?: boolean;
  mobile?: boolean;
  query?: string;
  status?: string;
  message?: string;
}

interface IPInfoResponse {
  ip: string;
  city?: string;
  region?: string;
  country?: string;
  loc?: string;
  org?: string;
  timezone?: string;
  postal?: string;
  readme?: string;
}

interface IPAPIResponse {
  query: string;
  status: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  proxy?: boolean;
  hosting?: boolean;
  mobile?: boolean;
  message?: string;
}

class LocationService {
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private cache = new Map<string, { data: LocationData; timestamp: number }>();

  /**
   * Get location data for an IP address using multiple fallback services
   */
  async getLocationData(ip: string): Promise<LocationData> {
    // Return localhost data for local IPs
    if (this.isLocalIP(ip)) {
      return {
        ip,
        city: 'Local',
        region: 'Local',
        country: 'Local',
        countryCode: 'XX',
        isp: 'Local Network',
        org: 'Local Network'
      };
    }

    // Check cache first
    const cached = this.cache.get(ip);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      console.log(`📍 Location data retrieved from cache for IP: ${ip}`);
      return cached.data;
    }

    try {
      // Try ip-api.com first (free, no API key required)
      let locationData = await this.getFromIPAPI(ip);
      
      if (!locationData || locationData.status === 'fail') {
        // Fallback to ipinfo.io
        locationData = await this.getFromIPInfo(ip);
      }

      if (!locationData) {
        // Final fallback with basic data
        locationData = {
          ip,
          city: 'Unknown',
          region: 'Unknown',
          country: 'Unknown',
          countryCode: 'XX',
          isp: 'Unknown',
          org: 'Unknown'
        };
      }

      // Cache the result
      this.cache.set(ip, {
        data: locationData,
        timestamp: Date.now()
      });

      console.log(`📍 Location data retrieved for IP ${ip}: ${locationData.city}, ${locationData.region}, ${locationData.country}`);
      return locationData;
    } catch (error) {
      console.error('Error getting location data:', error);
      return {
        ip,
        city: 'Error',
        region: 'Error',
        country: 'Error',
        countryCode: 'XX',
        isp: 'Error',
        org: 'Error'
      };
    }
  }

  /**
   * Get location data from ip-api.com (free service)
   */
  private async getFromIPAPI(ip: string): Promise<LocationData | null> {
    try {
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,proxy,hosting,mobile,query`, {
        timeout: 5000
      });

      if (!response.ok) {
        console.log(`❌ ip-api.com request failed: ${response.status}`);
        return null;
      }

      const data: IPAPIResponse = await response.json();

      if (data.status === 'fail') {
        console.log(`❌ ip-api.com returned failure: ${data.message}`);
        return null;
      }

      return {
        ip: data.query,
        city: data.city,
        region: data.regionName,
        country: data.country,
        countryCode: data.countryCode,
        timezone: data.timezone,
        latitude: data.lat,
        longitude: data.lon,
        isp: data.isp,
        org: data.org,
        as: data.as,
        proxy: data.proxy,
        hosting: data.hosting,
        mobile: data.mobile,
        status: data.status
      };
    } catch (error) {
      console.error('Error fetching from ip-api.com:', error);
      return null;
    }
  }

  /**
   * Get location data from ipinfo.io (free tier)
   */
  private async getFromIPInfo(ip: string): Promise<LocationData | null> {
    try {
      const response = await fetch(`https://ipinfo.io/${ip}/json`, {
        timeout: 5000
      });

      if (!response.ok) {
        console.log(`❌ ipinfo.io request failed: ${response.status}`);
        return null;
      }

      const data: IPInfoResponse = await response.json();

      let latitude: number | undefined;
      let longitude: number | undefined;

      if (data.loc) {
        const [lat, lon] = data.loc.split(',').map(parseFloat);
        latitude = lat;
        longitude = lon;
      }

      return {
        ip: data.ip,
        city: data.city,
        region: data.region,
        country: data.country,
        timezone: data.timezone,
        latitude,
        longitude,
        org: data.org,
        isp: data.org // ipinfo.io uses 'org' field for ISP info
      };
    } catch (error) {
      console.error('Error fetching from ipinfo.io:', error);
      return null;
    }
  }

  /**
   * Check if an IP address is local/private
   */
  private isLocalIP(ip: string): boolean {
    // Remove IPv4-mapped IPv6 prefix if present
    const cleanIP = ip.replace(/^::ffff:/, '');
    
    return (
      cleanIP === 'localhost' ||
      cleanIP === '127.0.0.1' ||
      cleanIP === '::1' ||
      cleanIP.startsWith('192.168.') ||
      cleanIP.startsWith('10.') ||
      cleanIP.startsWith('172.16.') ||
      cleanIP.startsWith('172.17.') ||
      cleanIP.startsWith('172.18.') ||
      cleanIP.startsWith('172.19.') ||
      cleanIP.startsWith('172.2') ||
      cleanIP.startsWith('172.30.') ||
      cleanIP.startsWith('172.31.') ||
      cleanIP === '0.0.0.0'
    );
  }

  /**
   * Extract client IP address from request headers
   */
  extractClientIP(req: any): string {
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip'];
    const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;

    // Priority order for IP extraction
    let ip = cfConnectingIP || forwarded || realIP || remoteAddress;

    // Handle comma-separated forwarded IPs (take the first one)
    if (typeof ip === 'string' && ip.includes(',')) {
      ip = ip.split(',')[0].trim();
    }

    // Clean up IPv6 formatting
    if (ip && ip.includes('::ffff:')) {
      ip = ip.replace('::ffff:', '');
    }



    return ip || '0.0.0.0';
  }

  /**
   * Get comprehensive location data with device information
   */
  async getComprehensiveLoginData(req: any): Promise<{
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
    const ip = this.extractClientIP(req);
    const userAgent = req.get('user-agent') || 'Unknown';
    const location = await this.getLocationData(ip);

    return {
      ip,
      location,
      userAgent,
      deviceInfo: this.parseUserAgent(userAgent),
      timestamp: new Date()
    };
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
   * Clear the cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('📍 Location service cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

export const locationService = new LocationService();
export default locationService; 