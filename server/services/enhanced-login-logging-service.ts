import { Request } from 'express';
import { auditLoggingService } from './audit-logging-service';
import { locationService, LocationData } from './location-service';
import { enhancedLocationService } from './enhanced-location-service';
import { LOG_ACTIONS, LOG_CATEGORIES, LOG_SEVERITIES } from '@shared/schema';

interface LoginUser {
  id: number;
  email: string;
  username?: string | null;
  fullName?: string | null;
  role: string;
  privileges?: string[];
}

interface LoginAttemptData {
  user?: LoginUser;
  email: string;
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
  success: boolean;
  failureReason?: string;
  twoFactorRequired?: boolean;
  sessionId?: string;
}

class EnhancedLoginLoggingService {
  /**
   * Log a comprehensive login attempt with full details
   */
  async logLoginAttempt(
    req: Request & { user?: LoginUser; sessionID?: string },
    loginData: {
      user?: LoginUser;
      email: string;
      success: boolean;
      failureReason?: string;
      twoFactorRequired?: boolean;
    }
  ): Promise<void> {
    try {
      // Get comprehensive location and device data (with optional real IP for coordinates)
      const comprehensiveData = await enhancedLocationService.getComprehensiveLocationData(req, true);
      
      const loginAttemptData: LoginAttemptData = {
        user: loginData.user,
        email: loginData.email,
        ip: comprehensiveData.ip,
        location: comprehensiveData.location,
        userAgent: comprehensiveData.userAgent,
        deviceInfo: comprehensiveData.deviceInfo,
        timestamp: comprehensiveData.timestamp,
        success: loginData.success,
        failureReason: loginData.failureReason,
        twoFactorRequired: loginData.twoFactorRequired,
        sessionId: req.sessionID
      };

      // Log to console for immediate visibility
      this.logToConsole(loginAttemptData);

      // Log to audit system
      await this.logToAuditSystem(loginAttemptData, req);

      // Log to specialized login tracking if needed
      await this.logToLoginTracking(loginAttemptData);

    } catch (error) {
      console.error('❌ Failed to log login attempt:', error);
    }
  }

  /**
   * Log successful login with full details
   */
  async logSuccessfulLogin(
    req: Request & { user?: LoginUser; sessionID?: string },
    user: LoginUser
  ): Promise<void> {
    await this.logLoginAttempt(req, {
      user,
      email: user.email,
      success: true
    });
  }

  /**
   * Log failed login attempt with reason
   */
  async logFailedLogin(
    req: Request & { sessionID?: string },
    email: string,
    reason: string
  ): Promise<void> {
    await this.logLoginAttempt(req, {
      email,
      success: false,
      failureReason: reason
    });
  }

  /**
   * Log 2FA required login attempt
   */
  async logTwoFactorRequired(
    req: Request & { user?: LoginUser; sessionID?: string },
    user: LoginUser
  ): Promise<void> {
    await this.logLoginAttempt(req, {
      user,
      email: user.email,
      success: true,
      twoFactorRequired: true
    });
  }

  /**
   * Log to console with formatted output
   */
  private logToConsole(data: LoginAttemptData): void {
    const status = data.success ? '✅ LOGIN SUCCESS' : '❌ LOGIN FAILED';
    const twoFactor = data.twoFactorRequired ? ' (2FA Required)' : '';
    
    console.log(`\n🔐 ${status}${twoFactor}`);
    console.log(`📧 Email: ${data.email}`);
    console.log(`👤 User: ${data.user?.fullName || data.user?.username || 'Unknown'} (ID: ${data.user?.id || 'N/A'})`);
    console.log(`🌐 IP: ${data.ip}`);
    console.log(`📍 Location: ${data.location.city}, ${data.location.region}, ${data.location.country} (${data.location.countryCode})`);
    console.log(`🌍 ISP: ${data.location.isp}`);
    console.log(`📱 Device: ${data.deviceInfo.device} - ${data.deviceInfo.browser} on ${data.deviceInfo.os}`);
    console.log(`🕒 Time: ${data.timestamp.toLocaleString()}`);
    
    if (data.failureReason) {
      console.log(`❌ Failure Reason: ${data.failureReason}`);
    }
    
    if (data.location.proxy) {
      console.log(`⚠️  WARNING: Proxy/VPN detected`);
    }
    
    if (data.location.hosting) {
      console.log(`⚠️  WARNING: Hosting provider IP detected`);
    }
    
    console.log('─'.repeat(80));
  }

