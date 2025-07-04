import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
  userId?: number;
  requestId?: string;
  timestamp?: string;
}

export interface ErrorContext {
  method: string;
  url: string;
  userId?: number;
  userRole?: string;
  ip: string;
  userAgent: string;
  requestId: string;
  timestamp: string;
  duration: number;
}

export class AppError extends Error implements APIError {
  public statusCode: number;
  public code: string;
  public details?: any;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types for consistency
export const ErrorTypes = {
  VALIDATION_ERROR: (message: string, details?: any) => 
    new AppError(message, 400, 'VALIDATION_ERROR', details),
  
  UNAUTHORIZED: (message: string = 'Unauthorized access') => 
    new AppError(message, 401, 'UNAUTHORIZED'),
  
  FORBIDDEN: (message: string = 'Access forbidden') => 
    new AppError(message, 403, 'FORBIDDEN'),
  
  NOT_FOUND: (resource: string) => 
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),
  
  CONFLICT: (message: string) => 
    new AppError(message, 409, 'CONFLICT'),
  
  RATE_LIMITED: (message: string = 'Too many requests') => 
    new AppError(message, 429, 'RATE_LIMITED'),
  
  DATABASE_ERROR: (message: string, details?: any) => 
    new AppError(`Database error: ${message}`, 500, 'DATABASE_ERROR', details),
  
  EXTERNAL_SERVICE_ERROR: (service: string, message?: string) => 
    new AppError(`External service error: ${service}${message ? ` - ${message}` : ''}`, 502, 'EXTERNAL_SERVICE_ERROR'),
  
  FILE_UPLOAD_ERROR: (message: string) => 
    new AppError(`File upload error: ${message}`, 400, 'FILE_UPLOAD_ERROR'),
  
  CACHE_ERROR: (message: string) => 
    new AppError(`Cache error: ${message}`, 500, 'CACHE_ERROR'),
};

/**
 * Generate unique request ID for tracking
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Request ID middleware - adds unique ID to each request
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = generateRequestId();
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

/**
 * Extract error context from request
 */
function getErrorContext(req: Request, startTime: number): ErrorContext {
  const duration = performance.now() - startTime;
  return {
    method: req.method,
    url: req.originalUrl,
    userId: (req as any).user?.id,
    userRole: (req as any).user?.role,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    requestId: (req as any).requestId || 'unknown',
    timestamp: new Date().toISOString(),
    duration: Math.round(duration)
  };
}

/**
 * Standardized error response format
 */
function formatErrorResponse(error: APIError, context: ErrorContext) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const response: any = {
    success: false,
    error: {
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      statusCode: error.statusCode || 500,
      timestamp: context.timestamp,
      requestId: context.requestId
    }
  };

  // Add details if available and not in production
  if (error.details && !isProduction) {
    response.error.details = error.details;
  }

  // Add stack trace in development
  if (!isProduction && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

/**
 * Log error with full context
 */
function logError(error: APIError, context: ErrorContext) {
  const logLevel = error.statusCode && error.statusCode < 500 ? 'warn' : 'error';
  
  const logData = {
    level: logLevel,
    message: error.message,
    error: {
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
      details: error.details
    },
    context,
    performance: {
      duration: context.duration,
      slow: context.duration > 1000
    }
  };

  if (logLevel === 'error') {
    console.error('🚨 API ERROR:', JSON.stringify(logData, null, 2));
  } else {
    console.warn('⚠️ API WARNING:', JSON.stringify(logData, null, 2));
  }
}

/**
 * Main error handling middleware
 */
export function errorHandler(
  error: Error | APIError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = (req as any).startTime || performance.now();
  const context = getErrorContext(req, startTime);

  // Convert regular errors to APIError
  let apiError: APIError;
  if (error instanceof AppError) {
    apiError = error;
  } else {
    // Handle common error types
    if (error.name === 'ValidationError') {
      apiError = ErrorTypes.VALIDATION_ERROR(error.message);
    } else if (error.name === 'MulterError') {
      apiError = ErrorTypes.FILE_UPLOAD_ERROR(error.message);
    } else if (error.message?.includes('duplicate key')) {
      apiError = ErrorTypes.CONFLICT('Resource already exists');
    } else if (error.message?.includes('not found')) {
      apiError = ErrorTypes.NOT_FOUND('Resource');
    } else {
      // Generic server error
      apiError = new AppError(
        process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
        500,
        'INTERNAL_ERROR',
        process.env.NODE_ENV === 'development' ? error.stack : undefined,
        false
      );
    }
  }

  // Log the error
  logError(apiError, context);

  // Send standardized response
  const response = formatErrorResponse(apiError, context);
  res.status(apiError.statusCode || 500).json(response);
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = ErrorTypes.NOT_FOUND(`Route ${req.method} ${req.originalUrl}`);
  next(error);
}

/**
 * Async error wrapper - catches async errors and passes to error handler
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    const startTime = performance.now();
    (req as any).startTime = startTime;
    
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Performance monitoring middleware
 */
export function performanceTracker(req: Request, res: Response, next: NextFunction) {
  const startTime = performance.now();
  (req as any).startTime = startTime;

  res.on('finish', () => {
    const duration = performance.now() - startTime;
    const context = getErrorContext(req, startTime);
    
    // Log slow requests
    if (duration > 1000) {
      console.warn('🐌 SLOW REQUEST:', {
        method: req.method,
        url: req.originalUrl,
        duration: Math.round(duration) + 'ms',
        statusCode: res.statusCode,
        requestId: context.requestId,
        userId: context.userId
      });
    }

    // Log errors based on status code
    if (res.statusCode >= 400) {
      const logLevel = res.statusCode >= 500 ? 'error' : 'warn';
      const emoji = res.statusCode >= 500 ? '🚨' : '⚠️';
      
      console[logLevel](`${emoji} HTTP ${res.statusCode}:`, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: Math.round(duration) + 'ms',
        requestId: context.requestId,
        userId: context.userId
      });
    }
  });

  next();
} 