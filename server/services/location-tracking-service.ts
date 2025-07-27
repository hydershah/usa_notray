import { Request, Response } from 'express';
import { auditLoggingService } from './audit-logging-service';
import { LOG_ACTIONS, LOG_CATEGORIES } from '@shared/schema';

interface User {
  id: number;
  email: string;
  role: string;
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

/**
 * LocationTrackingService - Handle location-aware activity tracking
 */
class LocationTrackingService {
  
  /**
   * Extract location data from request headers and body
   */
  private extractLocationFromRequest(req: Request): LocationContext {
    const location: LocationContext = {};
    
    // Extract from custom headers (sent by client LocationService)
    location.latitude = req.get('x-latitude') ? parseFloat(req.get('x-latitude')!) : undefined;
    location.longitude = req.get('x-longitude') ? parseFloat(req.get('x-longitude')!) : undefined;
    location.locationAccuracy = req.get('x-location-accuracy') ? parseFloat(req.get('x-location-accuracy')!) : undefined;
    location.city = req.get('x-city') || undefined;
    location.state = req.get('x-state') || undefined;
    location.country = req.get('x-country') || undefined;
    location.timezone = req.get('x-timezone') || req.get('timezone') || undefined;
    location.ispName = req.get('x-isp-name') || undefined;
    location.connectionType = req.get('x-connection-type') || this.detectConnectionType(req.get('user-agent'));
    
    // Fallback: extract from request body if provided
    if (req.body?.location) {
      const bodyLocation = req.body.location;
      location.latitude = location.latitude || bodyLocation.latitude;
      location.longitude = location.longitude || bodyLocation.longitude;
      location.locationAccuracy = location.locationAccuracy || bodyLocation.accuracy;
      location.city = location.city || bodyLocation.city;
      location.state = location.state || bodyLocation.state;
      location.country = location.country || bodyLocation.country;
      location.timezone = location.timezone || bodyLocation.timezone;
      location.ispName = location.ispName || bodyLocation.ispName;
      location.connectionType = location.connectionType || bodyLocation.connectionType;
    }
    
    return location;
  }
  
  /**
   * Detect connection type from User-Agent
   */
  private detectConnectionType(userAgent?: string): string {
    if (!userAgent) return 'unknown';
    
    if (/Mobile|Android|iPhone|iPad/i.test(userAgent)) {
      return 'mobile';
    }
    
    if (/Chrome|Firefox|Safari|Edge/i.test(userAgent)) {
      return 'broadband';
    }
    
    return 'unknown';
  }
  
  /**
   * Track login activity with location data
   */
  async trackLogin(user: User, req: Request, res: Response): Promise<void> {
    try {
      const location = this.extractLocationFromRequest(req);
      
      await auditLoggingService.createLog({
        user: user,
        action: LOG_ACTIONS.LOGIN,
        actionCategory: LOG_CATEGORIES.AUTHENTICATION,
        actionDescription: `${user.fullName || user.username || user.email} logged in successfully`,
        location: location,
        isSuccessful: true
      }, req, res);
      
      console.log(`📍 Login tracked for user ${user.id} from ${location.city || 'unknown location'}`);
    } catch (error) {
      console.warn('Failed to track login location:', error);
    }
  }
  
  /**
   * Track logout activity with location data
   */
  async trackLogout(user: User, req: Request, res: Response): Promise<void> {
    try {
      const location = this.extractLocationFromRequest(req);
      
      await auditLoggingService.createLog({
        user: user,
        action: LOG_ACTIONS.LOGOUT,
        actionCategory: LOG_CATEGORIES.AUTHENTICATION,
        actionDescription: `${user.fullName || user.username || user.email} logged out`,
        location: location,
        isSuccessful: true
      }, req, res);
      
      console.log(`📍 Logout tracked for user ${user.id} from ${location.city || 'unknown location'}`);
    } catch (error) {
      console.warn('Failed to track logout location:', error);
    }
  }
  
