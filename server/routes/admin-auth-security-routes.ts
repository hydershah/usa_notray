import { Router, Request, Response } from 'express';
import { verifyToken, requireNotaryOrAdmin, canAccessAdminFeatures } from '../auth';
import { AccountLockout } from '../middleware/account-lockout';

const router = Router();

// Local middleware to require admin (compatible with existing pattern)
const requireAdmin = (req: any, res: Response, next: any) => {
  if (!req.user || !canAccessAdminFeatures(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/admin/auth/locked-accounts
// Returns a list of currently locked accounts (by identifier, typically email)
router.get('/auth/locked-accounts', verifyToken, requireAdmin, (req: Request, res: Response) => {
  const locked = AccountLockout.listLockedAccounts();
  res.json({ lockedAccounts: locked });
});

// POST /api/admin/auth/unlock
// Body: { identifier: string }
// Unlocks a specific identifier
router.post('/auth/unlock', verifyToken, requireAdmin, (req: Request, res: Response) => {
  const identifierRaw = (req.body && (req.body.identifier as string)) || '';
  const identifier = String(identifierRaw).trim().toLowerCase();
  if (!identifier) {
    return res.status(400).json({ error: 'identifier is required' });
  }
  const unlocked = AccountLockout.adminUnlock(identifier);
  res.json({ success: true, unlocked });
});

export default router; 