import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Authentication rate limiting
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    error: 'Too many login attempts',
    message: 'Please try again in 15 minutes',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Custom key generator for better tracking
  keyGenerator: (req: Request) => {
    return req.ip + ':' + (req.body?.email || 'unknown');
  },
  // Skip successful requests
  skipSuccessfulRequests: true,
  handler: (req: Request, res: Response) => {
    console.log(`Rate limit exceeded for ${req.ip} - ${req.body?.email}`);
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Please try again later',
      retryAfter: Math.round(req.rateLimit?.resetTime || 0)
    });
  }
});

// Registration rate limiting
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registrations per hour per IP
  message: {
    error: 'Too many registration attempts',
    message: 'Please try again in 1 hour'
  }
});

// API rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    error: 'Too many requests',
    message: 'Please slow down'
  }
});

// File upload rate limiting
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  message: {
    error: 'Upload limit exceeded',
    message: 'Please try again later'
  }
});

// Password reset rate limiting
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour
  message: {
    error: 'Too many password reset attempts',
    message: 'Please try again in 1 hour'
  }
}); 