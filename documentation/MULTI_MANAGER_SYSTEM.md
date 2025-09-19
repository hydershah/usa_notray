# Multi-Manager System for Title Companies

## Overview

The Multi-Manager System allows title companies to have multiple managers with granular access control. Each title company can now:

1. **Add multiple managers** with their own accounts
2. **Control access permissions** for each manager individually  
3. **Use permission templates** for easy role assignment
4. **Track manager activity** with comprehensive audit logs
5. **Manage invitations** with approval workflows

---

## System Architecture

### Database Schema

#### Core Tables

1. **`company_managers`** - Links users to companies as managers
   - Stores manager role (`admin`, `manager`, `limited`)
   - Contains granular permissions (JSON)
   - Tracks invitation/acceptance status
   - Maintains primary manager designation

2. **`manager_permission_templates`** - Predefined permission sets
   - Company-specific templates
   - Reusable permission configurations
   - Default templates for common roles

3. **`manager_activity_log`** - Audit trail
   - Tracks all manager actions
   - Includes IP address and user agent
   - Categorizes actions by type

#### Key Relationships

```
Title Company (1) ←→ (Many) Company Managers ←→ (1) User
Title Company (1) ←→ (Many) Permission Templates
Company Manager (1) ←→ (Many) Activity Logs
```

---

## Permission System

### Permission Categories

1. **Jobs**
   - `create` - Create new notarization jobs
   - `edit` - Modify existing jobs
   - `delete` - Remove jobs
   - `assign_notary` - Assign notaries to jobs
   - `manage_signers` - Add/remove signers
   - `view_all` - View all company jobs

2. **Users**
   - `invite` - Invite new managers
   - `manage` - Edit user permissions
   - `remove` - Remove managers
   - `view_all` - View all company users

3. **Company**
   - `edit_settings` - Modify company settings
   - `manage_billing` - Handle billing information
   - `view_reports` - Access company reports
   - `manage_managers` - Manage other managers

4. **Documents**
   - `upload` - Upload documents
   - `download` - Download documents
   - `delete` - Remove documents
   - `share` - Share documents externally

### Default Permission Templates

1. **Admin** - Full access to all features
2. **Manager** - Job management with limited user access
3. **Limited** - View-only with basic job creation

---

## API Endpoints

### Manager Management

```
GET    /api/companies/:companyId/managers
POST   /api/companies/:companyId/managers/invite
PUT    /api/companies/:companyId/managers/:managerId/permissions
PUT    /api/companies/:companyId/managers/:managerId/accept
DELETE /api/companies/:companyId/managers/:managerId
GET    /api/companies/:companyId/managers/me
```

### Permission Templates

```
GET    /api/companies/:companyId/permission-templates
POST   /api/companies/:companyId/permission-templates
```

### Activity Logs

```
GET    /api/companies/:companyId/activity-log
```

---

## Usage Flow

### 1. Title Company Registration

When a title company registers:
1. Company record is created
2. Primary user is created with `role: 'title_company'`
3. Manager record is automatically created with `admin` permissions
4. Primary manager is marked with `isPrimary: true`

### 2. Adding Additional Managers

Primary managers or admins can:
1. **Invite new managers** by email
2. **Choose permission template** or customize permissions
3. **Set manager role** (admin, manager, limited)

The system will:
- Create user account if email doesn't exist
- Send invitation (pending status)
- Generate temporary password for new users
- Log the invitation activity

### 3. Manager Acceptance

When invited managers:
1. **Login with temporary credentials** (if new user)
2. **Accept the invitation** via API endpoint
3. **Complete account setup** if needed

### 4. Permission Management

Primary managers can:
- **Update permissions** for any manager
- **Suspend/reactivate** managers
- **Remove managers** (except primary)
- **View activity logs** for audit purposes

---

## Frontend Integration

### React Component

The `ManagerManagement` component provides:
- **Manager listing** with status and role display
- **Invitation dialog** with role and template selection
- **Permission viewing** with detailed permission breakdown
- **Activity tracking** with comprehensive audit trail

### Key Features

1. **Visual permission display** with icons and badges
2. **Role-based UI** showing appropriate actions
3. **Real-time status updates** for invitations
4. **Permission templates** for quick setup
5. **Activity logging** for compliance

---

## Security Features

### Access Control

- **Role-based permissions** at the API level
- **Company isolation** - managers can only access their company
- **Primary manager protection** - cannot be removed
- **Audit logging** for all management actions

### Validation

- **Email uniqueness** checking before invitation
- **Permission validation** using Zod schemas
- **Company membership** verification for all operations
- **Manager status** checking before permission grants

---

## Migration from Legacy System

### Automatic Migration

The migration script automatically:
1. **Creates manager records** for existing title company users
2. **Sets admin permissions** for current primary users
3. **Marks as primary** manager where appropriate
4. **Preserves existing** company relationships

### Backward Compatibility

- **Legacy role checks** still work alongside new system
- **Existing permissions** are maintained during transition
- **No breaking changes** to current functionality

---

## Example Usage

### Creating Permission Template

```typescript
const template = await companyManagerService.createPermissionTemplate(
  companyId,
  createdBy,
  {
    templateName: "Job Manager",
    description: "Can manage jobs but not users",
    permissions: {
      jobs: { create: true, edit: true, delete: false, ... },
      users: { invite: false, manage: false, ... },
      company: { edit_settings: false, ... },
      documents: { upload: true, download: true, ... }
    }
  }
);
```

### Inviting Manager

```typescript
const result = await companyManagerService.inviteManager(
  companyId,
  invitedBy,
  {
    email: "manager@company.com",
    firstName: "John",
    lastName: "Doe", 
    managerRole: "manager",
    templateId: template.id
  }
);
```

### Checking Permissions

```typescript
const canEdit = await companyManagerService.canUserPerformAction(
  userId,
  companyId,
  'jobs',
  'edit'
);
```

---

## Benefits

### For Title Companies

1. **Granular Control** - Precise permission management
2. **Scalability** - Add unlimited managers
3. **Security** - Role-based access control
4. **Compliance** - Complete audit trail
5. **Flexibility** - Custom permission templates

### For Managers

1. **Clear Responsibilities** - Well-defined access levels
2. **Easy Onboarding** - Invitation-based system
3. **Account Independence** - Individual user accounts
4. **Activity Tracking** - Personal activity history

### For Development

1. **Maintainable Code** - Clean separation of concerns
2. **Extensible Design** - Easy to add new permissions
3. **Type Safety** - Full TypeScript support
4. **API Consistency** - RESTful endpoint design

---

## Future Enhancements

### Planned Features

1. **Email notifications** for invitations and status changes
2. **Bulk manager operations** for large companies
3. **Advanced reporting** with manager activity analytics
4. **Custom permission categories** for specialized workflows
5. **Integration with SSO** providers for enterprise clients

### Potential Integrations

1. **Slack/Teams notifications** for manager activities
2. **LDAP/Active Directory** sync for enterprise
3. **Mobile app** for manager approval workflows
4. **API webhooks** for third-party integrations
