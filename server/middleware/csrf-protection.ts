import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Simple CSRF token generation and validation
export class CSRFProtection {
  private static tokens = new Map<string, { token: string; expires: number }>();
  
  // Generate CSRF token
  static generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (60 * 60 * 1000); // 1 hour
    
    this.tokens.set(sessionId, { token, expires });
    
    // Cleanup expired tokens
    this.cleanupExpiredTokens();
    
    return token;
  }
  
  // Validate CSRF token
  static validateToken(sessionId: string, providedToken: string): boolean {
    const tokenData = this.tokens.get(sessionId);
    
    if (!tokenData) {
      return false;
    }
    
    if (Date.now() > tokenData.expires) {
      this.tokens.delete(sessionId);
      return false;
    }
    
    return tokenData.token === providedToken;
  }
  
  // Cleanup expired tokens
  private static cleanupExpiredTokens() {
    const now = Date.now();
    for (const [sessionId, tokenData] of this.tokens.entries()) {
      if (now > tokenData.expires) {
        this.tokens.delete(sessionId);
      }
    }
  }
}

// CSRF middleware for state-changing operations
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET requests and API authentication
  if (req.method === 'GET' || req.path.includes('/api/auth/login')) {
    return next();
  }
  
  const sessionId = req.sessionID || req.ip;
  const csrfToken = req.headers['x-csrf-token'] as string || req.body._csrf;
  
  if (!csrfToken || !CSRFProtection.validateToken(sessionId, csrfToken)) {
    console.warn(`CSRF validation failed for ${req.ip} on ${req.path}`);
    return res.status(403).json({
      error: 'CSRF token validation failed',
      message: 'Invalid or missing security token'
    });
  }
  
  next();
};

// Endpoint to get CSRF token
export const getCsrfToken = (req: Request, res: Response) => {
  const sessionId = req.sessionID || req.ip;
  const token = CSRFProtection.generateToken(sessionId);
  
  res.json({ csrfToken: token });
}; 