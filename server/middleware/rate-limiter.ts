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
      retryAfter: 15 * 60
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

// OTP verification rate limiting
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per window per IP/email
  message: {
    error: 'Too many OTP attempts',
    message: 'Please wait 5 minutes before trying again',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip + ':' + (req.body?.email || 'unknown');
  },
  skipSuccessfulRequests: true,
  handler: (req: Request, res: Response) => {
    console.log(`OTP rate limit exceeded for ${req.ip} - ${req.body?.email}`);
    res.status(429).json({
      error: 'Too many OTP attempts',
      message: 'Please wait before requesting another verification code',
      retryAfter: 5 * 60
    });
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
  windowMs: 15 * 60 * 1000, // 15 minutes (reduced from 1 hour)
  max: 10, // 10 password reset attempts per window (increased from 3)
  message: {
    error: 'Too many password reset attempts',
    message: 'Please try again in 15 minutes'
  }
}); 