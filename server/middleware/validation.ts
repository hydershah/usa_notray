import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import rateLimit from 'express-rate-limit';
import { ErrorTypes } from './error-handler';

/**
 * Request validation middleware using Zod schemas
 */
export function validateRequest<T>(schema: {
  body?: ZodSchema<T>;
  query?: ZodSchema<any>;
  params?: ZodSchema<any>;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = ErrorTypes.VALIDATION_ERROR(
          'Request validation failed',
          { errors: error.errors }
        );
        next(validationError);
      } else {
        next(error);
      }
    }
  };
}

/**
 * SQL Injection Prevention - Enhanced to allow legitimate address characters and auth credentials
 */
export function preventSqlInjection(req: Request, res: Response, next: NextFunction) {
  // For authentication endpoints, skip SQL injection protection entirely
  const authEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/set-password', '/api/auth/validate-password-reset-token'];
  const isAuthEndpoint = authEndpoints.some(endpoint => req.path.includes(endpoint));

  if (isAuthEndpoint) {
    // Skip SQL injection protection for auth endpoints
    return next();
  }

  // Regular validation for non-auth endpoints
  const sqlPatterns = [
    // More specific patterns that are less likely to catch legitimate data
    /(\%27)|(\')|(\\x27)|(\\x2527)/i, // Single quotes (but allow in names/addresses)
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i, // Equals followed by SQL
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i, // 'or patterns
    /((\%27)|(\'))union/i, // UNION attacks
    /exec(\s|\+)+(s|x)p\w+/i, // Stored procedure execution
    /(drop|delete|truncate|alter)\s+(table|database|schema)/i, // DDL commands
    /(insert|update)\s+.*(select|union)/i, // INSERT/UPDATE with subqueries
    /--\s*[^\r\n]*(select|union|drop|delete|insert|update)/i, // Comments with SQL
    /\/\*.*\*\/.*\b(select|union|drop|delete|insert|update)\b/i, // Multi-line comments with SQL
    /;\s*(select|union|drop|delete|insert|update|exec)/i, // Semicolon followed by SQL
  ];

  // Whitelist patterns for legitimate data that might contain dangerous characters
  const legitPatterns = [
    /^[0-9]+\s+[a-zA-Z\s]+#[0-9]+$/i, // Address with suite/apt number (e.g., "123 Main St #456")
    /^[a-zA-Z\s'.-]+$/i, // Names with apostrophes (e.g., "O'Connor")
    /^[a-zA-Z0-9\s'.,#-]+$/i, // Address fields with common punctuation
  ];

  const checkForSqlInjection = (obj: any, fieldName: string = ''): boolean => {
    if (typeof obj === 'string') {
      // Skip validation for certain address/name fields if they match legitimate patterns
      const addressFields = ['address1', 'address2', 'billingAddress1', 'billingAddress2', 'name', 'fullName', 'firstName', 'lastName', 'primaryUserName', 'contactName'];
      if (addressFields.some(field => fieldName.toLowerCase().includes(field.toLowerCase()))) {
        // Check if the string matches any legitimate pattern
        if (legitPatterns.some(pattern => pattern.test(obj))) {
          return false; // Skip SQL injection check for legitimate address/name data
        }
      }
      
      return sqlPatterns.some(pattern => pattern.test(obj));
    } else if (typeof obj === 'object' && obj !== null) {
      return Object.entries(obj).some(([key, value]) => checkForSqlInjection(value, key));
    }
    return false;
  };

  if (checkForSqlInjection(req.body) || checkForSqlInjection(req.query)) {
    console.error('🚨 SQL INJECTION ATTEMPT:', {
      ip: req.ip,
      url: req.originalUrl,
      body: process.env.NODE_ENV === 'development' ? req.body : '[REDACTED]',
      timestamp: new Date().toISOString()
    });
    
    const error = ErrorTypes.VALIDATION_ERROR('Invalid request format');
    return next(error);
  }

  next();
}

/**
 * Rate limiters
 */
export const rateLimiters = {
  auth: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts', retryAfter: '15 minutes' }
  }),
  
  general: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000, // Increased from 1000 to 5000 for editor operations
    message: { error: 'Too many requests', retryAfter: '15 minutes' }
  }),
  
  editor: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000, // Higher limit for editor operations
    message: { error: 'Editor rate limit exceeded', retryAfter: '15 minutes' },
    keyGenerator: (req) => {
      // Use session ID for editor rate limiting
      const sessionId = req.params?.sessionId || req.body?.sessionId;
      return req.ip + ':' + (sessionId || 'unknown');
    }
  }),
  
  fileUpload: rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 50,
    message: { error: 'Upload limit exceeded', retryAfter: '1 hour' }
  })
};

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  idParam: z.object({
    id: z.coerce.number().positive()
  }),
  
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(10)
  }),
  
  email: z.string().email().max(254),
  
  password: z.string().min(8).max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number')
}; 