import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { systemActivityLogs, LOG_ACTIONS, LOG_CATEGORIES, LOG_SEVERITIES } from '@shared/schema';
import type { InsertSystemActivityLog } from '@shared/schema';

interface User {
  id: number;
  role: string;
  email: string;
  fullName?: string;
  username?: string;
}

interface LocationContext {
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  ispName?: string;
  connectionType?: string;
}

interface LogContext {
  user?: User;
  action: string;
  actionCategory: string;
  actionDescription: string;
  targetType?: string;
  targetId?: number;
  targetName?: string;
  jobId?: number;
  companyId?: number;
  details?: Record<string, any>;
  severity?: string;
  isSystemAction?: boolean;
  isSuccessful?: boolean;
  errorMessage?: string;
  // Location data (can be provided by client or detected server-side)
  location?: LocationContext;
}

class AuditLoggingService {
  /**
   * Create a comprehensive audit log entry
   */
  async createLog(
    logContext: LogContext,
    request?: Request,
    response?: Response
  ): Promise<void> {
    try {
      const logEntry: InsertSystemActivityLog = {
        // User information
        userId: logContext.user?.id,
        userRole: logContext.user?.role,
        userEmail: logContext.user?.email,
        userName: logContext.user?.fullName || logContext.user?.username,
        
        // Action details
        action: logContext.action,
        actionCategory: logContext.actionCategory,
        actionDescription: logContext.actionDescription,
        
        // Context information
        targetType: logContext.targetType,
        targetId: logContext.targetId,
        targetName: logContext.targetName,
        
        // Related entities
        jobId: logContext.jobId,
        companyId: logContext.companyId,
        
        // Request/Response details (if available)
        requestMethod: request?.method,
        requestPath: request?.path,
        requestBody: this.filterSensitiveData(request?.body),
        responseStatus: response?.statusCode,
        
        // Additional metadata
        details: logContext.details,
        ipAddress: this.getClientIP(request),
        userAgent: request?.get('user-agent'),
        sessionId: request?.sessionID,
        
        // Location and geolocation data
        latitude: logContext.location?.latitude,
        longitude: logContext.location?.longitude,
        locationAccuracy: logContext.location?.locationAccuracy,
        city: logContext.location?.city,
        state: logContext.location?.state,
        country: logContext.location?.country,
        timezone: logContext.location?.timezone || this.getTimezoneFromRequest(request),
        ispName: logContext.location?.ispName,
        connectionType: logContext.location?.connectionType,
        
        // Status and flags
        severity: logContext.severity || LOG_SEVERITIES.INFO,
        isSystemAction: logContext.isSystemAction || false,
        isSuccessful: logContext.isSuccessful !== false,
        errorMessage: logContext.errorMessage,
      };

      await db.insert(systemActivityLogs).values(logEntry);
    } catch (error) {
      console.error('Failed to create audit log entry:', error);
    }
  }

  /**
   * Middleware to automatically log API requests
   */
  auditMiddleware() {
    return (req: Request & { user?: User }, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      const startTime = Date.now();

      res.send = function(data: any) {
        const duration = Date.now() - startTime;
        
        setImmediate(() => {
          auditLoggingService.logApiRequest(req, res, duration, data);
        });

        return originalSend.call(this, data);
      };

      next();
    };
  }

  /**
   * Log API requests with intelligent categorization
   */
  private async logApiRequest(
    req: Request & { user?: User },
    res: Response,
    duration: number,
    responseData?: any
  ): Promise<void> {
    if (this.shouldSkipLogging(req.path)) {
      return;
    }

    const action = this.categorizeApiAction(req);
    const actionDescription = this.generateActionDescription(req, res, action);
    
    await this.createLog({
      user: req.user,
      action: action.action,
      actionCategory: action.category,
      actionDescription,
      targetType: action.targetType,
      targetId: action.targetId,
      targetName: action.targetName,
      jobId: action.jobId,
      companyId: action.companyId,
      details: {
        duration,
        responseSize: JSON.stringify(responseData || {}).length,
        queryParams: req.query,
        ...action.additionalDetails
      },
      severity: this.determineSeverity(req, res),
      isSuccessful: res.statusCode < 400,
      errorMessage: res.statusCode >= 400 ? this.extractErrorMessage(responseData) : undefined,
    }, req, res);
  }

