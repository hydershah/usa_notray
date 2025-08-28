import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage.js';
import { auditLoggingService } from '../services/audit-logging-service.js';

/**
 * Enhanced email uniqueness validation middleware
 * Prevents any attempt to register with an existing email across all user types
 */
export const validateEmailUniqueness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, primaryUserEmail } = req.body;
    const emailToCheck = email || primaryUserEmail;
    
    if (!emailToCheck) {
      return next(); // No email to check, continue
    }

    // Normalize email
    const normalizedEmail = String(emailToCheck).trim().toLowerCase();
    
    // Check for existing user
    const existingUser = await storage.getUserByEmail(normalizedEmail);
    
    if (existingUser) {
      // Log security attempt
      await auditLoggingService.createLog({
        action: 'EMAIL_REGISTRATION_BLOCKED',
        actionCategory: 'security',
        actionDescription: `Blocked registration attempt with existing email: ${normalizedEmail}`,
        targetType: 'user',
        targetId: existingUser.id,
        severity: 'warning',
        details: {
          existingUserRole: existingUser.role,
          attemptedRegistrationEndpoint: req.path,
          preventedSecurityBreach: true,
          attemptedEmail: normalizedEmail
        }
      }, req);

      return res.status(409).json({
        message: 'An account with this email address already exists. Email addresses must be unique across all account types.',
        error: 'EMAIL_ALREADY_EXISTS',
        details: {
          email: normalizedEmail,
          suggestion: 'Please use a different email address or sign in to your existing account.'
        }
      });
    }

    next();
  } catch (error) {
    console.error('Email validation middleware error:', error);
    
    // Log the error but don't block registration for technical issues
    await auditLoggingService.createLog({
      action: 'EMAIL_VALIDATION_ERROR',
      actionCategory: 'system_admin',
      actionDescription: 'Email validation middleware encountered an error',
      severity: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      isSystemAction: true,
      details: { 
        middlewareError: true,
        requestBody: req.body 
      }
    }, req);
    
    next();
  }
};

/**
 * Enhanced user creation validation
 * Double-checks email uniqueness right before database insertion
 */
export const validateUserCreation = async (userData: any) => {
  const normalizedEmail = String(userData.email).trim().toLowerCase();
  
  // Final check before creation
  const existingUser = await storage.getUserByEmail(normalizedEmail);
  
  if (existingUser) {
    throw new Error(`SECURITY_VIOLATION: Attempt to create user with existing email: ${normalizedEmail}. Existing user has role: ${existingUser.role}`);
  }
  
  return normalizedEmail;
};
