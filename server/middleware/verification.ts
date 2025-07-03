import { Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { users } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Middleware to check if user has completed required verification
 * Roles requiring verification: notary, signer, witness
 * Admin and title_company roles are exempt from verification
 * 
 * Checks for either:
 * 1. EVS verification completed (isVerified = true)
 * 2. Admin bypass granted (isVerificationBypassed = true)
 */
export const requireVerification = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Roles that are exempt from verification requirements
    const exemptRoles = ['admin', 'title_company'];
    
    if (exemptRoles.includes(user.role)) {
      return next(); // Admin and title company users don't need verification
    }

    // Roles that require verification
    const requiresVerificationRoles = ['notary', 'signer', 'witness'];
    
    if (!requiresVerificationRoles.includes(user.role)) {
      return next(); // Other roles don't require verification
    }

    // Get user's current verification status from database
    const userRecord = await db
      .select({
        id: users.id,
        isVerified: users.isVerified,
        isVerificationBypassed: users.isVerificationBypassed,
        notaryVerificationBypassed: users.notaryVerificationBypassed,
        verificationStatus: users.verificationStatus,
        role: users.role
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userRecord.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userInfo = userRecord[0];

    // Check if user is verified through any method
    const isVerifiedByEVS = userInfo.isVerified && userInfo.verificationStatus === 'approved';
    const isBypassedByAdmin = userInfo.isVerificationBypassed;
    const isBypassedByNotary = userInfo.notaryVerificationBypassed;

    if (isVerifiedByEVS || isBypassedByAdmin || isBypassedByNotary) {
      // User is verified either through EVS, admin bypass, or notary bypass
      req.user.verificationMethod = isVerifiedByEVS ? 'evs' : isBypassedByAdmin ? 'admin_bypass' : 'notary_bypass';
      return next();
    }

    // User needs to complete verification
    return res.status(403).json({
      error: 'Verification required',
      message: 'You must complete identity verification before accessing this resource',
      verificationRequired: true,
      userRole: userInfo.role,
      verificationStatus: userInfo.verificationStatus,
      redirectTo: '/verification'
    });

  } catch (error) {
    console.error('Error in verification middleware:', error);
    return res.status(500).json({ error: 'Internal server error during verification check' });
  }
};

/**
 * Middleware specifically for session access control
 * Used for signing sessions and sensitive operations
 */
export const requireVerificationForSession = async (req: any, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admin can always access sessions
    if (user.role === 'admin') {
      return next();
    }

    // For session access, all participants except admin need verification
    const sessionParticipantRoles = ['notary', 'signer', 'witness'];
    
    if (!sessionParticipantRoles.includes(user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        message: 'Only verified notaries, signers, and witnesses can access signing sessions'
      });
    }

    // Get user's verification status
    const userRecord = await db
      .select({
        id: users.id,
        isVerified: users.isVerified,
        isVerificationBypassed: users.isVerificationBypassed,
        notaryVerificationBypassed: users.notaryVerificationBypassed,
        verificationStatus: users.verificationStatus,
        role: users.role,
        verificationBypassReason: users.verificationBypassReason,
        notaryVerificationBypassReason: users.notaryVerificationBypassReason
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userRecord.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userInfo = userRecord[0];

    // Check verification status through all methods
    const isVerifiedByEVS = userInfo.isVerified && userInfo.verificationStatus === 'approved';
    const isBypassedByAdmin = userInfo.isVerificationBypassed;
    const isBypassedByNotary = userInfo.notaryVerificationBypassed;

    if (isVerifiedByEVS || isBypassedByAdmin || isBypassedByNotary) {
      // Log session access for audit
      const verificationMethod = isVerifiedByEVS ? 'EVS verification' : 
                               isBypassedByAdmin ? 'Admin bypass' : 
                               'Notary bypass';
      const bypassReason = isBypassedByAdmin ? userInfo.verificationBypassReason : 
                          isBypassedByNotary ? userInfo.notaryVerificationBypassReason : null;
      
      console.log(`Session access granted for user ${user.id} (${user.role}) - Method: ${verificationMethod}${
        bypassReason ? ` (Reason: ${bypassReason})` : ''
      }`);
      
      req.user.verificationMethod = isVerifiedByEVS ? 'evs' : isBypassedByAdmin ? 'admin_bypass' : 'notary_bypass';
      return next();
    }

    // Block session access for unverified users
    return res.status(403).json({
      error: 'Session access denied',
      message: 'Identity verification is required to participate in signing sessions',
      verificationRequired: true,
      userRole: userInfo.role,
      verificationStatus: userInfo.verificationStatus,
      redirectTo: '/verification'
    });

  } catch (error) {
    console.error('Error in session verification middleware:', error);
    return res.status(500).json({ error: 'Internal server error during session verification check' });
  }
};

/**
 * Helper function to check verification status for a user
 * Returns verification info without blocking the request
 */
export const getVerificationStatus = async (userId: number) => {
  try {
    const userRecord = await db
      .select({
        id: users.id,
        role: users.role,
        isVerified: users.isVerified,
        isVerificationBypassed: users.isVerificationBypassed,
        notaryVerificationBypassed: users.notaryVerificationBypassed,
        verificationStatus: users.verificationStatus,
        verificationBypassReason: users.verificationBypassReason,
        verificationBypassedBy: users.verificationBypassedBy,
        verificationBypassedAt: users.verificationBypassedAt,
        notaryVerificationBypassReason: users.notaryVerificationBypassReason,
        notaryVerificationBypassedBy: users.notaryVerificationBypassedBy,
        notaryVerificationBypassedAt: users.notaryVerificationBypassedAt,
        notaryVerificationBypassJobId: users.notaryVerificationBypassJobId,
        evsTransactionId: users.evsTransactionId,
        evsVerificationConfidence: users.evsVerificationConfidence,
        evsVerifiedAt: users.evsVerifiedAt
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRecord.length) {
      return null;
    }

    const user = userRecord[0];
    const verificationMethod = user.isVerified ? 'evs' : 
                             user.isVerificationBypassed ? 'admin_bypass' : 
                             user.notaryVerificationBypassed ? 'notary_bypass' : null;
    
    return {
      userId: user.id,
      role: user.role,
      requiresVerification: ['notary', 'signer', 'witness'].includes(user.role),
      isVerified: user.isVerified,
      isVerificationBypassed: user.isVerificationBypassed,
      notaryVerificationBypassed: user.notaryVerificationBypassed,
      verificationStatus: user.verificationStatus,
      verificationMethod: verificationMethod,
      bypassInfo: user.isVerificationBypassed ? {
        reason: user.verificationBypassReason,
        bypassedBy: user.verificationBypassedBy,
        bypassedAt: user.verificationBypassedAt
      } : null,
      notaryBypassInfo: user.notaryVerificationBypassed ? {
        reason: user.notaryVerificationBypassReason,
        bypassedBy: user.notaryVerificationBypassedBy,
        bypassedAt: user.notaryVerificationBypassedAt,
        jobId: user.notaryVerificationBypassJobId
      } : null,
      evsInfo: user.isVerified ? {
        transactionId: user.evsTransactionId,
        confidence: user.evsVerificationConfidence,
        verifiedAt: user.evsVerifiedAt
      } : null
    };
  } catch (error) {
    console.error('Error getting verification status:', error);
    return null;
  }
};

/**
 * Middleware to add verification status to request object
 * Useful for endpoints that need to know verification status but don't block access
 */
export const addVerificationStatus = async (req: any, res: Response, next: NextFunction) => {
  try {
    if (req.user) {
      const verificationStatus = await getVerificationStatus(req.user.id);
      req.user.verificationInfo = verificationStatus;
    }
    next();
  } catch (error) {
    console.error('Error adding verification status:', error);
    next(); // Don't block request on error
  }
}; 