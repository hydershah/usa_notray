/**
 * Enhanced Audit Trail Middleware for RON Platform
 * Captures comprehensive data for audit trail including IP, location, device fingerprinting
 */

import { Request, Response, NextFunction } from 'express';
import { AuditTrailService } from '../services/audit-trail-service';
import crypto from 'crypto';

export interface EnhancedAuditContext {
  userId: number;
  userRole: string;
  sessionId?: number;
  documentId?: number;
  eventType: string;
  eventDetails?: string;
  coordinatesPageReference?: string;
  previousState?: any;
  newState?: any;
  authenticationMethod?: string;
  verificationResult?: string;
  credentialReference?: string;
  sealApplied?: any;
  notaryCertificateReference?: string;
  digitalSignatureHash?: string;
  systemSource?: string;
}

export class EnhancedAuditTrailMiddleware {
  
  /**
   * Extract client IP address from request
   */
  private static getClientIP(req: Request): string {
    const forwarded = req.get('X-Forwarded-For');
    const realIP = req.get('X-Real-IP');
    const cfConnectingIP = req.get('CF-Connecting-IP');
    
    if (cfConnectingIP) return cfConnectingIP;
    if (realIP) return realIP;
    if (forwarded) return forwarded.split(',')[0].trim();
    
    return req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           (req.connection as any)?.socket?.remoteAddress || 
           '127.0.0.1';
  }