  private shouldSkipLogging(path: string): boolean {
    const skipPaths = ['/health', '/ping', '/favicon.ico', '/api/auth/verify', '/assets/', '/static/', '/public/'];
    return skipPaths.some(skipPath => path.startsWith(skipPath));
  }

  private categorizeApiAction(req: Request & { user?: User }): {
    action: string;
    category: string;
    targetType?: string;
    targetId?: number;
    targetName?: string;
    jobId?: number;
    companyId?: number;
    additionalDetails?: Record<string, any>;
  } {
    const { method, path } = req;
    const pathSegments = path.split('/').filter(Boolean);

    if (path.includes('/auth/login')) {
      return { action: LOG_ACTIONS.LOGIN, category: LOG_CATEGORIES.AUTHENTICATION };
    }

    if (path.includes('/auth/logout')) {
      return { action: LOG_ACTIONS.LOGOUT, category: LOG_CATEGORIES.AUTHENTICATION };
    }

    if (path.includes('/api/jobs')) {
      const jobId = this.extractIdFromPath(pathSegments, 'jobs');
      
      if (method === 'POST' && path === '/api/jobs') {
        return {
          action: LOG_ACTIONS.JOB_CREATED,
          category: LOG_CATEGORIES.JOB_MANAGEMENT,
          targetType: 'job'
        };
      }

      if (method === 'PUT' && jobId) {
        return {
          action: LOG_ACTIONS.JOB_UPDATED,
          category: LOG_CATEGORIES.JOB_MANAGEMENT,
          targetType: 'job',
          targetId: jobId,
          jobId
        };
      }

      if (path.includes('/assign')) {
        return {
          action: LOG_ACTIONS.JOB_ASSIGNED,
          category: LOG_CATEGORIES.JOB_MANAGEMENT,
          targetType: 'job',
          targetId: jobId,
          jobId
        };
      }
    }

    if (path.includes('/api/users') || path.includes('/api/admin/users')) {
      const userId = this.extractIdFromPath(pathSegments, 'users');

      if (method === 'POST' && path.includes('/approve')) {
        return {
          action: LOG_ACTIONS.USER_APPROVED,
          category: LOG_CATEGORIES.USER_MANAGEMENT,
          targetType: 'user',
          targetId: userId
        };
      }

      if (method === 'POST' && path.includes('/register')) {
        return {
          action: LOG_ACTIONS.USER_REGISTERED,
          category: LOG_CATEGORIES.USER_MANAGEMENT,
          targetType: 'user'
        };
      }
    }

    if (path.includes('/api/companies')) {
      const companyId = this.extractIdFromPath(pathSegments, 'companies');

      if (method === 'POST' && path.includes('/approve')) {
        return {
          action: LOG_ACTIONS.COMPANY_APPROVED,
          category: LOG_CATEGORIES.COMPANY_MANAGEMENT,
          targetType: 'company',
          targetId: companyId,
          companyId
        };
      }

      if (method === 'POST' && !companyId) {
        return {
          action: LOG_ACTIONS.COMPANY_REGISTERED,
          category: LOG_CATEGORIES.COMPANY_MANAGEMENT,
          targetType: 'company'
        };
      }
    }

    return {
      action: `${method.toLowerCase()}_${pathSegments[1] || 'unknown'}`,
      category: LOG_CATEGORIES.SYSTEM_ADMIN
    };
  }

  private extractIdFromPath(pathSegments: string[], entityType: string): number | undefined {
    const entityIndex = pathSegments.findIndex(segment => segment === entityType);
    if (entityIndex !== -1 && pathSegments[entityIndex + 1]) {
      const id = parseInt(pathSegments[entityIndex + 1]);
      return isNaN(id) ? undefined : id;
    }
    return undefined;
  }

  private generateActionDescription(
    req: Request & { user?: User },
    res: Response,
    action: { action: string; category: string }
  ): string {
    const userIdentifier = req.user?.fullName || req.user?.username || req.user?.email || 'Unknown user';
    
    const actionDescriptions: Record<string, string> = {
      [LOG_ACTIONS.LOGIN]: `${userIdentifier} logged in`,
      [LOG_ACTIONS.LOGOUT]: `${userIdentifier} logged out`,
      [LOG_ACTIONS.JOB_CREATED]: `${userIdentifier} created a new job`,
      [LOG_ACTIONS.JOB_ASSIGNED]: `${userIdentifier} assigned a job to a notary`,
      [LOG_ACTIONS.USER_APPROVED]: `${userIdentifier} approved a user`,
      [LOG_ACTIONS.COMPANY_APPROVED]: `${userIdentifier} approved a company`,
    };

    return actionDescriptions[action.action] || `${userIdentifier} performed ${req.method} ${req.path}`;
  }

