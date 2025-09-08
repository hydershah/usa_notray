/**
 * Enhanced Audit Trail Integration Examples
 * 
 * This file shows how to integrate the enhanced audit trail middleware
 * into existing routes and services for comprehensive audit logging.
 */

import { Request, Response } from 'express';
import { EnhancedAuditTrailMiddleware } from '../middleware/enhanced-audit-trail-middleware';

// Example 1: Authentication Route Integration
export async function loginRouteExample(req: Request, res: Response) {
  try {
    // ... existing login logic ...
    const { email, password } = req.body;
    
    // Simulate authentication
    const user = { id: 1, email, role: 'notary' };
    const loginSuccess = true; // Your actual auth logic here
    
    if (loginSuccess) {
      // Log successful authentication with comprehensive data
      await EnhancedAuditTrailMiddleware.logAuthenticationEvent(
        req,
        user.id,
        user.role,
        'login',
        'email_password', // or 'email_password_2fa' if 2FA used
        'success'
      );
      
      res.json({ success: true, user });
    } else {
      // Log failed authentication attempt
      await EnhancedAuditTrailMiddleware.logAuthenticationEvent(
        req,
        user.id,
        user.role,
        'login_failed',
        'email_password',
        'failure'
      );
      
      res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Example 2: Document Signing Route Integration
export async function documentSigningExample(req: Request, res: Response) {
  try {
    const { documentId, sessionId, coordinates, signatureData } = req.body;
    const user = (req as any).user; // From auth middleware
    
    // ... existing document signing logic ...
    
    // Log document signing event with location and coordinates
    await EnhancedAuditTrailMiddleware.logDocumentEvent(
      req,
      user.id,
      user.role,
      sessionId,
      documentId,
      'document_signed',
      coordinates, // e.g., "Page 1, X:150, Y:300"
      { status: 'unsigned' }, // previousState
      { status: 'signed', signatureHash: 'sha256...' } // newState
    );
    
    res.json({ success: true, documentId });
    
  } catch (error) {
    console.error('Document signing error:', error);
    res.status(500).json({ success: false, error: 'Signing failed' });
  }
}

// Example 3: Session Management Integration
export async function sessionStartExample(req: Request, res: Response) {
  try {
    const { jobId, sessionType } = req.body;
    const user = (req as any).user;
    
    // ... existing session creation logic ...
    const sessionId = 123; // Your actual session creation logic
    
    // Log session start with comprehensive context
    await EnhancedAuditTrailMiddleware.logSessionEvent(
      req,
      user.id,
      user.role,
      sessionId,
      'session_started',
      {
        jobId,
        sessionType,
        participantCount: 1,
        features: ['video', 'screen_share', 'document_editing']
      }
    );
    
    res.json({ success: true, sessionId });
    
  } catch (error) {
    console.error('Session start error:', error);
    res.status(500).json({ success: false, error: 'Session creation failed' });
  }
}

// Example 4: Identity Verification Integration
export async function identityVerificationExample(req: Request, res: Response) {
  try {
    const { sessionId, verificationType, documentData } = req.body;
    const user = (req as any).user;
    
    // ... existing verification logic ...
    const verificationResult = 'pass'; // Your actual verification result
    const credentialRef = `id_verify_${user.id}_${Date.now()}`;
    
    // Log verification event
    await EnhancedAuditTrailMiddleware.logVerificationEvent(
      req,
      user.id,
      user.role,
      sessionId,
      verificationType, // 'ID_VERIFICATION', 'KBA', 'BIOMETRIC', etc.
      verificationResult, // 'pass', 'fail', 'pending'
      credentialRef
    );
    
    res.json({ success: true, result: verificationResult, reference: credentialRef });
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
}

// Example 5: Notarial Action Integration
export async function notarySealExample(req: Request, res: Response) {
  try {
    const { sessionId, documentId, sealPosition } = req.body;
    const user = (req as any).user; // Should be notary
    
    // ... existing notary seal logic ...
    const sealData = {
      sealType: 'digital',
      timestamp: new Date().toISOString(),
      position: sealPosition,
      imageHash: 'sha256_seal_hash...'
    };
    
    const certificateRef = `CERT_${user.id}_2024`;
    const signatureHash = 'sha256_signature_hash...';
    
    // Log notarial action with comprehensive data
    await EnhancedAuditTrailMiddleware.logNotarialEvent(
      req,
      user.id,
      sessionId,
      documentId,
      'seal_applied',
      sealData,
      certificateRef,
      signatureHash
    );
    
    res.json({ success: true, sealData, certificateRef });
    
  } catch (error) {
    console.error('Notary seal error:', error);
    res.status(500).json({ success: false, error: 'Seal application failed' });
  }
}

// Example 6: Middleware Usage for Automatic Logging
export function createAuditMiddleware() {
  return EnhancedAuditTrailMiddleware.createMiddleware('api_request', 'API_SERVER');
}

// Example 7: Bulk Audit Logging for Complex Operations
export async function complexOperationExample(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const { sessionId, documents } = req.body;
    
    // Log the start of complex operation
    await EnhancedAuditTrailMiddleware.logSessionEvent(
      req, user.id, user.role, sessionId, 'session_started',
      { operationType: 'bulk_document_processing', documentCount: documents.length }
    );
    
    // Process each document and log individual actions
    for (const doc of documents) {
      await EnhancedAuditTrailMiddleware.logDocumentEvent(
        req, user.id, user.role, sessionId, doc.id, 'document_opened'
      );
      
      // ... process document ...
      
      await EnhancedAuditTrailMiddleware.logDocumentEvent(
        req, user.id, user.role, sessionId, doc.id, 'document_signed',
        `Page ${doc.signaturePage}, X:${doc.x}, Y:${doc.y}`
      );
    }
    
    // Log completion
    await EnhancedAuditTrailMiddleware.logSessionEvent(
      req, user.id, user.role, sessionId, 'session_ended',
      { documentsProcessed: documents.length, success: true }
    );
    
    res.json({ success: true, processedDocuments: documents.length });
    
  } catch (error) {
    console.error('Complex operation error:', error);
    
    // Log the error
    await EnhancedAuditTrailMiddleware.logSessionEvent(
      req, (req as any).user.id, (req as any).user.role, 
      req.body.sessionId, 'session_ended',
      { error: error.message, success: false }
    );
    
    res.status(500).json({ success: false, error: 'Operation failed' });
  }
}

// Example 8: Integration with Existing Services
export class ExampleServiceWithAuditTrail {
  
  async processDocument(req: Request, userId: number, sessionId: number, documentId: number) {
    // Log document processing start
    await EnhancedAuditTrailMiddleware.logDocumentEvent(
      req, userId, 'system', sessionId, documentId, 'document_opened'
    );
    
    try {
      // ... existing processing logic ...
      
      // Log successful processing
      await EnhancedAuditTrailMiddleware.logDocumentEvent(
        req, userId, 'system', sessionId, documentId, 'document_uploaded',
        undefined, // no coordinates for upload
        { status: 'processing' },
        { status: 'completed', processedAt: new Date().toISOString() }
      );
      
      return { success: true };
      
    } catch (error) {
      // Log processing failure
      await EnhancedAuditTrailMiddleware.logDocumentEvent(
        req, userId, 'system', sessionId, documentId, 'document_uploaded',
        undefined,
        { status: 'processing' },
        { status: 'failed', error: error.message }
      );
      
      throw error;
    }
  }
}

export default {
  loginRouteExample,
  documentSigningExample,
  sessionStartExample,
  identityVerificationExample,
  notarySealExample,
  createAuditMiddleware,
  complexOperationExample,
  ExampleServiceWithAuditTrail
};
