import { AuditTrailService } from './audit-trail-service';

/**
 * Comprehensive RON-compliant audit logging service
 * Captures all required fields for Remote Online Notarization compliance
 */

export interface RONAuditContext {
  // Session Context (Required)
  sessionId: number;
  userId: number;
  userRole: string;
  documentId?: number;
  
  // Request Context
  ipAddress?: string;
  userAgent?: string;
  
  // Event Context
  eventType: string;
  eventDetails: string;
  pageNumber?: number;
  coordinates?: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  
  // State Changes
  previousState?: any;
  newState?: any;
  
  // Verification Context
  authenticationMethod?: string;
  verificationResult?: string;
  credentialReference?: string;
  
  // Notarial Context
  sealApplied?: any;
  notaryCertificateReference?: string;
  digitalSignatureHash?: string;
  
  // System Context
  systemSource: string;
}

export class ComprehensiveAuditService {
  
  /**
   * Log user login with comprehensive tracking
   */
  static async logUserLogin(context: {
    userId: number;
    userRole: string;
    ipAddress: string;
    userAgent: string;
    authenticationMethod: string;
    mfaUsed: boolean;
    sessionId?: number;
  }) {
    await AuditTrailService.createAuditEntry({
      sessionId: context.sessionId || 1, // Default session for login events
      userId: context.userId,
      userRole: context.userRole,
      eventType: 'user_login',
      eventDetails: `User logged in successfully${context.mfaUsed ? ' with 2FA' : ''}`,
      ipAddress: context.ipAddress,
      deviceFingerprint: this.generateDeviceFingerprint(context.userAgent),
      authenticationMethod: context.mfaUsed ? 'email_password_2fa' : 'email_password',
      verificationResult: 'success',
      systemSource: 'AUTHENTICATION'
    });
  }

  /**
   * Log session start with full context
   */
  static async logSessionStart(context: {
    sessionId: number;
    userId: number;
    userRole: string;
    sessionType: string;
    jobId?: number;
    ipAddress: string;
    userAgent: string;
  }) {
    await AuditTrailService.createAuditEntry({
      sessionId: context.sessionId,
      userId: context.userId,
      userRole: context.userRole,
      eventType: 'session_started',
      eventDetails: `${context.sessionType} session started${context.jobId ? ` for job ${context.jobId}` : ''}`,
      ipAddress: context.ipAddress,
      deviceFingerprint: this.generateDeviceFingerprint(context.userAgent),
      authenticationMethod: 'bearer_token',
      verificationResult: 'authorized',
      systemSource: 'SESSION_MANAGEMENT'
    });
  }

  /**
   * Log session completion with comprehensive data
   */
  static async logSessionCompletion(context: {
    sessionId: number;
    userId: number;
    userRole: string;
    sessionType: string;
    jobId?: number;
    duration?: number;
    ipAddress: string;
    userAgent: string;
  }) {
    await AuditTrailService.createAuditEntry({
      sessionId: context.sessionId,
      userId: context.userId,
      userRole: context.userRole,
      eventType: 'session_completed',
      eventDetails: `${context.sessionType} session completed${context.duration ? ` (${context.duration} minutes)` : ''}`,
      ipAddress: context.ipAddress,
      deviceFingerprint: this.generateDeviceFingerprint(context.userAgent),
      authenticationMethod: 'bearer_token',
      verificationResult: 'authorized',
      systemSource: 'SESSION_MANAGEMENT',
      newState: { 
        status: 'completed', 
        completedAt: new Date().toISOString(),
        duration: context.duration 
      }
    });
  }