  private determineSeverity(req: Request, res: Response): string {
    if (res.statusCode >= 500) return LOG_SEVERITIES.CRITICAL;
    if (res.statusCode >= 400) return LOG_SEVERITIES.ERROR;
    if (res.statusCode >= 300) return LOG_SEVERITIES.WARNING;
    return LOG_SEVERITIES.INFO;
  }

  private extractErrorMessage(responseData: any): string | undefined {
    if (typeof responseData === 'object' && responseData !== null) {
      return responseData.error || responseData.message || 'Unknown error';
    }
    return undefined;
  }

  private filterSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = ['password', 'confirmPassword', 'token', 'secret'];
    const filtered = { ...data };
    
    for (const field of sensitiveFields) {
      if (field in filtered) {
        filtered[field] = '[REDACTED]';
      }
    }

    return filtered;
  }

  private getClientIP(req?: Request): string | undefined {
    if (!req) return undefined;
    return req.ip || req.connection?.remoteAddress || req.get('x-forwarded-for')?.split(',')[0];
  }

  /**
   * Extract timezone from request headers
   */
  private getTimezoneFromRequest(req?: Request): string | undefined {
    if (!req) return undefined;
    
    // Try to get timezone from custom header (if client sends it)
    const timezoneHeader = req.get('x-timezone') || req.get('timezone');
    if (timezoneHeader) return timezoneHeader;
    
    // Try to extract from Accept-Language header (basic fallback)
    const acceptLanguage = req.get('accept-language');
    if (acceptLanguage) {
      // This is a very basic extraction - in production you'd want a proper timezone mapping
      if (acceptLanguage.includes('en-US')) return 'America/New_York';
      if (acceptLanguage.includes('en-GB')) return 'Europe/London';
      if (acceptLanguage.includes('en-AU')) return 'Australia/Sydney';
    }
    
    return undefined;
  }

  /**
   * Detect connection type from User-Agent
   */
  private getConnectionTypeFromUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;
    
    // Basic mobile detection
    if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
      return 'mobile';
    }
    
    return 'broadband';
  }

  /**
   * Enhanced location detection for server-side logging
   */
  private async getServerSideLocation(req?: Request): Promise<LocationContext> {
    const location: LocationContext = {};
    
    if (!req) return location;
    
    // Get basic info from request
    location.timezone = this.getTimezoneFromRequest(req);
    location.connectionType = this.getConnectionTypeFromUserAgent(req.get('user-agent'));
    
    // In a production environment, you could:
    // 1. Use a premium IP geolocation service
    // 2. Cache location data for IP addresses
    // 3. Use GeoIP databases for offline lookup
    
    return location;
  }

  async logUserAction(
    user: User,
    action: string,
    description: string,
    context?: {
      targetType?: string;
      targetId?: number;
      targetName?: string;
      jobId?: number;
      companyId?: number;
      details?: Record<string, any>;
      severity?: string;
    }
  ): Promise<void> {
    await this.createLog({
      user,
      action,
      actionCategory: this.getActionCategory(action),
      actionDescription: description,
      ...context
    });
  }

  private getActionCategory(action: string): string {
    if (action.includes('login') || action.includes('logout')) return LOG_CATEGORIES.AUTHENTICATION;
    if (action.includes('job')) return LOG_CATEGORIES.JOB_MANAGEMENT;
    if (action.includes('user')) return LOG_CATEGORIES.USER_MANAGEMENT;
    if (action.includes('company')) return LOG_CATEGORIES.COMPANY_MANAGEMENT;
    if (action.includes('document')) return LOG_CATEGORIES.DOCUMENT_MANAGEMENT;
    if (action.includes('payment')) return LOG_CATEGORIES.PAYMENT;
    if (action.includes('verification')) return LOG_CATEGORIES.VERIFICATION;
    return LOG_CATEGORIES.SYSTEM_ADMIN;
  }
}

export const auditLoggingService = new AuditLoggingService();
export default auditLoggingService; 