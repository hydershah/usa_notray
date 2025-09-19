// Company Manager System Types
import { z } from 'zod';

// Permission Structure for Managers
export interface ManagerPermissions {
  jobs: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    assign_notary: boolean;
    manage_signers: boolean;
    view_all: boolean;
  };
  users: {
    invite: boolean;
    manage: boolean;
    remove: boolean;
    view_all: boolean;
  };
  company: {
    edit_settings: boolean;
    manage_billing: boolean;
    view_reports: boolean;
    manage_managers: boolean;
  };
  documents: {
    upload: boolean;
    download: boolean;
    delete: boolean;
    share: boolean;
  };
}

// Manager Role Types
export type ManagerRole = 'admin' | 'manager' | 'limited';
export type ManagerStatus = 'pending' | 'active' | 'suspended' | 'removed';

// Company Manager Interface
export interface CompanyManager {
  id: number;
  companyId: number;
  userId: number;
  managerRole: ManagerRole;
  permissions: ManagerPermissions;
  isActive: boolean;
  isPrimary: boolean;
  invitedBy?: number;
  invitedAt?: Date;
  acceptedAt?: Date;
  status: ManagerStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: number;
  lastModifiedBy?: number;
  
  // Relations
  user?: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
  };
  company?: {
    id: number;
    companyName: string;
  };
}

// Permission Template Interface
export interface ManagerPermissionTemplate {
  id: number;
  companyId: number;
  templateName: string;
  description?: string;
  permissions: ManagerPermissions;
  isDefault: boolean;
  createdAt: Date;
  createdBy?: number;
}

// Manager Activity Log Interface
export interface ManagerActivityLog {
  id: number;
  companyId: number;
  managerId: number;
  action: string;
  targetType?: 'job' | 'user' | 'company' | 'settings';
  targetId?: number;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

// Validation Schemas
export const managerPermissionsSchema = z.object({
  jobs: z.object({
    create: z.boolean(),
    edit: z.boolean(),
    delete: z.boolean(),
    assign_notary: z.boolean(),
    manage_signers: z.boolean(),
    view_all: z.boolean(),
  }),
  users: z.object({
    invite: z.boolean(),
    manage: z.boolean(),
    remove: z.boolean(),
    view_all: z.boolean(),
  }),
  company: z.object({
    edit_settings: z.boolean(),
    manage_billing: z.boolean(),
    view_reports: z.boolean(),
    manage_managers: z.boolean(),
  }),
  documents: z.object({
    upload: z.boolean(),
    download: z.boolean(),
    delete: z.boolean(),
    share: z.boolean(),
  }),
});

export const inviteManagerSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  managerRole: z.enum(['admin', 'manager', 'limited']),
  permissions: managerPermissionsSchema.optional(),
  templateId: z.number().optional(),
});

export const updateManagerPermissionsSchema = z.object({
  managerId: z.number(),
  permissions: managerPermissionsSchema,
  managerRole: z.enum(['admin', 'manager', 'limited']).optional(),
});

export const createPermissionTemplateSchema = z.object({
  templateName: z.string().min(1, 'Template name is required'),
  description: z.string().optional(),
  permissions: managerPermissionsSchema,
  isDefault: z.boolean().default(false),
});

// Default Permission Sets
export const DEFAULT_PERMISSIONS: Record<ManagerRole, ManagerPermissions> = {
  admin: {
    jobs: {
      create: true,
      edit: true,
      delete: true,
      assign_notary: true,
      manage_signers: true,
      view_all: true,
    },
    users: {
      invite: true,
      manage: true,
      remove: true,
      view_all: true,
    },
    company: {
      edit_settings: true,
      manage_billing: true,
      view_reports: true,
      manage_managers: true,
    },
    documents: {
      upload: true,
      download: true,
      delete: true,
      share: true,
    },
  },
  manager: {
    jobs: {
      create: true,
      edit: true,
      delete: false,
      assign_notary: true,
      manage_signers: true,
      view_all: true,
    },
    users: {
      invite: false,
      manage: false,
      remove: false,
      view_all: true,
    },
    company: {
      edit_settings: false,
      manage_billing: false,
      view_reports: true,
      manage_managers: false,
    },
    documents: {
      upload: true,
      download: true,
      delete: false,
      share: true,
    },
  },
  limited: {
    jobs: {
      create: true,
      edit: false,
      delete: false,
      assign_notary: false,
      manage_signers: false,
      view_all: true,
    },
    users: {
      invite: false,
      manage: false,
      remove: false,
      view_all: false,
    },
    company: {
      edit_settings: false,
      manage_billing: false,
      view_reports: false,
      manage_managers: false,
    },
    documents: {
      upload: true,
      download: true,
      delete: false,
      share: false,
    },
  },
};

// Helper Functions
export function hasPermission(
  manager: CompanyManager,
  category: keyof ManagerPermissions,
  action: string
): boolean {
  return (manager.permissions[category] as any)?.[action] === true;
}

export function canManageManagers(manager: CompanyManager): boolean {
  return manager.isPrimary || hasPermission(manager, 'company', 'manage_managers');
}

export function canAccessJob(manager: CompanyManager): boolean {
  return hasPermission(manager, 'jobs', 'view_all');
}

export function canCreateJob(manager: CompanyManager): boolean {
  return hasPermission(manager, 'jobs', 'create');
}

export function canEditJob(manager: CompanyManager): boolean {
  return hasPermission(manager, 'jobs', 'edit');
}

export function canDeleteJob(manager: CompanyManager): boolean {
  return hasPermission(manager, 'jobs', 'delete');
}

export function canAssignNotary(manager: CompanyManager): boolean {
  return hasPermission(manager, 'jobs', 'assign_notary');
}

export function canManageUsers(manager: CompanyManager): boolean {
  return hasPermission(manager, 'users', 'manage');
}

export function canInviteUsers(manager: CompanyManager): boolean {
  return hasPermission(manager, 'users', 'invite');
}

export function canEditCompanySettings(manager: CompanyManager): boolean {
  return hasPermission(manager, 'company', 'edit_settings');
}

export function canManageBilling(manager: CompanyManager): boolean {
  return hasPermission(manager, 'company', 'manage_billing');
}

export function canViewReports(manager: CompanyManager): boolean {
  return hasPermission(manager, 'company', 'view_reports');
}

// Manager Activity Actions
export const MANAGER_ACTIONS = {
  // User Management
  INVITE_MANAGER: 'invite_manager',
  REMOVE_MANAGER: 'remove_manager',
  UPDATE_MANAGER_PERMISSIONS: 'update_manager_permissions',
  ACCEPT_INVITATION: 'accept_invitation',
  
  // Job Management
  CREATE_JOB: 'create_job',
  EDIT_JOB: 'edit_job',
  DELETE_JOB: 'delete_job',
  ASSIGN_NOTARY: 'assign_notary',
  REMOVE_NOTARY: 'remove_notary',
  
  // Company Management
  UPDATE_COMPANY_SETTINGS: 'update_company_settings',
  UPDATE_BILLING_INFO: 'update_billing_info',
  CREATE_PERMISSION_TEMPLATE: 'create_permission_template',
  UPDATE_PERMISSION_TEMPLATE: 'update_permission_template',
  DELETE_PERMISSION_TEMPLATE: 'delete_permission_template',
  
  // Document Management
  UPLOAD_DOCUMENT: 'upload_document',
  DELETE_DOCUMENT: 'delete_document',
  SHARE_DOCUMENT: 'share_document',
} as const;

export type ManagerAction = typeof MANAGER_ACTIONS[keyof typeof MANAGER_ACTIONS];