  /**
   * Log document upload with full metadata
   */
  static async logDocumentUpload(context: {
    sessionId: number;
    userId: number;
    userRole: string;
    documentId?: number;
    fileName: string;
    fileSize: number;
    documentType: string;
    ipAddress: string;
    userAgent: string;
  }) {
    await AuditTrailService.createAuditEntry({
      sessionId: context.sessionId,
      documentId: context.documentId,
      userId: context.userId,
      userRole: context.userRole,
      eventType: 'document_uploaded',
      eventDetails: `Document uploaded: ${context.fileName} (${Math.round(context.fileSize / 1024)}KB, ${context.documentType})`,
      ipAddress: context.ipAddress,
      deviceFingerprint: this.generateDeviceFingerprint(context.userAgent),
      systemSource: 'DOCUMENT_MANAGEMENT',
      newState: {
        fileName: context.fileName,
        fileSize: context.fileSize,
        documentType: context.documentType,
        uploadedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Log tag placement with precise coordinates
   */
  static async logTagPlacement(context: {
    sessionId: number;
    userId: number;
    userRole: string;
    documentId: number;
    tagType: string;
    assignedUserId: number;
    assignedUserName: string;
    pageNumber: number;
    coordinates: { x: number; y: number; width: number; height: number };
    ipAddress: string;
    userAgent: string;
  }) {
    const coordinatesRef = `Page ${context.pageNumber}, X:${Math.round(context.coordinates.x)}, Y:${Math.round(context.coordinates.y)}`;
    
    await AuditTrailService.createAuditEntry({
      sessionId: context.sessionId,
      documentId: context.documentId,
      userId: context.userId,
      userRole: context.userRole,
      eventType: 'tag_placed',
      eventDetails: `${context.tagType} tag placed for ${context.assignedUserName}`,
      coordinatesPageReference: coordinatesRef,
      ipAddress: context.ipAddress,
      deviceFingerprint: this.generateDeviceFingerprint(context.userAgent),
      systemSource: 'TAG_SYSTEM',
      newState: {
        tagType: context.tagType,
        assignedUserId: context.assignedUserId,
        assignedUserName: context.assignedUserName,
        pageNumber: context.pageNumber,
        coordinates: context.coordinates,
        isCompleted: false,
        placedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Log tag completion with content
   */
  static async logTagCompletion(context: {
    sessionId: number;
    userId: number;
    userRole: string;
    documentId: number;
    tagId: number;
    tagType: string;
    content: string;
    pageNumber: number;
    coordinates: { x: number; y: number };
    ipAddress: string;
    userAgent: string;
  }) {
    const coordinatesRef = `Page ${context.pageNumber}, X:${Math.round(context.coordinates.x)}, Y:${Math.round(context.coordinates.y)}`;
    
    await AuditTrailService.createAuditEntry({
      sessionId: context.sessionId,
      documentId: context.documentId,
      userId: context.userId,
      userRole: context.userRole,
      eventType: 'tag_completed',
      eventDetails: `${context.tagType} tag completed with content: "${context.content.substring(0, 100)}${context.content.length > 100 ? '...' : ''}"`,
      coordinatesPageReference: coordinatesRef,
      ipAddress: context.ipAddress,
      deviceFingerprint: this.generateDeviceFingerprint(context.userAgent),
      systemSource: 'TAG_SYSTEM',
      previousState: { isCompleted: false },
      newState: { 
        isCompleted: true, 
        content: context.content,
        completedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Log identity verification events
   */
  static async logIdentityVerification(context: {
    sessionId: number;
    userId: number;
    userRole: string;
    verificationType: 'KBA' | 'ID_SCAN' | 'BIOMETRIC';
    verificationResult: 'passed' | 'failed' | 'pending';
    credentialReference?: string;
    ipAddress: string;
    userAgent: string;
  }) {
    const methodMap = {
      'KBA': 'knowledge_based_authentication',
      'ID_SCAN': 'government_id_verification',
      'BIOMETRIC': 'biometric_verification'
    };

    await AuditTrailService.createAuditEntry({
      sessionId: context.sessionId,
      userId: context.userId,
      userRole: context.userRole,
      eventType: 'identity_verification',
      eventDetails: `${context.verificationType} verification ${context.verificationResult}`,
      ipAddress: context.ipAddress,
      deviceFingerprint: this.generateDeviceFingerprint(context.userAgent),
      authenticationMethod: methodMap[context.verificationType],
      verificationResult: context.verificationResult,
      credentialReference: context.credentialReference,
      systemSource: 'EVS_VERIFICATION'
    });
  }

  /**
   * Log notary seal application
   */
  static async logNotarySealApplication(context: {
    sessionId: number;
    userId: number;
    documentId: number;
    pageNumber: number;
    coordinates: { x: number; y: number };
    notaryCertificateId: string;
    digitalSignatureHash: string;
    ipAddress: string;
    userAgent: string;
  }) {
    const coordinatesRef = `Page ${context.pageNumber}, X:${Math.round(context.coordinates.x)}, Y:${Math.round(context.coordinates.y)}`;
    
    await AuditTrailService.createAuditEntry({
      sessionId: context.sessionId,
      documentId: context.documentId,
      userId: context.userId,
      userRole: 'notary',
      eventType: 'notary_seal_applied',
      eventDetails: `Digital notary seal applied to document`,
      coordinatesPageReference: coordinatesRef,
      ipAddress: context.ipAddress,
      deviceFingerprint: this.generateDeviceFingerprint(context.userAgent),
      sealApplied: {
        timestamp: new Date().toISOString(),
        location: context.coordinates,
        pageNumber: context.pageNumber
      },
      notaryCertificateReference: context.notaryCertificateId,
      digitalSignatureHash: context.digitalSignatureHash,
      systemSource: 'DIGITAL_SIGNATURE'
    });
  }

  /**
   * Log document viewing/access
   */
  static async logDocumentAccess(context: {
    sessionId: number;
    userId: number;
    userRole: string;
    documentId: number;
    fileName: string;
    accessType: 'view' | 'download' | 'preview';
    ipAddress: string;
    userAgent: string;
  }) {
    await AuditTrailService.createAuditEntry({
      sessionId: context.sessionId,
      documentId: context.documentId,
      userId: context.userId,
      userRole: context.userRole,
      eventType: `document_${context.accessType}`,
      eventDetails: `Document ${context.accessType}: ${context.fileName}`,
      ipAddress: context.ipAddress,
      deviceFingerprint: this.generateDeviceFingerprint(context.userAgent),
      systemSource: 'DOCUMENT_MANAGEMENT'
    });
  }

  /**
   * Generate consistent device fingerprint from user agent
   */
  private static generateDeviceFingerprint(userAgent?: string): string {
    if (!userAgent) return 'unknown-device';
    
    // Extract browser info
    const browser = this.getBrowserInfo(userAgent);
    const os = this.getOSInfo(userAgent);
    
    return `${browser}-${os}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }

  private static getBrowserInfo(userAgent: string): string {
    if (userAgent.includes('Chrome')) return 'chrome';
    if (userAgent.includes('Firefox')) return 'firefox';
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'safari';
    if (userAgent.includes('Edge')) return 'edge';
    return 'unknown-browser';
  }

  private static getOSInfo(userAgent: string): string {
    if (userAgent.includes('Windows')) return 'windows';
    if (userAgent.includes('Mac')) return 'mac';
    if (userAgent.includes('Linux')) return 'linux';
    if (userAgent.includes('Android')) return 'android';
    if (userAgent.includes('iOS')) return 'ios';
    return 'unknown-os';
  }

  /**
   * Extract IP address from request with proxy support
   */
  static getClientIP(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           req.headers['x-real-ip'] || 
           'unknown';
  }

  /**
   * Get user agent safely
   */
  static getUserAgent(req: any): string {
    return req.headers['user-agent']?.substring(0, 200) || 'unknown';
  }
}