  /**
   * Log to audit system using existing audit logging service
   */
  private async logToAuditSystem(
    data: LoginAttemptData,
    req: Request
  ): Promise<void> {
    const action = data.success ? LOG_ACTIONS.LOGIN : LOG_ACTIONS.LOGIN_FAILED;
    const severity = data.success ? LOG_SEVERITIES.INFO : LOG_SEVERITIES.WARNING;
    
    let description = `${data.email} login ${data.success ? 'successful' : 'failed'}`;
    if (data.twoFactorRequired) {
      description += ' (2FA required)';
    }
    if (data.failureReason) {
      description += ` - ${data.failureReason}`;
    }
    description += ` from ${data.location.city}, ${data.location.country}`;

    // Add warning flags for suspicious activity
    const warnings = [];
    if (data.location.proxy) warnings.push('Proxy/VPN');
    if (data.location.hosting) warnings.push('Hosting Provider');
    if (warnings.length > 0) {
      description += ` [WARNING: ${warnings.join(', ')}]`;
    }

    await auditLoggingService.createLog({
      user: data.user,
      action,
      actionCategory: LOG_CATEGORIES.AUTHENTICATION,
      actionDescription: description,
      details: {
        loginAttempt: {
          email: data.email,
          success: data.success,
          failureReason: data.failureReason,
          twoFactorRequired: data.twoFactorRequired,
          location: {
            city: data.location.city,
            region: data.location.region,
            country: data.location.country,
            countryCode: data.location.countryCode,
            timezone: data.location.timezone,
            coordinates: data.location.latitude && data.location.longitude ? 
              `${data.location.latitude},${data.location.longitude}` : undefined,
            isp: data.location.isp,
            org: data.location.org,
            proxy: data.location.proxy,
            hosting: data.location.hosting,
            mobile: data.location.mobile
          },
          device: {
            browser: data.deviceInfo.browser,
            os: data.deviceInfo.os,
            device: data.deviceInfo.device,
            mobile: data.deviceInfo.mobile,
            userAgent: data.userAgent
          },
          security: {
            sessionId: data.sessionId,
            timestamp: data.timestamp.toISOString(),
            ipAddress: data.ip,
            riskFlags: {
              proxy: data.location.proxy || false,
              hosting: data.location.hosting || false,
              mobile: data.deviceInfo.mobile || false
            }
          }
        }
      },
      severity,
      isSuccessful: data.success,
      errorMessage: data.failureReason
    }, req);
  }

  /**
   * Log to specialized login tracking (can be extended for additional storage)
   */
  private async logToLoginTracking(data: LoginAttemptData): Promise<void> {
    // This could be extended to log to a separate login tracking table
    // or external security monitoring system
    
    console.log(`📊 Login tracking: ${data.success ? 'SUCCESS' : 'FAILURE'} for ${data.email} from ${data.ip}`);
  }

  /**
   * Get recent login attempts for a specific user
   */
  async getRecentLoginAttempts(userId: number, limit: number = 10): Promise<any[]> {
    // This would query the audit logs for recent login attempts
    // For now, return empty array as this would require database integration
    console.log(`🔍 Fetching recent login attempts for user ${userId} (limit: ${limit})`);
    return [];
  }

  /**
   * Get login statistics for security monitoring
   */
  async getLoginStatistics(timeframe: 'hour' | 'day' | 'week' = 'day'): Promise<{
    successful: number;
    failed: number;
    unique_ips: number;
    countries: string[];
    risk_flags: number;
  }> {
    // This would analyze audit logs to provide security statistics
    console.log(`📈 Generating login statistics for ${timeframe}`);
    
    return {
      successful: 0,
      failed: 0,
      unique_ips: 0,
      countries: [],
      risk_flags: 0
    };
  }

  /**
   * Check for suspicious login patterns
   */
  async checkSuspiciousActivity(data: LoginAttemptData): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskScore: number;
  }> {
    const reasons: string[] = [];
    let riskScore = 0;

    // Check for proxy/VPN usage
    if (data.location.proxy) {
      reasons.push('Proxy/VPN detected');
      riskScore += 30;
    }

    // Check for hosting provider IPs
    if (data.location.hosting) {
      reasons.push('Hosting provider IP');
      riskScore += 25;
    }

    // Check for unusual locations (this would require historical data)
    // For now, just check for certain high-risk countries
    const highRiskCountries = ['CN', 'RU', 'IR', 'KP'];
    if (data.location.countryCode && highRiskCountries.includes(data.location.countryCode)) {
      reasons.push('High-risk country');
      riskScore += 20;
    }

    // Check for failed login attempts
    if (!data.success) {
      riskScore += 10;
    }

    const isSuspicious = riskScore >= 40;

    if (isSuspicious) {
      console.log(`🚨 SUSPICIOUS LOGIN ACTIVITY DETECTED:`);
      console.log(`   Email: ${data.email}`);
      console.log(`   IP: ${data.ip}`);
      console.log(`   Risk Score: ${riskScore}`);
      console.log(`   Reasons: ${reasons.join(', ')}`);
    }

    return {
      isSuspicious,
      reasons,
      riskScore
    };
  }
}

export const enhancedLoginLoggingService = new EnhancedLoginLoggingService();
export default enhancedLoginLoggingService; 