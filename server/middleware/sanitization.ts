import { Request, Response, NextFunction } from "express";
import DOMPurify from "isomorphic-dompurify";
import validator from "validator";

export const sanitizeHtml = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.body) {
    const authEndpoints = [
      "/api/auth/login",
      "/api/auth/register",
      "/api/auth/set-password",
      "/api/auth/validate-password-reset-token",
    ];
    const isAuthEndpoint = authEndpoints.some((endpoint) =>
      req.path.includes(endpoint)
    );

    if (isAuthEndpoint) {
      // For auth endpoints, only sanitize non-credential fields
      req.body = sanitizeAuthObject(req.body);
    } else {
      req.body = sanitizeObject(req.body);
    }
  }
  next();
};

function sanitizeObject(obj: any): any {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

function sanitizeAuthObject(obj: any): any {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const credentialFields = ["email", "password", "token", "confirmPassword"];
  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (credentialFields.includes(key) && typeof value === "string") {
      sanitized[key] = value.toString().trim();
    } else if (typeof value === "string") {
      sanitized[key] = value.toString().trim();
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function sanitizeString(str: string): string {
  if (!str || typeof str !== "string") return str;

  let cleaned = DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });

  cleaned = validator.escape(cleaned); // Escape HTML entities
  cleaned = cleaned.trim(); // Remove whitespace

  cleaned = cleaned.replace(/javascript:/gi, "");
  cleaned = cleaned.replace(/vbscript:/gi, "");
  cleaned = cleaned.replace(/onload/gi, "");
  cleaned = cleaned.replace(/onerror/gi, "");

  return cleaned;
}

export const preventSqlInjection = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authEndpoints = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/set-password",
    "/api/auth/validate-password-reset-token",
  ];
  const isAuthEndpoint = authEndpoints.some((endpoint) =>
    req.path.includes(endpoint)
  );

  if (isAuthEndpoint) {
    return next();
  }

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b.*\b(FROM|WHERE|INTO|TABLE|DATABASE)\b)/gi,
    /(;\s*--)|(--\s*$)/gi,
    /(\|\|.*SELECT)|(\|\|.*DROP)/gi,
  ];

  const checkForSqlInjection = (obj: any): boolean => {
    if (typeof obj === "string") {
      if (obj.length < 10) return false;
      if (/^[&\w;@\.\-\s]+$/.test(obj)) return false;

      return sqlPatterns.some((pattern) => pattern.test(obj));
    }

    if (Array.isArray(obj)) {
      return obj.some((item) => checkForSqlInjection(item));
    }

    if (obj && typeof obj === "object") {
      return Object.values(obj).some((value) => checkForSqlInjection(value));
    }

    return false;
  };

  if (req.body && checkForSqlInjection(req.body)) {
    console.warn(`SQL injection attempt detected from ${req.ip}:`, {
      url: req.path,
      body: process.env.NODE_ENV === "development" ? req.body : "[REDACTED]",
    });
    return res.status(400).json({
      error: "Invalid input detected",
      message: "Your request contains potentially harmful content",
    });
  }

  next();
};

export const validateEmail = (
  email: string
): { isValid: boolean; sanitized: string; errors: string[] } => {
  const errors: string[] = [];
  let sanitized = email?.toString().trim().toLowerCase() || "";

  if (!validator.isEmail(sanitized)) {
    errors.push("Invalid email format");
  }

  if (
    sanitized.includes("<") ||
    sanitized.includes(">") ||
    sanitized.includes('"')
  ) {
    errors.push("Email contains invalid characters");
    sanitized = validator.escape(sanitized);
  }

  if (sanitized.length > 254) {
    errors.push("Email too long");
  }

  if (sanitized.includes("..")) {
    errors.push("Invalid email domain");
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
};

export const validatePhoneNumber = (
  phone: string
): { isValid: boolean; sanitized: string; errors: string[] } => {
  const errors: string[] = [];
  let sanitized = phone?.toString().trim() || "";

  sanitized = sanitized.replace(/[\s\-\(\)\+\.]/g, "");

  if (!/^\d+$/.test(sanitized)) {
    errors.push("Phone number must contain only digits");
  }
  if (sanitized.length < 10 || sanitized.length > 15) {
    errors.push("Phone number must be 10-15 digits");
  }

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
  };
};
