import { Express } from 'express';
import { insertCompanySchema, insertUserSchema } from '../shared/schema.js';
import { storage } from './storage';
import bcrypt from 'bcrypt';
import { verifyToken, hasAdminPrivileges } from './auth.js';

export function registerCompanyRoutes(app: Express) {
  
  // ============================================================================
  // COMPANY REGISTRATION ROUTES
  // ============================================================================
  
  /**
   * POST /api/companies/register
   * Register a new company with a primary user (company manager)
   * This implements the "Sign-up Company" option from requirements
   */
  app.post('/api/companies/register', async (req, res) => {
    try {
      const {
        // Company data
        companyName,
        address1,
        address2,
        city,
        state,
        zipCode,
        billingAddress1,
        billingAddress2,
        billingCity,
        billingState,
        billingZipCode,
        paymentMethod,
        contactName,
        email,
        phoneNumber,
        
        // Primary user data
        primaryUserName,
        primaryUserEmail,
        primaryUserPassword,
        
        // Optional fields
        defaultClosingType,
        allowUserSelfRegistration = false,
        requiresApprovalForNewUsers = true
      } = req.body;

      // Validate required fields
      if (!companyName || !primaryUserName || !primaryUserEmail || !primaryUserPassword ||
          !address1 || !city || !state || !zipCode || !paymentMethod || !contactName || !email) {
        return res.status(400).json({ 
          message: 'Missing required fields. Please check that all required company and user information is provided.' 
        });
      }

      // Check if company already exists
      const existingCompany = await storage.getCompanyByName(companyName);
      if (existingCompany) {
        return res.status(409).json({ message: 'Company with this name already exists' });
      }

      // Check if primary user email already exists
      const existingUser = await storage.getUserByEmail(primaryUserEmail);
      if (existingUser) {
        return res.status(409).json({ message: 'User with this email already exists' });
      }

      // Prepare company data
      const companyData = {
        companyName,
        primaryUserName,
        primaryUserEmail,
        address1,
        address2,
        city,
        state,
        zipCode,
        billingAddress1: billingAddress1 || address1,
        billingAddress2: billingAddress2 || address2,
        billingCity: billingCity || city,
        billingState: billingState || state,
        billingZipCode: billingZipCode || zipCode,
        paymentMethod,
        contactName,
        email,
        phoneNumber,
        defaultClosingType,
        allowUserSelfRegistration,
        requiresApprovalForNewUsers,
        status: 'pending' // Companies now require admin approval
      };

      // Prepare primary user data  
      const managerData = {
        username: primaryUserEmail, // Use email as username
        email: primaryUserEmail,
        password: primaryUserPassword,
        firstName: primaryUserName.split(' ')[0] || primaryUserName,
        lastName: primaryUserName.split(' ').slice(1).join(' ') || '',
        fullName: primaryUserName,
        phoneNumber: phoneNumber,
        role: 'company_manager',
        companyRole: 'manager',
        isActive: true,
        approvalStatus: 'approved' // Company managers are auto-approved
      };

      // Register company and manager in a transaction-like operation
      const result = await storage.registerCompany(companyData, managerData);

      // Update company with manager reference
      await storage.updateCompany(result.company.id, {
        companyManagerId: result.manager.id,
        createdBy: result.manager.id,
        lastModifiedBy: result.manager.id
      });

      // Invalidate cache to ensure fresh data on next request
      try {
        const { redisCache } = await import('./services/redis-cache');
        await redisCache.delPattern(`admin:*`); // Clear admin caches
        await redisCache.delPattern(`user:*`); // Clear all user caches
        await redisCache.delPattern(`api:*users*`); // Clear users API cache
        await redisCache.delPattern(`api:*companies*`); // Clear companies API cache
        console.log(`🧹 Invalidated caches after company registration ${result.company.id}`);
      } catch (cacheError) {
        console.error('Failed to invalidate cache after company registration:', cacheError);
        // Don't fail the request if cache invalidation fails
      }

      res.status(201).json({
        message: 'Company registration submitted successfully. Your application is pending admin approval.',
        company: {
          id: result.company.id,
          companyName: result.company.companyName,
          status: result.company.status,
          paymentMethod: result.company.paymentMethod
        },
        manager: {
          id: result.manager.id,
          username: result.manager.username,
          email: result.manager.email,
          fullName: result.manager.fullName,
          role: result.manager.role
        }
      });

    } catch (error) {
      console.error('Company registration error:', error);
      res.status(500).json({ message: 'Internal server error during company registration' });
    }
  });

  // ============================================================================
  // QUICK UPDATE ROUTES (for partial updates)
  // ============================================================================

  /**
   * PATCH /api/companies/:id/status
   * Quick status toggle for companies
   */
  app.patch('/api/companies/:id/status', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { status } = req.body;

      // Check permissions - only admins can change company status
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      if (!['active', 'inactive', 'pending', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const updatedCompany = await storage.updateCompany(companyId, { 
        status,
        lastModifiedBy: req.user.id 
      });

      if (!updatedCompany) {
        return res.status(404).json({ message: 'Company not found' });
      }

      res.json({ 
        id: updatedCompany.id,
        companyName: updatedCompany.companyName,
        status: updatedCompany.status 
      });
    } catch (error) {
      console.error('Update company status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * PATCH /api/companies/:id/quick-update
   * Update specific company fields without requiring all data
   */
  app.patch('/api/companies/:id/quick-update', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const updates = req.body;

      // Check permissions
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      const canUpdate = hasAdminPrivileges(req.user) || 
                       (req.user.role === 'company_manager' && req.user.companyId === companyId);

      if (!canUpdate) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Remove empty/undefined values
      const cleanUpdates: any = {};
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined && updates[key] !== '' && updates[key] !== null) {
          cleanUpdates[key] = updates[key];
        }
      });

      // Add audit fields
      cleanUpdates.lastModifiedBy = req.user.id;
      cleanUpdates.updatedAt = new Date();

      const updatedCompany = await storage.updateCompany(companyId, cleanUpdates);

      if (!updatedCompany) {
        return res.status(404).json({ message: 'Company not found' });
      }

      res.json(updatedCompany);
    } catch (error) {
      console.error('Quick update company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // COMPANY APPROVAL ROUTES
  // ============================================================================

  /**
   * GET /api/admin/companies/pending
   * Get all pending company registrations (admin only)
   */
  app.get('/api/admin/companies/pending', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const companies = await storage.getCompaniesByStatus('pending');
      res.json(companies);
    } catch (error) {
      console.error('Get pending companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/admin/companies/:id/approve
   * Approve a pending company registration (admin only)
   */
  app.post('/api/admin/companies/:id/approve', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const companyId = parseInt(req.params.id);
      const { notes } = req.body;

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      if (company.status !== 'pending') {
        return res.status(400).json({ message: 'Company is not pending approval' });
      }

      // Approve the company
      const updatedCompany = await storage.updateCompany(companyId, {
        status: 'active',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        approvalNotes: notes,
        lastModifiedBy: req.user.id
      });

      if (!updatedCompany) {
        return res.status(500).json({ message: 'Failed to approve company' });
      }

      // TODO: Send email notification to company manager about approval

      res.json({
        message: 'Company approved successfully',
        company: updatedCompany
      });
    } catch (error) {
      console.error('Approve company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/admin/companies/:id/reject
   * Reject a pending company registration (admin only)
   */
  app.post('/api/admin/companies/:id/reject', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const companyId = parseInt(req.params.id);
      const { notes, reason } = req.body;

      if (!reason) {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }

      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      if (company.status !== 'pending') {
        return res.status(400).json({ message: 'Company is not pending approval' });
      }

      // Reject the company
      const updatedCompany = await storage.updateCompany(companyId, {
        status: 'rejected',
        approvedBy: req.user.id,
        approvedAt: new Date(),
        approvalNotes: `${reason}${notes ? ` - ${notes}` : ''}`,
        lastModifiedBy: req.user.id
      });

      if (!updatedCompany) {
        return res.status(500).json({ message: 'Failed to reject company' });
      }

      // TODO: Send email notification to company manager about rejection

      res.json({
        message: 'Company rejected successfully',
        company: updatedCompany
      });
    } catch (error) {
      console.error('Reject company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // COMPANY MANAGEMENT ROUTES
  // ============================================================================

  /**
   * GET /api/companies
   * Get all companies (admin only)
   */
  app.get('/api/companies', verifyToken, async (req: any, res) => {
    try {
      if (!hasAdminPrivileges(req.user)) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
      console.error('Get companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * GET /api/companies/active
   * Get all active companies
   */
  app.get('/api/companies/active', verifyToken, async (req: any, res) => {
    try {
      const companies = await storage.getActiveCompanies();
      res.json(companies.map(company => ({
        id: company.id,
        companyName: company.companyName,
        contactName: company.contactName,
        email: company.email,
        city: company.city,
        state: company.state,
        paymentMethod: company.paymentMethod
      })));
    } catch (error) {
      console.error('Get active companies error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * GET /api/companies/:id
   * Get company details
   */
  app.get('/api/companies/:id', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const company = await storage.getCompany(companyId);

      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      // Check access rights
      const canAccess = req.user.role === 'admin' || 
                       req.user.companyId === companyId ||
                       (req.user.role === 'company_manager' && req.user.companyId === companyId);

      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Get company users
      const companyUsers = await storage.getUsersByCompany(companyId);

      res.json({
        ...company,
        users: companyUsers.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          companyRole: user.companyRole,
          isActive: user.isActive,
          createdAt: user.createdAt
        }))
      });
    } catch (error) {
      console.error('Get company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * PUT /api/companies/:id
   * Update company details (company managers and admins only)
   */
  app.put('/api/companies/:id', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      
      // Check permissions
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      const canUpdate = req.user.role === 'admin' || 
                       (req.user.role === 'company_manager' && req.user.companyId === companyId);

      if (!canUpdate) {
        return res.status(403).json({ message: 'Access denied. Only company managers and admins can update company details.' });
      }

      const updateData = {
        ...req.body,
        lastModifiedBy: req.user.id
      };

      const updatedCompany = await storage.updateCompany(companyId, updateData);
      
      if (!updatedCompany) {
        return res.status(404).json({ message: 'Company not found' });
      }

      res.json(updatedCompany);
    } catch (error) {
      console.error('Update company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // COMPANY USER MANAGEMENT ROUTES
  // ============================================================================

  /**
   * POST /api/companies/:id/users
   * Add a user to a company or invite a new user
   */
  app.post('/api/companies/:id/users', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const { email, companyRole, sendInvite = true } = req.body;

      // Check permissions
      const company = await storage.getCompany(companyId);
      if (!company) {
        return res.status(404).json({ message: 'Company not found' });
      }

      const canManageUsers = req.user.role === 'admin' || 
                           (req.user.role === 'company_manager' && req.user.companyId === companyId);

      if (!canManageUsers) {
        return res.status(403).json({ message: 'Access denied. Only company managers and admins can manage company users.' });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      
      if (existingUser) {
        // User exists, add to company
        if (existingUser.companyId) {
          return res.status(409).json({ message: 'User is already associated with a company' });
        }

        const success = await storage.addUserToCompany(existingUser.id, companyId, companyRole);
        if (success) {
          res.json({ 
            message: 'User added to company successfully',
            userId: existingUser.id 
          });
        } else {
          res.status(500).json({ message: 'Failed to add user to company' });
        }
      } else {
        // User doesn't exist - create invitation or return error based on company settings
        if (!company.allowUserSelfRegistration) {
          return res.status(400).json({ 
            message: 'User not found and company does not allow user self-registration. Please contact the user to register first.' 
          });
        }

        // For now, return information about the invitation process
        // In a full implementation, you would send an email invitation
        res.json({ 
          message: 'User not found. An invitation has been sent to the email address.',
          invitationSent: true,
          email: email
        });
      }
    } catch (error) {
      console.error('Add company user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * PUT /api/companies/:id/users/:userId
   * Update user's role in the company
   */
  app.put('/api/companies/:id/users/:userId', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);
      const { companyRole } = req.body;

      // Check permissions
      const canManageUsers = req.user.role === 'admin' || 
                           (req.user.role === 'company_manager' && req.user.companyId === companyId);

      if (!canManageUsers) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const success = await storage.updateUserCompanyRole(userId, companyRole);
      
      if (success) {
        res.json({ message: 'User role updated successfully' });
      } else {
        res.status(500).json({ message: 'Failed to update user role' });
      }
    } catch (error) {
      console.error('Update user company role error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/companies/:id/users/:userId
   * Remove user from company
   */
  app.delete('/api/companies/:id/users/:userId', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      // Check permissions
      const canManageUsers = req.user.role === 'admin' || 
                           (req.user.role === 'company_manager' && req.user.companyId === companyId);

      if (!canManageUsers) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Don't allow removing the company manager
      const company = await storage.getCompany(companyId);
      if (company?.companyManagerId === userId) {
        return res.status(400).json({ message: 'Cannot remove the company manager. Transfer management first.' });
      }

      const success = await storage.removeUserFromCompany(userId);
      
      if (success) {
        res.json({ message: 'User removed from company successfully' });
      } else {
        res.status(500).json({ message: 'Failed to remove user from company' });
      }
    } catch (error) {
      console.error('Remove user from company error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/companies/:id/authorized-users/:userId
   * Add user to authorized users list
   */
  app.post('/api/companies/:id/authorized-users/:userId', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      // Check permissions
      const canManageUsers = req.user.role === 'admin' || 
                           (req.user.role === 'company_manager' && req.user.companyId === companyId);

      if (!canManageUsers) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const success = await storage.addAuthorizedUser(companyId, userId);
      
      if (success) {
        res.json({ message: 'User added to authorized users list successfully' });
      } else {
        res.status(500).json({ message: 'Failed to add authorized user' });
      }
    } catch (error) {
      console.error('Add authorized user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * DELETE /api/companies/:id/authorized-users/:userId
   * Remove user from authorized users list
   */
  app.delete('/api/companies/:id/authorized-users/:userId', verifyToken, async (req: any, res) => {
    try {
      const companyId = parseInt(req.params.id);
      const userId = parseInt(req.params.userId);

      // Check permissions
      const canManageUsers = req.user.role === 'admin' || 
                           (req.user.role === 'company_manager' && req.user.companyId === companyId);

      if (!canManageUsers) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const success = await storage.removeAuthorizedUser(companyId, userId);
      
      if (success) {
        res.json({ message: 'User removed from authorized users list successfully' });
      } else {
        res.status(500).json({ message: 'Failed to remove authorized user' });
      }
    } catch (error) {
      console.error('Remove authorized user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
} 