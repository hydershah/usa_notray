import { Request, Response, NextFunction } from 'express';

interface LockoutData {
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
}

export class AccountLockout {
  private static attempts = new Map<string, LockoutData>();
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
  
  // Record failed login attempt
  static recordFailedAttempt(identifier: string): LockoutData {
    const now = Date.now();
    const existing = this.attempts.get(identifier);
    
    if (existing && (now - existing.lastAttempt) > this.ATTEMPT_WINDOW) {
      // Reset if outside attempt window
      this.attempts.delete(identifier);
    }
    
    const current = this.attempts.get(identifier) || { attempts: 0, lastAttempt: 0 };
    current.attempts += 1;
    current.lastAttempt = now;
    
    if (current.attempts >= this.MAX_ATTEMPTS) {
      current.lockedUntil = now + this.LOCKOUT_DURATION;
      console.warn(`Account locked: ${identifier} - too many failed attempts`);
    }
    
    this.attempts.set(identifier, current);
    return current;
  }
  
  // Check if account is locked
  static isLocked(identifier: string): { locked: boolean; timeRemaining?: number } {
    const data = this.attempts.get(identifier);
    
    if (!data || !data.lockedUntil) {
      return { locked: false };
    }
    
    const now = Date.now();
    if (now >= data.lockedUntil) {
      // Lockout expired
      this.attempts.delete(identifier);
      return { locked: false };
    }
    
    return { 
      locked: true, 
      timeRemaining: Math.ceil((data.lockedUntil - now) / 1000) 
    };
  }
  
  // Clear successful login
  static clearAttempts(identifier: string): void {
    this.attempts.delete(identifier);
  }
  
  // Get attempt count
  static getAttemptCount(identifier: string): number {
    const data = this.attempts.get(identifier);
    return data?.attempts || 0;
  }

  // List currently locked accounts for admin
  static listLockedAccounts(): Array<{ identifier: string; attempts: number; lastAttempt: number; lockedUntil: number; timeRemainingSeconds: number }> {
    const now = Date.now();
    const result: Array<{ identifier: string; attempts: number; lastAttempt: number; lockedUntil: number; timeRemainingSeconds: number }> = [];
    this.attempts.forEach((data, identifier) => {
      if (data.lockedUntil && data.lockedUntil > now) {
        result.push({
          identifier,
          attempts: data.attempts,
          lastAttempt: data.lastAttempt,
          lockedUntil: data.lockedUntil,
          timeRemainingSeconds: Math.ceil((data.lockedUntil - now) / 1000)
        });
      }
    });
    // Sort by soonest unlock first
    result.sort((a, b) => a.lockedUntil - b.lockedUntil);
    return result;
  }

  // Force unlock a specific identifier (admin)
  static adminUnlock(identifier: string): boolean {
    const normalized = String(identifier).trim().toLowerCase();
    const existed = this.attempts.has(normalized);
    this.attempts.delete(normalized);
    return existed;
  }
}

// Middleware to check account lockout
export const checkAccountLockout = (req: Request, res: Response, next: NextFunction) => {
  const identifierRaw = req.body?.email;
  const identifier = identifierRaw ? String(identifierRaw).trim().toLowerCase() : req.ip;
  
  if (!identifier) {
    return next();
  }
  
  const lockStatus = AccountLockout.isLocked(identifier);
  
  if (lockStatus.locked) {
    const minutes = Math.ceil((lockStatus.timeRemaining || 0) / 60);
    return res.status(423).json({
      error: 'Account temporarily locked',
      message: `Too many failed attempts. Try again in ${minutes} minutes.`,
      lockedUntil: lockStatus.timeRemaining,
      retryAfter: lockStatus.timeRemaining
    });
  }
  
  next();
};

// Record failed attempt middleware
export const recordFailedLogin = (identifier: string) => {
  return AccountLockout.recordFailedAttempt(String(identifier).trim().toLowerCase());
};

// Clear attempts on successful login
export const clearFailedAttempts = (identifier: string) => {
  AccountLockout.clearAttempts(String(identifier).trim().toLowerCase());
}; 