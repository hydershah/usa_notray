import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth';

/**
 * Development authentication middleware
 * In development, we still require authentication but provide better error messages
 * and allow certain operations that might be restricted in production
 */
export function createDevAuthMiddleware(options: { 
  requireRole?: string;
  allowedRoles?: string[];
  operation: string;
} = { operation: 'operation' }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'development') {
      // In production, use normal token verification
      return verifyToken(req, res, next);
    }

    // In development, still use token verification but provide better error handling
    return verifyToken(req, res, (error?: any) => {
      if (error) {
        // In development, provide more helpful error messages
        console.log(`🔍 Development mode: Authentication failed for ${options.operation}`);
        console.log('💡 Make sure you have a valid JWT token in the Authorization header');
        console.log('💡 Use POST /api/auth/login to get a token');
        return res.status(401).json({ 
          message: 'Authentication required', 
          error: 'No valid token provided',
          hint: 'In development: Use POST /api/auth/login to get a token',
          operation: options.operation
        });
      }

      // Check role requirements if specified
      const user = (req as any).user;
      if (options.requireRole && user.role !== options.requireRole) {
        console.log(`🔍 Development mode: Role mismatch for ${options.operation}. Required: ${options.requireRole}, Got: ${user.role}`);
        return res.status(403).json({
          message: 'Insufficient permissions',
          required: options.requireRole,
          current: user.role,
          operation: options.operation
        });
      }

      if (options.allowedRoles && !options.allowedRoles.includes(user.role)) {
        console.log(`🔍 Development mode: Role not allowed for ${options.operation}. Allowed: ${options.allowedRoles.join(', ')}, Got: ${user.role}`);
        return res.status(403).json({
          message: 'Insufficient permissions',
          allowed: options.allowedRoles,
          current: user.role,
          operation: options.operation
        });
      }

      console.log(`✅ Development mode: Authenticated user ${user.id} (${user.role}) for ${options.operation}`);
      next();
    });
  };
}

/**
 * Simple development auth that just requires any valid token
 */
export const devAuth = createDevAuthMiddleware({ operation: 'general operation' });

/**
 * Development auth for admin operations
 */
export const devAdminAuth = createDevAuthMiddleware({ 
  allowedRoles: ['admin'], 
  operation: 'admin operation' 
});

/**
 * Development auth for upload operations
 */
export const devUploadAuth = createDevAuthMiddleware({ 
  allowedRoles: ['admin', 'notary', 'signer', 'witness', 'title_company'], 
  operation: 'file upload' 
});
