import { Express } from 'express';
import { insertUserSchema } from '../shared/schema.js';
import { storage } from './storage';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { verifyToken } from './auth.js';

export function registerUserManagementRoutes(app: Express) {
  
  // ============================================================================
  // QUICK UPDATE ROUTES (for partial updates)
  // ============================================================================

  /**
   * PATCH /api/users/:id/quick-update
   * Update specific user fields without requiring all data
   */
  app.patch('/api/users/:id/quick-update', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const updates = req.body;

      // Check permissions
      if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Remove empty/undefined values
      const cleanUpdates: any = {};
      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined && updates[key] !== '' && updates[key] !== null) {
          cleanUpdates[key] = updates[key];
        }
      });

      // Hash password if provided
      if (cleanUpdates.password) {
        cleanUpdates.password = await bcrypt.hash(cleanUpdates.password, 10);
      }

      // Update user with only the provided fields
      const updatedUser = await storage.updateUser(userId, cleanUpdates);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Return updated user without password
      const { password, ...userResponse } = updatedUser;
      res.json(userResponse);
    } catch (error) {
      console.error('Quick update user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * PATCH /api/users/:id/status
   * Quick status toggle for users
   */
  app.patch('/api/users/:id/status', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { isActive, approvalStatus } = req.body;

      // Check permissions - only admins can change user status
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const updates: any = {};
      if (isActive !== undefined) updates.isActive = isActive;
      if (approvalStatus !== undefined) updates.approvalStatus = approvalStatus;

      const updatedUser = await storage.updateUser(userId, updates);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ 
        id: updatedUser.id,
        isActive: updatedUser.isActive,
        approvalStatus: updatedUser.approvalStatus 
      });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * PATCH /api/users/:id/password
   * Quick password reset
   */
  app.patch('/api/users/:id/password', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { password } = req.body;

      // Check permissions
      if (req.user.role !== 'admin' && req.user.id !== userId) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const updatedUser = await storage.updateUser(userId, { password: hashedPassword });

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Update password error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // USER REGISTRATION ROUTES
  // ============================================================================

  /**
   * POST /api/auth/register-user
   * Universal user registration - supports all user types from requirements
   * User Types: admin, client, company_manager, notary, signer, witness, observer
   */
  app.post('/api/auth/register-user', async (req, res) => {
    try {
      const {
        // Universal required fields
        fullName,
        email,
        phoneNumber, // Cell phone from requirements
        password,
        
        // User type and role
        userType, // 'admin', 'client', 'company_user', 'notary', 'signer', 'witness', 'observer'
        
        // Address fields (required for signers to start sessions)
        address1,
        address2, 
        city,
        state,
        zipCode,
        
        // Optional company association
        companyId,
        companyRole,
        
        // Notary-specific fields
        notaryType, // 'contractor' or 'subscriber'
        
        // Registration source
        registrationSource = 'self' // 'self', 'company_invite', 'admin_create'
        
      } = req.body;

      // Validate universal required fields
      if (!fullName || !email || !phoneNumber || !password || !userType) {
        return res.status(400).json({ 
          message: 'Missing required fields: fullName, email, phoneNumber, password, and userType are required' 
        });
      }

      // Parse full name
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: 'User with this email already exists' });
      }

      // Validate user type
      const validUserTypes = ['admin', 'client', 'company_user', 'notary', 'signer', 'witness', 'observer'];
      if (!validUserTypes.includes(userType)) {
        return res.status(400).json({ 
          message: `Invalid user type. Must be one of: ${validUserTypes.join(', ')}` 
        });
      }

      // Set approval status based on user type and registration source
      let approvalStatus = 'pending';
      let isActive = false;

      if (userType === 'admin') {
        // Admin users require manual approval
        approvalStatus = 'pending';
        isActive = false;
      } else if (userType === 'notary') {
        // Notaries require admin approval as per requirements
        approvalStatus = 'pending';
        isActive = false;
      } else if (userType === 'company_user' && companyId) {
        // Company users may be auto-approved based on company settings
        const company = await storage.getCompany(companyId);
        if (company && !company.requiresApprovalForNewUsers) {
          approvalStatus = 'approved';
          isActive = true;
        }
      } else {
        // Regular users (client, signer, witness, observer) are auto-approved
        approvalStatus = 'approved';
        isActive = true;
      }

      // Prepare user data
      const userData = {
        username: email, // Use email as username
        email: email,
        password: password, // Will be hashed in storage
        firstName: firstName,
        lastName: lastName,
        fullName: fullName,
        phoneNumber: phoneNumber,
        
        // Address fields
        address1: address1,
        address2: address2,
        city: city,
        state: state,
        zipCode: zipCode,
        
        // Role and status
        role: userType,
        companyId: companyId,
        companyRole: companyRole,
        
        // Status and approval
        isActive: isActive,
        approvalStatus: approvalStatus,
        
        // Notary-specific
        notaryType: userType === 'notary' ? (notaryType || 'contractor') : null,
        
        // Initialize other fields
        isNotificationsEnabled: true,
        mfaEnabled: false,
        
        // Foreign languages - default empty array
        foreignLanguages: []
      };

      // Create user
      const newUser = await storage.createUser(userData);

      // Log the registration
      console.log(`New user registered: ${newUser.email} as ${userType}`);

      // Return response (exclude sensitive data)
      const response = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        isActive: newUser.isActive,
        approvalStatus: newUser.approvalStatus,
        requiresApproval: approvalStatus === 'pending',
        message: approvalStatus === 'pending' 
          ? 'Registration successful. Your account is pending approval.' 
          : 'Registration successful. You can now log in.'
      };

      res.status(201).json(response);

    } catch (error) {
      console.error('User registration error:', error);
      res.status(500).json({ message: 'Internal server error during registration' });
    }
  });

  // ============================================================================
  // USER APPROVAL ROUTES (Admin Only)
  // ============================================================================

  /**
   * GET /api/admin/users/pending-approval
   * Get all users pending approval
   */
  app.get('/api/admin/users/pending-approval', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const pendingUsers = await storage.getUsersByApprovalStatus('pending');
      
      res.json(pendingUsers.map(user => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        notaryType: user.notaryType,
        phoneNumber: user.phoneNumber,
        address1: user.address1,
        city: user.city,
        state: user.state,
        createdAt: user.createdAt,
        lastProfileUpdate: user.lastProfileUpdate,
        
        // Notary-specific approval fields
        nameOnCommission: user.nameOnCommission,
        commissionNumber: user.commissionNumber,
        commissionExpiration: user.commissionExpiration,
        isNotarySigningAgent: user.isNotarySigningAgent,
        notarySigningAgentExpiration: user.notarySigningAgentExpiration,
        signingAgentCertified: user.signingAgentCertified,
        
        // Document status
        hasCommissionFile: !!user.notaryCommissionFile,
        hasEOInsurance: !!user.eoInsuranceFile,
        hasBond: !!user.bondFile,
        hasPublicCertificate: !!user.publicCertificateFile
      })));
    } catch (error) {
      console.error('Get pending users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/admin/users/:id/approve
   * Approve a user (admin only)
   */
  app.post('/api/admin/users/:id/approve', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      const { notes } = req.body;

      const user = await storage.approveUser(userId, req.user.id, notes);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Also activate the user
      await storage.updateUser(userId, { isActive: true });

      res.json({ 
        message: 'User approved successfully',
        userId: user.id,
        approvalStatus: user.approvalStatus
      });
    } catch (error) {
      console.error('Approve user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/admin/users/:id/reject
   * Reject a user (admin only)
   */
  app.post('/api/admin/users/:id/reject', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      const { notes } = req.body;

      if (!notes) {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }

      const user = await storage.rejectUser(userId, req.user.id, notes);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ 
        message: 'User rejected',
        userId: user.id,
        approvalStatus: user.approvalStatus,
        rejectionReason: notes
      });
    } catch (error) {
      console.error('Reject user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * POST /api/admin/users/:id/request-update
   * Request user to update their profile (admin only)
   */
  app.post('/api/admin/users/:id/request-update', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const userId = parseInt(req.params.id);
      const { notes } = req.body;

      if (!notes) {
        return res.status(400).json({ message: 'Update request reason is required' });
      }

      const user = await storage.requestUserUpdate(userId, req.user.id, notes);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ 
        message: 'Update request sent to user',
        userId: user.id,
        approvalStatus: user.approvalStatus,
        updateRequest: notes
      });
    } catch (error) {
      console.error('Request user update error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // ENHANCED PROFILE MANAGEMENT ROUTES
  // ============================================================================

  /**
   * GET /api/users/:id/profile/comprehensive
   * Get comprehensive user profile with all fields
   */
  app.get('/api/users/:id/profile/comprehensive', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check access permissions
      const canAccess = req.user.role === 'admin' || 
                       req.user.id === userId ||
                       (req.user.role === 'company_manager' && req.user.companyId && 
                        await storage.getUsersByCompany(req.user.companyId).then(users => 
                          users.some(u => u.id === userId)));

      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get company information if user is associated with a company
      let companyInfo = null;
      if (user.companyId) {
        companyInfo = await storage.getCompany(user.companyId);
      }

      // Return comprehensive profile
      const profile = {
        // Basic information
        id: user.id,
        username: user.username,
        email: user.email,
        
        // Personal information
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        
        // Address information
        address1: user.address1,
        address2: user.address2,
        city: user.city,
        state: user.state,
        zipCode: user.zipCode,
        
        // Role and company
        role: user.role,
        companyId: user.companyId,
        companyRole: user.companyRole,
        company: companyInfo ? {
          id: companyInfo.id,
          companyName: companyInfo.companyName,
          contactName: companyInfo.contactName
        } : null,
        
        // Status
        isActive: user.isActive,
        approvalStatus: user.approvalStatus,
        approvalNotes: user.approvalNotes,
        
        // Notary information (if applicable)
        notaryType: user.notaryType,
        nameOnCommission: user.nameOnCommission,
        commissionNumber: user.commissionNumber,
        commissionExpiration: user.commissionExpiration,
        commissionAddress1: user.commissionAddress1,
        commissionAddress2: user.commissionAddress2,
        commissionCity: user.commissionCity,
        commissionState: user.commissionState,
        commissionZipCode: user.commissionZipCode,
        commissionCounty: user.commissionCounty,
        county: user.county, // Legacy field
        
        // Qualifications
        isNotarySigningAgent: user.isNotarySigningAgent,
        notarySigningAgentExpiration: user.notarySigningAgentExpiration,
        isSpanishSpeaking: user.isSpanishSpeaking,
        foreignLanguages: user.foreignLanguages,
        signingAgentCertified: user.signingAgentCertified,
        signingAgentExpirationDate: user.signingAgentExpirationDate,
        
        // Insurance and bonding
        eoInsuranceCompany: user.eoInsuranceCompany,
        eoInsuranceAmount: user.eoInsuranceAmount,
        eoInsuranceExpiration: user.eoInsuranceExpiration,
        bondCompanyName: user.bondCompanyName,
        bondAmount: user.bondAmount,
        bondExpiration: user.bondExpiration,
        
        // Certificates and documents
        publicCertificateExpiration: user.publicCertificateExpiration,
        digitalCertificateExpiration: user.digitalCertificateExpiration,
        
        // Document upload status
        documents: {
          hasCommissionFile: !!user.notaryCommissionFile,
          hasEOInsuranceFile: !!user.eoInsuranceFile,
          hasBondFile: !!user.bondFile,
          hasPublicCertificateFile: !!user.publicCertificateFile,
          hasSigningAgentFile: !!user.signingAgentFile,
          hasDigitalCertificateFile: !!user.digitalCertificateFile
        },
        
        // ID Verification
        idType: user.idType,
        idNumber: user.idNumber ? user.idNumber.replace(/./g, '*') : null, // Masked for security
        idExpirationDate: user.idExpirationDate,
        idIssueDate: user.idIssueDate,
        
        // Signatures and seals
        hasSignatureData: !!user.signatureData,
        hasInitialData: !!user.initialData,
        
        // Settings
        isNotificationsEnabled: user.isNotificationsEnabled,
        mfaEnabled: user.mfaEnabled,
        
        // Timestamps
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        lastProfileUpdate: user.lastProfileUpdate
      };

      res.json(profile);
    } catch (error) {
      console.error('Get comprehensive profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * PUT /api/users/:id/profile/comprehensive
   * Update comprehensive user profile
   */
  app.put('/api/users/:id/profile/comprehensive', verifyToken, async (req: any, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check access permissions
      const canUpdate = req.user.role === 'admin' || req.user.id === userId;

      if (!canUpdate) {
        return res.status(403).json({ message: 'Access denied. You can only update your own profile.' });
      }

      const updateData = { ...req.body };
      
      // Add update timestamp
      updateData.lastProfileUpdate = new Date().toISOString();
      
      // If this is a notary updating their profile, set status to pending for re-approval
      const user = await storage.getUser(userId);
      if (user?.role === 'notary' && user.approvalStatus === 'approved' && req.user.role !== 'admin') {
        updateData.approvalStatus = 'requires_update';
        updateData.isActive = false;
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ 
        message: user?.role === 'notary' && updateData.approvalStatus === 'requires_update'
          ? 'Profile updated successfully. Your account is pending re-approval due to changes in notary information.'
          : 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          approvalStatus: updatedUser.approvalStatus,
          isActive: updatedUser.isActive,
          lastProfileUpdate: updatedUser.lastProfileUpdate
        }
      });
    } catch (error) {
      console.error('Update comprehensive profile error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // ============================================================================
  // USER LISTING ROUTES
  // ============================================================================

  /**
   * GET /api/admin/users/by-role/:role
   * Get users by role (admin only)
   */
  app.get('/api/admin/users/by-role/:role', verifyToken, async (req: any, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const role = req.params.role;
      const users = await storage.getUsersByRole(role);
      
      res.json(users.map(user => ({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        approvalStatus: user.approvalStatus,
        companyId: user.companyId,
        createdAt: user.createdAt
      })));
    } catch (error) {
      console.error('Get users by role error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  /**
   * GET /api/notaries/qualified
   * Get notaries by qualifications (for job assignment)
   */
  app.get('/api/notaries/qualified', verifyToken, async (req: any, res) => {
    try {
      const { requiresNSA, requiresSpanish } = req.query;
      
      const notaries = await storage.getNotariesByQualifications(
        requiresNSA === 'true',
        requiresSpanish === 'true'
      );
      
      res.json(notaries.map(notary => ({
        id: notary.id,
        fullName: notary.fullName,
        email: notary.email,
        state: notary.state,
        isNotarySigningAgent: notary.isNotarySigningAgent,
        isSpanishSpeaking: notary.isSpanishSpeaking,
        foreignLanguages: notary.foreignLanguages,
        maxConcurrentJobs: notary.maxConcurrentJobs,
        notaryType: notary.notaryType
      })));
    } catch (error) {
      console.error('Get qualified notaries error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
} 