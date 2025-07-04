import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

// HTML sanitization for text fields
export const sanitizeHtml = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  next();
};

// Recursively sanitize object properties
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Sanitize individual strings
function sanitizeString(str: string): string {
  if (!str || typeof str !== 'string') return str;
  
  // Remove HTML tags and escape entities
  let cleaned = DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });
  
  // Additional security measures
  cleaned = validator.escape(cleaned); // Escape HTML entities
  cleaned = cleaned.trim(); // Remove whitespace
  
  // Remove potential script injections
  cleaned = cleaned.replace(/javascript:/gi, '');
  cleaned = cleaned.replace(/vbscript:/gi, '');
  cleaned = cleaned.replace(/onload/gi, '');
  cleaned = cleaned.replace(/onerror/gi, '');
  
  return cleaned;
}

// SQL injection prevention (additional layer)
export const preventSqlInjection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /('|(\\');|(\"|\\");)/gi,
    /(;|\-\-|\||\/\*|\*\/)/gi
  ];
  
  const checkForSqlInjection = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return sqlPatterns.some(pattern => pattern.test(obj));
    }
    
    if (Array.isArray(obj)) {
      return obj.some(item => checkForSqlInjection(item));
    }
    
    if (obj && typeof obj === 'object') {
      return Object.values(obj).some(value => checkForSqlInjection(value));
    }
    
    return false;
  };
  
  if (req.body && checkForSqlInjection(req.body)) {
    console.warn(`SQL injection attempt detected from ${req.ip}:`, req.body);
    return res.status(400).json({
      error: 'Invalid input detected',
      message: 'Your request contains potentially harmful content'
    });
  }
  
  next();
};

// Validate and sanitize email addresses
export const validateEmail = (email: string): { isValid: boolean; sanitized: string; errors: string[] } => {
  const errors: string[] = [];
  let sanitized = email?.toString().trim().toLowerCase() || '';
  
  // Basic format validation
  if (!validator.isEmail(sanitized)) {
    errors.push('Invalid email format');
  }
  
  // Check for dangerous characters
  if (sanitized.includes('<') || sanitized.includes('>') || sanitized.includes('"')) {
    errors.push('Email contains invalid characters');
    sanitized = validator.escape(sanitized);
  }
  
  // Length validation
  if (sanitized.length > 254) {
    errors.push('Email too long');
  }
  
  // Domain validation
  if (sanitized.includes('..')) {
    errors.push('Invalid email domain');
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
};

// Validate and sanitize phone numbers
export const validatePhoneNumber = (phone: string): { isValid: boolean; sanitized: string; errors: string[] } => {
  const errors: string[] = [];
  let sanitized = phone?.toString().trim() || '';
  
  // Remove common formatting characters
  sanitized = sanitized.replace(/[\s\-\(\)\+\.]/g, '');
  
  // Validate contains only numbers after cleaning
  if (!/^\d+$/.test(sanitized)) {
    errors.push('Phone number must contain only digits');
  }
  
  // Length validation (US format)
  if (sanitized.length < 10 || sanitized.length > 15) {
    errors.push('Phone number must be 10-15 digits');
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}; 