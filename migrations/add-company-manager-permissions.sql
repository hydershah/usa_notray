-- Migration: Add Company Manager Permissions System
-- This adds support for multiple managers per title company with granular access control

-- Company Managers table - Multiple managers per title company
CREATE TABLE IF NOT EXISTS company_managers (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Manager role within the company
  manager_role TEXT NOT NULL DEFAULT 'manager', -- 'admin', 'manager', 'limited'
  
  -- Granular permissions for this manager
  permissions JSONB NOT NULL DEFAULT '{}',
  
  -- Status and metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false, -- Only one primary manager per company
  
  -- Invitation and approval system
  invited_by INTEGER REFERENCES users(id),
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'suspended', 'removed'
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  last_modified_by INTEGER REFERENCES users(id),
  
  -- Ensure unique manager per company
  UNIQUE(company_id, user_id)
);

-- Manager Permission Templates table - Predefined permission sets
CREATE TABLE IF NOT EXISTS manager_permission_templates (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  
  UNIQUE(company_id, template_name)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_company_managers_company_id ON company_managers(company_id);
CREATE INDEX IF NOT EXISTS idx_company_managers_user_id ON company_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_company_managers_status ON company_managers(status);
CREATE INDEX IF NOT EXISTS idx_company_managers_is_primary ON company_managers(company_id, is_primary) WHERE is_primary = true;

-- Manager Activity Log table - Track manager actions
CREATE TABLE IF NOT EXISTS manager_activity_log (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  manager_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT, -- 'job', 'user', 'company', 'settings'
  target_id INTEGER,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manager_activity_company_id ON manager_activity_log(company_id);
CREATE INDEX IF NOT EXISTS idx_manager_activity_manager_id ON manager_activity_log(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_activity_created_at ON manager_activity_log(created_at);

-- Insert default permission templates
INSERT INTO manager_permission_templates (company_id, template_name, description, permissions, is_default) 
SELECT 
  id as company_id,
  'Full Access' as template_name,
  'Complete access to all company features' as description,
  '{
    "jobs": {
      "create": true,
      "edit": true,
      "delete": true,
      "assign_notary": true,
      "manage_signers": true,
      "view_all": true
    },
    "users": {
      "invite": true,
      "manage": true,
      "remove": true,
      "view_all": true
    },
    "company": {
      "edit_settings": true,
      "manage_billing": true,
      "view_reports": true,
      "manage_managers": true
    },
    "documents": {
      "upload": true,
      "download": true,
      "delete": true,
      "share": true
    }
  }'::jsonb as permissions,
  true as is_default
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM manager_permission_templates 
  WHERE company_id = companies.id AND template_name = 'Full Access'
);

INSERT INTO manager_permission_templates (company_id, template_name, description, permissions, is_default) 
SELECT 
  id as company_id,
  'Job Manager' as template_name,
  'Can manage jobs but limited user management' as description,
  '{
    "jobs": {
      "create": true,
      "edit": true,
      "delete": false,
      "assign_notary": true,
      "manage_signers": true,
      "view_all": true
    },
    "users": {
      "invite": false,
      "manage": false,
      "remove": false,
      "view_all": true
    },
    "company": {
      "edit_settings": false,
      "manage_billing": false,
      "view_reports": true,
      "manage_managers": false
    },
    "documents": {
      "upload": true,
      "download": true,
      "delete": false,
      "share": true
    }
  }'::jsonb as permissions,
  false as is_default
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM manager_permission_templates 
  WHERE company_id = companies.id AND template_name = 'Job Manager'
);

INSERT INTO manager_permission_templates (company_id, template_name, description, permissions, is_default) 
SELECT 
  id as company_id,
  'Limited Access' as template_name,
  'View-only access with basic job operations' as description,
  '{
    "jobs": {
      "create": true,
      "edit": false,
      "delete": false,
      "assign_notary": false,
      "manage_signers": false,
      "view_all": true
    },
    "users": {
      "invite": false,
      "manage": false,
      "remove": false,
      "view_all": false
    },
    "company": {
      "edit_settings": false,
      "manage_billing": false,
      "view_reports": false,
      "manage_managers": false
    },
    "documents": {
      "upload": true,
      "download": true,
      "delete": false,
      "share": false
    }
  }'::jsonb as permissions,
  false as is_default
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM manager_permission_templates 
  WHERE company_id = companies.id AND template_name = 'Limited Access'
);

-- Migrate existing company managers to the new system
INSERT INTO company_managers (company_id, user_id, manager_role, permissions, is_primary, status, created_at, accepted_at)
SELECT 
  u.company_id,
  u.id,
  'admin',
  (SELECT permissions FROM manager_permission_templates 
   WHERE company_id = u.company_id AND template_name = 'Full Access' LIMIT 1),
  true,
  'active',
  u.created_at,
  u.created_at
FROM users u
WHERE u.role = 'title_company' 
  AND u.company_role = 'manager' 
  AND u.company_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM company_managers cm 
    WHERE cm.company_id = u.company_id AND cm.user_id = u.id
  );

-- Update companies table to reference primary manager
UPDATE companies 
SET company_manager_id = (
  SELECT cm.user_id 
  FROM company_managers cm 
  WHERE cm.company_id = companies.id 
    AND cm.is_primary = true 
    AND cm.status = 'active'
  LIMIT 1
)
WHERE company_manager_id IS NULL;

COMMENT ON TABLE company_managers IS 'Manages multiple managers per title company with granular permissions';
COMMENT ON TABLE manager_permission_templates IS 'Predefined permission templates for easy manager role assignment';
COMMENT ON TABLE manager_activity_log IS 'Audit log for manager actions within companies';