  /**
   * Track session start with location data
   */
  async trackSessionStart(user: User, sessionId: string, sessionType: string, req: Request): Promise<void> {
    try {
      const location = this.extractLocationFromRequest(req);
      
      await auditLoggingService.createLog({
        user: user,
        action: LOG_ACTIONS.SESSION_STARTED,
        actionCategory: LOG_CATEGORIES.SESSION_MANAGEMENT,
        actionDescription: `${user.fullName || user.username || user.email} started ${sessionType} session`,
        targetType: 'session',
        targetId: parseInt(sessionId.replace(/\D/g, '')) || undefined,
        targetName: sessionId,
        location: location,
        details: {
          sessionType: sessionType,
          sessionId: sessionId
        },
        isSuccessful: true
      }, req);
      
      console.log(`📍 Session start tracked for user ${user.id} - ${sessionType} from ${location.city || 'unknown location'}`);
    } catch (error) {
      console.warn('Failed to track session start location:', error);
    }
  }
  
  /**
   * Track failed login attempt with location data
   */
  async trackFailedLogin(email: string, reason: string, req: Request): Promise<void> {
    try {
      const location = this.extractLocationFromRequest(req);
      
      // Create a minimal user object for failed login attempts
      const failedUser: Partial<User> = {
        id: 0, // No user ID for failed attempts
        email: email,
        role: 'unknown'
      };
      
      await auditLoggingService.createLog({
        user: failedUser as User,
        action: LOG_ACTIONS.LOGIN_FAILED,
        actionCategory: LOG_CATEGORIES.AUTHENTICATION,
        actionDescription: `Failed login attempt for ${email}: ${reason}`,
        location: location,
        isSuccessful: false,
        errorMessage: reason,
        severity: 'warning'
      }, req);
      
      console.log(`📍 Failed login tracked for ${email} from ${location.city || 'unknown location'}: ${reason}`);
    } catch (error) {
      console.warn('Failed to track failed login location:', error);
    }
  }
  
  /**
   * Track document interaction with location data
   */
  async trackDocumentInteraction(
    user: User, 
    action: string, 
    documentId: number, 
    documentName: string, 
    req: Request
  ): Promise<void> {
    try {
      const location = this.extractLocationFromRequest(req);
      
      await auditLoggingService.createLog({
        user: user,
        action: action,
        actionCategory: LOG_CATEGORIES.DOCUMENT_MANAGEMENT,
        actionDescription: `${user.fullName || user.username || user.email} ${action} document ${documentName}`,
        targetType: 'document',
        targetId: documentId,
        targetName: documentName,
        location: location,
        isSuccessful: true
      }, req);
      
      console.log(`📍 Document ${action} tracked for user ${user.id} from ${location.city || 'unknown location'}`);
    } catch (error) {
      console.warn('Failed to track document interaction location:', error);
    }
  }
  
  /**
   * Track any custom activity with location data
   */
  async trackActivity(
    user: User,
    action: string,
    category: string,
    description: string,
    req: Request,
    additionalContext?: {
      targetType?: string;
      targetId?: number;
      targetName?: string;
      jobId?: number;
      companyId?: number;
      details?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      const location = this.extractLocationFromRequest(req);
      
      await auditLoggingService.createLog({
        user: user,
        action: action,
        actionCategory: category,
        actionDescription: description,
        location: location,
        isSuccessful: true,
        ...additionalContext
      }, req);
      
      console.log(`📍 Activity tracked: ${action} for user ${user.id} from ${location.city || 'unknown location'}`);
    } catch (error) {
      console.warn('Failed to track activity location:', error);
    }
  }
  
  /**
   * Create middleware for automatic location tracking
   */
  createLocationMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      // Add location data to request for later use
      req.locationData = this.extractLocationFromRequest(req);
      next();
    };
  }
}

// Extend Request interface to include location data
declare global {
  namespace Express {
    interface Request {
      locationData?: LocationContext;
    }
  }
}

// Export singleton instance
export const locationTrackingService = new LocationTrackingService();
export type { LocationContext, User }; 