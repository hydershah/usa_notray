import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { SessionManagementService } from './services/session-management-service';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  privileges?: string[];
}

export const verifyToken = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      message: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.substring(7);
  
  try {
    // First check if token is blacklisted
    const isBlacklisted = await SessionManagementService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({ 
        message: 'Token has been invalidated. Please log in again.',
        code: 'TOKEN_BLACKLISTED',
        requireLogin: true
      });
    }

    // Verify JWT signature and expiration
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    
    // Check if this is a stale session (created before server restart)
    // Note: For now we'll just verify the token. In the future, if you want to
    // automatically logout users on server restart, uncomment the below code:
    
    // const sessionId = req.headers['x-session-id'] as string;
    // if (sessionId) {
    //   const isStale = await SessionManagementService.isSessionStale(sessionId);
    //   if (isStale) {
    //     return res.status(401).json({ 
    //       message: 'Session expired due to server restart. Please log in again.',
    //       code: 'SESSION_STALE',
    //       requireLogin: true
    //     });
    //   }
    //   
    //   // Update session activity
    //   await SessionManagementService.updateSessionActivity(sessionId);
    // }

    req.user = decoded;
    next();
  } catch (error) {
    let message = 'Invalid token';
    let code = 'INVALID_TOKEN';
    
    if (error instanceof jwt.TokenExpiredError) {
      message = 'Token has expired. Please log in again.';
      code = 'TOKEN_EXPIRED';
    } else if (error instanceof jwt.JsonWebTokenError) {
      message = 'Invalid token format. Please log in again.';
      code = 'TOKEN_MALFORMED';
    }
    
    res.status(401).json({ 
      message,
      code,
      requireLogin: true
    });
  }
};

/**
 * Check if user has admin privileges
 * This can be either:
 * 1. role === 'admin' (legacy)
 * 2. privileges array contains 'admin'
 */
export const hasAdminPrivileges = (user: AuthUser): boolean => {
  return user.role === 'admin' || (user.privileges && user.privileges.includes('admin'));
};

/**
 * Check if user has notary privileges
 * This can be either:
 * 1. role === 'notary'
 * 2. privileges array contains 'notary'
 */
export const hasNotaryPrivileges = (user: AuthUser): boolean => {
  return user.role === 'notary' || (user.privileges && user.privileges.includes('notary'));
};

/**
 * Check if user can access notary-specific features
 */
export const canAccessNotaryFeatures = (user: AuthUser): boolean => {
  return hasNotaryPrivileges(user) || hasAdminPrivileges(user);
};

/**
 * Check if user can access admin-specific features
 */
export const canAccessAdminFeatures = (user: AuthUser): boolean => {
  return hasAdminPrivileges(user);
};

/**
 * Middleware to require admin privileges
 */
export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!hasAdminPrivileges(req.user)) {
    return res.status(403).json({ message: 'Admin privileges required' });
  }
  next();
};

/**
 * Middleware to require notary privileges
 */
export const requireNotary = (req: any, res: Response, next: NextFunction) => {
  if (!hasNotaryPrivileges(req.user)) {
    return res.status(403).json({ message: 'Notary privileges required' });
  }
  next();
};

/**
 * Middleware to require either admin or notary privileges
 */
export const requireNotaryOrAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!canAccessNotaryFeatures(req.user) && !canAccessAdminFeatures(req.user)) {
    return res.status(403).json({ message: 'Notary or admin privileges required' });
  }
  next();
};

/**
 * Generate JWT token with user info and privileges
 */
export const generateToken = (user: { id: number; email: string; role: string; privileges?: string[] }): string => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      privileges: user.privileges || []
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}; 