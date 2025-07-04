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
 * SQL Injection Prevention
 */
export function preventSqlInjection(req: Request, res: Response, next: NextFunction) {
  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i
  ];

  const checkForSqlInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    } else if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSqlInjection(value));
    }
    return false;
  };

  if (checkForSqlInjection(req.body) || checkForSqlInjection(req.query)) {
    console.error('🚨 SQL INJECTION ATTEMPT:', {
      ip: req.ip,
      url: req.originalUrl,
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
    max: 1000,
    message: { error: 'Too many requests', retryAfter: '15 minutes' }
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