  /**
   * Generate device fingerprint from request headers
   */
  private static generateDeviceFingerprint(req: Request): string {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const ip = this.getClientIP(req);
    
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${userAgent}|${acceptLanguage}|${acceptEncoding}|${ip}`)
      .digest('hex')
      .substring(0, 32);
      
    return fingerprint;
  }

  /**
   * Extract location information from request
   */
  private static async extractLocationInfo(req: Request): Promise<{
    city?: string;
    state?: string;
    country?: string;
    timezone?: string;
    ispName?: string;
    latitude?: number;
    longitude?: number;
  }> {
    // Check if location data is provided in headers (from client-side geolocation)
    const clientLat = req.get('X-Client-Latitude');
    const clientLon = req.get('X-Client-Longitude');
    const clientTimezone = req.get('X-Client-Timezone');
    
    const locationInfo: any = {};
    
    if (clientLat && clientLon) {
      locationInfo.latitude = parseFloat(clientLat);
      locationInfo.longitude = parseFloat(clientLon);
    }
    
    if (clientTimezone) {
      locationInfo.timezone = clientTimezone;
    }
    
    // You could integrate with IP geolocation service here
    // For now, we'll extract basic info from headers
    const cfCountry = req.get('CF-IPCountry');
    const cfRegion = req.get('CF-Region');
    const cfCity = req.get('CF-IPCity');
    
    if (cfCountry) locationInfo.country = cfCountry;
    if (cfRegion) locationInfo.state = cfRegion;
    if (cfCity) locationInfo.city = cfCity;
    
    return locationInfo;
  }

  /**
   * Create comprehensive audit trail entry
   */
  static async logAuditEvent(req: Request, context: EnhancedAuditContext): Promise<void> {
    try {
      const ipAddress = this.getClientIP(req);
      const deviceFingerprint = this.generateDeviceFingerprint(req);
      const locationInfo = await this.extractLocationInfo(req);
      
      // Create comprehensive audit entry
      await AuditTrailService.createAuditEntry({
        sessionId: context.sessionId || 1, // Default session if none provided
        userId: context.userId,
        userRole: context.userRole,
        eventType: context.eventType,
        eventDetails: context.eventDetails || `${context.eventType} performed by ${context.userRole}`,
        
        // Request context
        ipAddress,
        deviceFingerprint,
        
        // Document context
        documentId: context.documentId,
        coordinatesPageReference: context.coordinatesPageReference,
        previousState: context.previousState,
        newState: context.newState,
        
        // Verification context
        authenticationMethod: context.authenticationMethod,
        verificationResult: context.verificationResult,
        credentialReference: context.credentialReference,
        
        // Notarial context
        sealApplied: context.sealApplied,
        notaryCertificateReference: context.notaryCertificateReference,
        digitalSignatureHash: context.digitalSignatureHash,
        
        // System context
        systemSource: context.systemSource || 'RON_PLATFORM',
        
        // Enhanced metadata
        retentionMetadata: {
          retentionYears: 10,
          policy: 'WORM',
          ipAddress,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString(),
          location: locationInfo
        }
      });
      
      console.log(`📋 Enhanced audit trail logged: ${context.eventType} for user ${context.userId}`);
      
    } catch (error) {
      console.error('Failed to create enhanced audit trail entry:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Middleware factory for automatic audit logging
   */
  static createMiddleware(eventType: string, systemSource?: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Store audit context in request for later use
      (req as any).auditContext = {
        eventType,
        systemSource: systemSource || 'RON_PLATFORM',
        timestamp: new Date(),
        ipAddress: this.getClientIP(req),
        deviceFingerprint: this.generateDeviceFingerprint(req),
        userAgent: req.get('User-Agent')
      };
      
      next();
    };
  }

  /**
   * Log user authentication events
   */
  static async logAuthenticationEvent(
    req: Request, 
    userId: number, 
    userRole: string, 
    eventType: 'login' | 'logout' | 'login_failed' | 'password_reset',
    authMethod: string,
    result: 'success' | 'failure',
    sessionId?: number
  ): Promise<void> {
    await this.logAuditEvent(req, {
      userId,
      userRole,
      sessionId,
      eventType: `user_${eventType}`,
      eventDetails: `User ${eventType} ${result} using ${authMethod}`,
      authenticationMethod: authMethod,
      verificationResult: result,
      credentialReference: `auth_${userId}_${Date.now()}`,
      systemSource: 'AUTHENTICATION'
    });
  }

  /**
   * Log document interaction events
   */
  static async logDocumentEvent(
    req: Request,
    userId: number,
    userRole: string,
    sessionId: number,
    documentId: number,
    eventType: 'document_opened' | 'document_signed' | 'document_sealed' | 'document_uploaded' | 'document_downloaded',
    coordinates?: string,
    previousState?: any,
    newState?: any
  ): Promise<void> {
    await this.logAuditEvent(req, {
      userId,
      userRole,
      sessionId,
      documentId,
      eventType,
      eventDetails: `Document ${eventType.replace('document_', '')} by ${userRole}`,
      coordinatesPageReference: coordinates,
      previousState,
      newState,
      systemSource: 'DOCUMENT_MANAGER'
    });
  }

  /**
   * Log notarial action events
   */
  static async logNotarialEvent(
    req: Request,
    userId: number,
    sessionId: number,
    documentId: number,
    eventType: 'seal_applied' | 'certificate_used' | 'signature_applied',
    sealData?: any,
    certificateRef?: string,
    signatureHash?: string
  ): Promise<void> {
    await this.logAuditEvent(req, {
      userId,
      userRole: 'notary',
      sessionId,
      documentId,
      eventType: `notary_${eventType}`,
      eventDetails: `Notary ${eventType.replace('_', ' ')} on document`,
      sealApplied: sealData,
      notaryCertificateReference: certificateRef,
      digitalSignatureHash: signatureHash,
      systemSource: 'NOTARIZATION'
    });
  }

  /**
   * Log session events
   */
  static async logSessionEvent(
    req: Request,
    userId: number,
    userRole: string,
    sessionId: number,
    eventType: 'session_created' | 'session_started' | 'session_joined' | 'session_left' | 'session_ended',
    details?: any
  ): Promise<void> {
    await this.logAuditEvent(req, {
      userId,
      userRole,
      sessionId,
      eventType,
      eventDetails: details ? JSON.stringify(details) : `Session ${eventType.replace('session_', '')} by ${userRole}`,
      systemSource: 'SESSION_MANAGER'
    });
  }

  /**
   * Log verification events
   */
  static async logVerificationEvent(
    req: Request,
    userId: number,
    userRole: string,
    sessionId: number,
    verificationMethod: 'ID_VERIFICATION' | 'KBA' | 'BIOMETRIC' | 'EMAIL_VERIFICATION',
    result: 'pass' | 'fail' | 'pending',
    credentialRef?: string
  ): Promise<void> {
    await this.logAuditEvent(req, {
      userId,
      userRole,
      sessionId,
      eventType: 'identity_verification',
      eventDetails: `${verificationMethod} verification ${result} for ${userRole}`,
      authenticationMethod: verificationMethod,
      verificationResult: result,
      credentialReference: credentialRef || `verify_${userId}_${Date.now()}`,
      systemSource: 'IDENTITY_VERIFICATION'
    });
  }
}

export default EnhancedAuditTrailMiddleware;
