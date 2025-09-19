import { db } from '../db.js';
import { 
  companyManagers, 
  managerPermissionTemplates, 
  managerActivityLog, 
  users, 
  companies 
} from '../../shared/schema.js';
import { 
  CompanyManager, 
  ManagerPermissions, 
  ManagerRole, 
  ManagerStatus,
  ManagerPermissionTemplate,
  DEFAULT_PERMISSIONS,
  MANAGER_ACTIONS,
  ManagerAction
} from '../../shared/types/manager-types.js';
import { eq, and, or } from 'drizzle-orm';
import { storage } from '../storage.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export class CompanyManagerService {
  private static instance: CompanyManagerService;
  
  static getInstance(): CompanyManagerService {
    if (!CompanyManagerService.instance) {
      CompanyManagerService.instance = new CompanyManagerService();
    }
    return CompanyManagerService.instance;
  }

  /**
   * Get all managers for a company
   */
  async getCompanyManagers(companyId: number): Promise<CompanyManager[]> {
    console.log('🔍 DEBUG: Starting getCompanyManagers for companyId:', companyId);
    console.log('🔍 DEBUG: companyManagers table name:', companyManagers);
    console.log('🔍 DEBUG: Database connection:', db ? 'connected' : 'not connected');
    
    try {
      const managers = await db
        .select({
          id: companyManagers.id,
          companyId: companyManagers.companyId,
          userId: companyManagers.userId,
          managerRole: companyManagers.managerRole,
          permissions: companyManagers.permissions,
          isActive: companyManagers.isActive,
          isPrimary: companyManagers.isPrimary,
          invitedBy: companyManagers.invitedBy,
          invitedAt: companyManagers.invitedAt,
          acceptedAt: companyManagers.acceptedAt,
          status: companyManagers.status,
          createdAt: companyManagers.createdAt,
          updatedAt: companyManagers.updatedAt,
          createdBy: companyManagers.createdBy,
          lastModifiedBy: companyManagers.lastModifiedBy,
          // User details
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userFullName: users.fullName,
          // Company details
          companyName: companies.companyName,
        })
        .from(companyManagers)
        .leftJoin(users, eq(companyManagers.userId, users.id))
        .leftJoin(companies, eq(companyManagers.companyId, companies.id))
        .where(eq(companyManagers.companyId, companyId));

      console.log('🔍 DEBUG: Query executed successfully, found managers:', managers?.length || 0);
      console.log('🔍 DEBUG: First manager data:', managers?.[0] || 'no managers found');
      
      return managers.map(manager => ({
      id: manager.id,
      companyId: manager.companyId,
      userId: manager.userId,
      managerRole: manager.managerRole as ManagerRole,
      permissions: manager.permissions as ManagerPermissions,
      isActive: manager.isActive,
      isPrimary: manager.isPrimary,
      invitedBy: manager.invitedBy,
      invitedAt: manager.invitedAt,
      acceptedAt: manager.acceptedAt,
      status: manager.status as ManagerStatus,
      createdAt: manager.createdAt,
      updatedAt: manager.updatedAt,
      createdBy: manager.createdBy,
      lastModifiedBy: manager.lastModifiedBy,
      user: manager.userEmail ? {
        id: manager.userId,
        email: manager.userEmail,
        firstName: manager.userFirstName || '',
        lastName: manager.userLastName || '',
        fullName: manager.userFullName || '',
      } : undefined,
      company: manager.companyName ? {
        id: manager.companyId,
        companyName: manager.companyName,
      } : undefined,
    }));
    } catch (error) {
      console.error('🚨 ERROR in getCompanyManagers:', error);
      console.error('🚨 ERROR details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get manager by user ID and company ID
   */
  async getManagerByUserAndCompany(userId: number, companyId: number): Promise<CompanyManager | null> {
    const managers = await this.getCompanyManagers(companyId);
    return managers.find(m => m.userId === userId) || null;
  }

  /**
   * Check if user is a manager of a company
   */
  async isUserManagerOfCompany(userId: number, companyId: number): Promise<boolean> {
    const manager = await this.getManagerByUserAndCompany(userId, companyId);
    return manager !== null && manager.isActive && manager.status === 'active';
  }

  /**
   * Check if user can perform a specific action
   */
  async canUserPerformAction(
    userId: number, 
    companyId: number, 
    category: keyof ManagerPermissions, 
    action: string
  ): Promise<boolean> {
    const manager = await this.getManagerByUserAndCompany(userId, companyId);
    if (!manager || !manager.isActive || manager.status !== 'active') {
      return false;
    }

    return (manager.permissions[category] as any)?.[action] === true;
  }

  /**
   * Invite a new manager to a company
   */
  async inviteManager(
    companyId: number,
    invitedBy: number,
    managerData: {
      email: string;
      firstName: string;
      lastName: string;
      managerRole: ManagerRole;
      permissions?: ManagerPermissions;
      templateId?: number;
    }
  ): Promise<{ manager: CompanyManager; userCreated: boolean }> {
    let user = await storage.getUserByEmail(managerData.email);
    let userCreated = false;

    // Create user if doesn't exist
    if (!user) {
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      user = await storage.createUser({
        username: managerData.email,
        email: managerData.email,
        password: hashedPassword,
        firstName: managerData.firstName,
        lastName: managerData.lastName,
        fullName: `${managerData.firstName} ${managerData.lastName}`,
        role: 'title_company',
        companyId: companyId,
        companyRole: 'manager',
        isActive: true,
        approvalStatus: 'approved',
        accountSetupComplete: false, // Will need to set password
      });
      userCreated = true;
    }

    // Get permissions from template or use provided/default
    let permissions: ManagerPermissions;
    if (managerData.templateId) {
      const template = await this.getPermissionTemplate(managerData.templateId);
      permissions = template?.permissions || DEFAULT_PERMISSIONS[managerData.managerRole];
    } else if (managerData.permissions) {
      permissions = managerData.permissions;
    } else {
      permissions = DEFAULT_PERMISSIONS[managerData.managerRole];
    }

    // Create manager record
    const [newManager] = await db
      .insert(companyManagers)
      .values({
        companyId,
        userId: user.id,
        managerRole: managerData.managerRole,
        permissions,
        isActive: true,
        isPrimary: false,
        invitedBy,
        invitedAt: new Date(),
        status: 'pending',
        createdBy: invitedBy,
      })
      .returning();

    // Send invitation email
    try {
      const { emailService } = await import('../lib/email-service.js');
      
      // Get inviter details
      const inviter = await storage.getUserById(invitedBy);
      const inviterName = inviter?.fullName || inviter?.firstName || 'System Administrator';
      
      // Generate invitation token for account setup
      const inviteToken = crypto.randomUUID();
      
      // Update user with invitation token if account setup not complete
      if (!user.accountSetupComplete || userCreated) {
        await storage.updateUser(user.id, {
          inviteToken,
          accountSetupComplete: false
        });
      }
      
      await emailService.sendUserInvitation({
        userEmail: managerData.email,
        userName: `${managerData.firstName} ${managerData.lastName}`,
        role: `${managerData.managerRole} Manager`,
        inviteToken: inviteToken,
        invitedBy: inviterName
      });
      
      console.log(`✅ Manager invitation email sent to ${managerData.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send manager invitation email:', emailError);
      // Don't fail the invitation if email fails - manager is still created
    }

    // Log activity
    await this.logActivity(
      companyId,
      invitedBy,
      MANAGER_ACTIONS.INVITE_MANAGER,
      'user',
      user.id,
      {
        invitedEmail: managerData.email,
        managerRole: managerData.managerRole,
        userCreated,
      }
    );

    const managers = await this.getCompanyManagers(companyId);
    const manager = managers.find(m => m.id === newManager.id)!;

    return { manager, userCreated };
  }

  /**
   * Accept manager invitation
   */
  async acceptInvitation(managerId: number, userId: number): Promise<CompanyManager> {
    const [updatedManager] = await db
      .update(companyManagers)
      .set({
        status: 'active',
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(companyManagers.id, managerId),
        eq(companyManagers.userId, userId)
      ))
      .returning();

    // Log activity
    await this.logActivity(
      updatedManager.companyId,
      userId,
      MANAGER_ACTIONS.ACCEPT_INVITATION,
      'user',
      userId
    );

    const managers = await this.getCompanyManagers(updatedManager.companyId);
    return managers.find(m => m.id === managerId)!;
  }

  /**
   * Update manager permissions
   */
  async updateManagerPermissions(
    managerId: number,
    updatedBy: number,
    updates: {
      managerRole?: ManagerRole;
      permissions?: ManagerPermissions;
      isActive?: boolean;
    }
  ): Promise<CompanyManager> {
    const [updatedManager] = await db
      .update(companyManagers)
      .set({
        ...updates,
        updatedAt: new Date(),
        lastModifiedBy: updatedBy,
      })
      .where(eq(companyManagers.id, managerId))
      .returning();

    // Log activity
    await this.logActivity(
      updatedManager.companyId,
      updatedBy,
      MANAGER_ACTIONS.UPDATE_MANAGER_PERMISSIONS,
      'user',
      updatedManager.userId,
      updates
    );

    const managers = await this.getCompanyManagers(updatedManager.companyId);
    return managers.find(m => m.id === managerId)!;
  }

  /**
   * Remove manager from company
   */
  async removeManager(managerId: number, removedBy: number): Promise<void> {
    const manager = await db
      .select()
      .from(companyManagers)
      .where(eq(companyManagers.id, managerId))
      .limit(1);

    if (!manager.length) {
      throw new Error('Manager not found');
    }

    if (manager[0].isPrimary) {
      throw new Error('Cannot remove primary manager');
    }

    await db
      .update(companyManagers)
      .set({
        status: 'removed',
        isActive: false,
        updatedAt: new Date(),
        lastModifiedBy: removedBy,
      })
      .where(eq(companyManagers.id, managerId));

    // Log activity
    await this.logActivity(
      manager[0].companyId,
      removedBy,
      MANAGER_ACTIONS.REMOVE_MANAGER,
      'user',
      manager[0].userId
    );
  }

  /**
   * Get permission templates for a company
   */
  async getPermissionTemplates(companyId: number): Promise<ManagerPermissionTemplate[]> {
    const templates = await db
      .select()
      .from(managerPermissionTemplates)
      .where(eq(managerPermissionTemplates.companyId, companyId));

    return templates.map(template => ({
      id: template.id,
      companyId: template.companyId,
      templateName: template.templateName,
      description: template.description,
      permissions: template.permissions as ManagerPermissions,
      isDefault: template.isDefault,
      createdAt: template.createdAt,
      createdBy: template.createdBy,
    }));
  }

  /**
   * Get specific permission template
   */
  async getPermissionTemplate(templateId: number): Promise<ManagerPermissionTemplate | null> {
    const [template] = await db
      .select()
      .from(managerPermissionTemplates)
      .where(eq(managerPermissionTemplates.id, templateId))
      .limit(1);

    if (!template) return null;

    return {
      id: template.id,
      companyId: template.companyId,
      templateName: template.templateName,
      description: template.description,
      permissions: template.permissions as ManagerPermissions,
      isDefault: template.isDefault,
      createdAt: template.createdAt,
      createdBy: template.createdBy,
    };
  }

  /**
   * Create permission template
   */
  async createPermissionTemplate(
    companyId: number,
    createdBy: number,
    templateData: {
      templateName: string;
      description?: string;
      permissions: ManagerPermissions;
      isDefault?: boolean;
    }
  ): Promise<ManagerPermissionTemplate> {
    const [template] = await db
      .insert(managerPermissionTemplates)
      .values({
        companyId,
        templateName: templateData.templateName,
        description: templateData.description,
        permissions: templateData.permissions,
        isDefault: templateData.isDefault || false,
        createdBy,
      })
      .returning();

    // Log activity
    await this.logActivity(
      companyId,
      createdBy,
      MANAGER_ACTIONS.CREATE_PERMISSION_TEMPLATE,
      'company',
      companyId,
      { templateName: templateData.templateName }
    );

    return {
      id: template.id,
      companyId: template.companyId,
      templateName: template.templateName,
      description: template.description,
      permissions: template.permissions as ManagerPermissions,
      isDefault: template.isDefault,
      createdAt: template.createdAt,
      createdBy: template.createdBy,
    };
  }

  /**
   * Log manager activity
   */
  async logActivity(
    companyId: number,
    managerId: number,
    action: ManagerAction,
    targetType?: 'job' | 'user' | 'company' | 'settings',
    targetId?: number,
    details?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await db.insert(managerActivityLog).values({
      companyId,
      managerId,
      action,
      targetType,
      targetId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Get activity log for a company
   */
  async getActivityLog(
    companyId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    return await db
      .select({
        id: managerActivityLog.id,
        action: managerActivityLog.action,
        targetType: managerActivityLog.targetType,
        targetId: managerActivityLog.targetId,
        details: managerActivityLog.details,
        createdAt: managerActivityLog.createdAt,
        managerName: users.fullName,
        managerEmail: users.email,
      })
      .from(managerActivityLog)
      .leftJoin(users, eq(managerActivityLog.managerId, users.id))
      .where(eq(managerActivityLog.companyId, companyId))
      .orderBy(managerActivityLog.createdAt)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Check if user has manager permissions for a company
   */
  async hasManagerAccess(userId: number, companyId: number): Promise<boolean> {
    return await this.isUserManagerOfCompany(userId, companyId);
  }

  /**
   * Get primary manager for a company
   */
  async getPrimaryManager(companyId: number): Promise<CompanyManager | null> {
    const managers = await this.getCompanyManagers(companyId);
    return managers.find(m => m.isPrimary && m.isActive && m.status === 'active') || null;
  }
}

export const companyManagerService = CompanyManagerService.getInstance();
