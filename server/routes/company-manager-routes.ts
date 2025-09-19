import { Express, Request, Response } from 'express';
import { companyManagerService } from '../services/CompanyManagerService.js';
import { 
  inviteManagerSchema, 
  updateManagerPermissionsSchema, 
  createPermissionTemplateSchema 
} from '../../shared/types/manager-types.js';
import { verifyToken } from '../auth.js';
import { validateEmailUniqueness } from '../middleware/email-validation.js';
import { db } from '../db.js';
import { companies } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role: string;
    companyId?: number;
  };
}

export function registerCompanyManagerRoutes(app: Express) {
  
  /**
   * GET /api/companies/:companyId/managers
   * Get all managers for a company
   */
  app.get('/api/companies/:companyId/managers', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      if (isNaN(companyId)) {
        return res.status(400).json({ error: 'Invalid company ID' });
      }

      // Check if user has access to this company
      const canAccess = req.user.role === 'admin' || 
                       req.user.companyId === companyId ||
                       await companyManagerService.hasManagerAccess(req.user.id, companyId);

      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const managers = await companyManagerService.getCompanyManagers(companyId);
      
      res.json({
        success: true,
        managers
      });

    } catch (error) {
      console.error('Error getting company managers:', error);
      res.status(500).json({ error: 'Failed to get company managers' });
    }
  });

  /**
   * POST /api/companies/:companyId/managers/invite
   * Invite a new manager to a company
   */
  app.post('/api/companies/:companyId/managers/invite', verifyToken, validateEmailUniqueness, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      if (isNaN(companyId)) {
        return res.status(400).json({ error: 'Invalid company ID' });
      }

      // Validate request body
      const validationResult = inviteManagerSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: validationResult.error.errors
        });
      }

      const managerData = validationResult.data;

      // Check if user can manage managers for this company
      const canManage = req.user.role === 'admin' || 
                       await companyManagerService.canUserPerformAction(
                         req.user.id, companyId, 'company', 'manage_managers'
                       );

      if (!canManage) {
        return res.status(403).json({ error: 'Access denied. You cannot manage managers for this company.' });
      }

      // Check if company exists
      const [company] = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);

      if (!company) {
        return res.status(404).json({ error: 'Company not found' });
      }

      const result = await companyManagerService.inviteManager(
        companyId,
        req.user.id,
        managerData
      );

      res.status(201).json({
        success: true,
        message: 'Manager invited successfully',
        manager: result.manager,
        userCreated: result.userCreated
      });

    } catch (error) {
      console.error('Error inviting manager:', error);
      res.status(500).json({ error: 'Failed to invite manager' });
    }
  });

  /**
   * PUT /api/companies/:companyId/managers/:managerId/permissions
   * Update manager permissions
   */
  app.put('/api/companies/:companyId/managers/:managerId/permissions', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const managerId = parseInt(req.params.managerId);
      
      if (isNaN(companyId) || isNaN(managerId)) {
        return res.status(400).json({ error: 'Invalid company ID or manager ID' });
      }

      // Validate request body
      const validationResult = updateManagerPermissionsSchema.safeParse({
        managerId,
        ...req.body
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: validationResult.error.errors
        });
      }

      const updateData = validationResult.data;

      // Check if user can manage managers for this company
      const canManage = req.user.role === 'admin' || 
                       await companyManagerService.canUserPerformAction(
                         req.user.id, companyId, 'company', 'manage_managers'
                       );

      if (!canManage) {
        return res.status(403).json({ error: 'Access denied. You cannot manage managers for this company.' });
      }

      const updatedManager = await companyManagerService.updateManagerPermissions(
        managerId,
        req.user.id,
        {
          permissions: updateData.permissions,
          managerRole: updateData.managerRole,
        }
      );

      res.json({
        success: true,
        message: 'Manager permissions updated successfully',
        manager: updatedManager
      });

    } catch (error) {
      console.error('Error updating manager permissions:', error);
      res.status(500).json({ error: 'Failed to update manager permissions' });
    }
  });

  /**
   * PUT /api/companies/:companyId/managers/:managerId/accept
   * Accept manager invitation
   */
  app.put('/api/companies/:companyId/managers/:managerId/accept', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const managerId = parseInt(req.params.managerId);
      
      if (isNaN(companyId) || isNaN(managerId)) {
        return res.status(400).json({ error: 'Invalid company ID or manager ID' });
      }

      // Check if this is the correct user accepting their own invitation
      const manager = await companyManagerService.getManagerByUserAndCompany(req.user.id, companyId);
      
      if (!manager || manager.id !== managerId) {
        return res.status(403).json({ error: 'You can only accept your own invitation' });
      }

      if (manager.status !== 'pending') {
        return res.status(400).json({ error: 'Invitation has already been accepted or is no longer valid' });
      }

      const acceptedManager = await companyManagerService.acceptInvitation(managerId, req.user.id);

      res.json({
        success: true,
        message: 'Invitation accepted successfully',
        manager: acceptedManager
      });

    } catch (error) {
      console.error('Error accepting invitation:', error);
      res.status(500).json({ error: 'Failed to accept invitation' });
    }
  });

  /**
   * DELETE /api/companies/:companyId/managers/:managerId
   * Remove manager from company
   */
  app.delete('/api/companies/:companyId/managers/:managerId', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const managerId = parseInt(req.params.managerId);
      
      if (isNaN(companyId) || isNaN(managerId)) {
        return res.status(400).json({ error: 'Invalid company ID or manager ID' });
      }

      // Check if user can manage managers for this company
      const canManage = req.user.role === 'admin' || 
                       await companyManagerService.canUserPerformAction(
                         req.user.id, companyId, 'company', 'manage_managers'
                       );

      if (!canManage) {
        return res.status(403).json({ error: 'Access denied. You cannot manage managers for this company.' });
      }

      await companyManagerService.removeManager(managerId, req.user.id);

      res.json({
        success: true,
        message: 'Manager removed successfully'
      });

    } catch (error) {
      console.error('Error removing manager:', error);
      if (error.message === 'Cannot remove primary manager') {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to remove manager' });
    }
  });

  /**
   * GET /api/companies/:companyId/permission-templates
   * Get permission templates for a company
   */
  app.get('/api/companies/:companyId/permission-templates', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      if (isNaN(companyId)) {
        return res.status(400).json({ error: 'Invalid company ID' });
      }

      // Check if user has access to this company
      const canAccess = req.user.role === 'admin' || 
                       req.user.companyId === companyId ||
                       await companyManagerService.hasManagerAccess(req.user.id, companyId);

      if (!canAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const templates = await companyManagerService.getPermissionTemplates(companyId);
      
      res.json({
        success: true,
        templates
      });

    } catch (error) {
      console.error('Error getting permission templates:', error);
      res.status(500).json({ error: 'Failed to get permission templates' });
    }
  });

  /**
   * POST /api/companies/:companyId/permission-templates
   * Create permission template
   */
  app.post('/api/companies/:companyId/permission-templates', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      if (isNaN(companyId)) {
        return res.status(400).json({ error: 'Invalid company ID' });
      }

      // Validate request body
      const validationResult = createPermissionTemplateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: validationResult.error.errors
        });
      }

      const templateData = validationResult.data;

      // Check if user can manage managers for this company
      const canManage = req.user.role === 'admin' || 
                       await companyManagerService.canUserPerformAction(
                         req.user.id, companyId, 'company', 'manage_managers'
                       );

      if (!canManage) {
        return res.status(403).json({ error: 'Access denied. You cannot manage permission templates for this company.' });
      }

      const template = await companyManagerService.createPermissionTemplate(
        companyId,
        req.user.id,
        templateData
      );

      res.status(201).json({
        success: true,
        message: 'Permission template created successfully',
        template
      });

    } catch (error) {
      console.error('Error creating permission template:', error);
      res.status(500).json({ error: 'Failed to create permission template' });
    }
  });

  /**
   * GET /api/companies/:companyId/activity-log
   * Get activity log for a company
   */
  app.get('/api/companies/:companyId/activity-log', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      if (isNaN(companyId)) {
        return res.status(400).json({ error: 'Invalid company ID' });
      }

      // Check if user can view reports for this company
      const canView = req.user.role === 'admin' || 
                     await companyManagerService.canUserPerformAction(
                       req.user.id, companyId, 'company', 'view_reports'
                     );

      if (!canView) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const activityLog = await companyManagerService.getActivityLog(companyId, limit, offset);
      
      res.json({
        success: true,
        activityLog,
        pagination: {
          limit,
          offset,
          total: activityLog.length
        }
      });

    } catch (error) {
      console.error('Error getting activity log:', error);
      res.status(500).json({ error: 'Failed to get activity log' });
    }
  });

  /**
   * GET /api/companies/:companyId/managers/me
   * Get current user's manager status for a company
   */
  app.get('/api/companies/:companyId/managers/me', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const companyId = parseInt(req.params.companyId);
      
      if (isNaN(companyId)) {
        return res.status(400).json({ error: 'Invalid company ID' });
      }

      const manager = await companyManagerService.getManagerByUserAndCompany(req.user.id, companyId);
      
      if (!manager) {
        return res.status(404).json({ error: 'Manager status not found' });
      }

      res.json({
        success: true,
        manager
      });

    } catch (error) {
      console.error('Error getting manager status:', error);
      res.status(500).json({ error: 'Failed to get manager status' });
    }
  });
}
