-- Comprehensive User Management System Migration
-- This migration adds all the enhanced user management fields and company management features
-- Run this against your database to implement the full user management system

-- ============================================================================
-- PART 1: Enhanced Users Table Fields
-- ============================================================================

-- Add Universal Profile fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_1 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS address_2 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS zip_code TEXT;

-- Add Company association fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_role TEXT;

-- Add Enhanced Notary Profile Fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS county_parish TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nsa_expiration_date TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS foreign_languages TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS name_on_commission TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_address_1 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_address_2 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_state TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_zip_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_county TEXT;

-- Document uploads and certifications
ALTER TABLE users ADD COLUMN IF NOT EXISTS notary_commission_file TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS eo_insurance_company TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS eo_insurance_amount INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS eo_insurance_expiration TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS eo_insurance_file TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_certificate_expiration TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_certificate_file TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_certificate_password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bond_company_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bond_amount INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bond_expiration TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bond_file TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signing_agent_certified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signing_agent_expiration_date TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signing_agent_file TEXT;

-- ID Verification fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_expiration_date TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_issue_date TEXT;

-- Digital Certificate fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS digital_certificate_file TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS digital_certificate_expiration TEXT;

-- Admin approval system
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_profile_update TIMESTAMP DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Notification and status fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;

-- MFA and Security fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Timestamp fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ============================================================================
-- PART 2: Create Enhanced Companies Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  
  -- Primary company information
  company_name TEXT NOT NULL,
  
  -- Primary user (company manager) - created during initial registration
  primary_user_name TEXT NOT NULL,
  primary_user_email TEXT NOT NULL,
  
  -- Company address
  address_1 TEXT NOT NULL,
  address_2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  
  -- Billing address (optional)
  billing_address_1 TEXT,
  billing_address_2 TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_zip_code TEXT,
  
  -- Payment method
  payment_method TEXT NOT NULL CHECK (payment_method IN ('invoiced', 'qualia', 'pre_pay')),
  
  -- Contact and operational information
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT,
  
  -- Status and preferences
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  preferred_notary_id INTEGER,
  
  -- Company manager
  company_manager_id INTEGER,
  
  -- Authorized users (array of user IDs)
  authorized_user_ids INTEGER[] DEFAULT '{}',
  
  -- Billing and subscription information
  subscription_plan TEXT,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  next_billing_date TIMESTAMP,
  
  -- Company settings
  default_closing_type TEXT,
  allow_user_self_registration BOOLEAN DEFAULT false,
  requires_approval_for_new_users BOOLEAN DEFAULT true,
  
  -- Audit fields
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by INTEGER,
  last_modified_by INTEGER
);

-- ============================================================================
-- PART 3: Add Foreign Key Constraints
-- ============================================================================

-- User table foreign keys
ALTER TABLE users ADD CONSTRAINT fk_users_company_id 
  FOREIGN KEY (company_id) REFERENCES companies(id);

ALTER TABLE users ADD CONSTRAINT fk_users_approved_by 
  FOREIGN KEY (approved_by) REFERENCES users(id);

-- Company table foreign keys
ALTER TABLE companies ADD CONSTRAINT fk_companies_preferred_notary_id 
  FOREIGN KEY (preferred_notary_id) REFERENCES users(id);

ALTER TABLE companies ADD CONSTRAINT fk_companies_company_manager_id 
  FOREIGN KEY (company_manager_id) REFERENCES users(id);

ALTER TABLE companies ADD CONSTRAINT fk_companies_created_by 
  FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE companies ADD CONSTRAINT fk_companies_last_modified_by 
  FOREIGN KEY (last_modified_by) REFERENCES users(id);

-- ============================================================================
-- PART 4: Create Indexes for Performance
-- ============================================================================

-- User table indexes
CREATE INDEX IF NOT EXISTS idx_users_full_name ON users(full_name);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_role);
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);
CREATE INDEX IF NOT EXISTS idx_users_enhanced_qualifications ON users(
  role, notary_type, is_notary_signing_agent, is_spanish_speaking, 
  signing_agent_certified, is_active
);

-- Company table indexes
CREATE INDEX IF NOT EXISTS idx_companies_company_name ON companies(company_name);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_manager_id ON companies(company_manager_id);
CREATE INDEX IF NOT EXISTS idx_companies_preferred_notary ON companies(preferred_notary_id);
CREATE INDEX IF NOT EXISTS idx_companies_primary_email ON companies(primary_user_email);
CREATE INDEX IF NOT EXISTS idx_companies_payment_method ON companies(payment_method);

-- ============================================================================
-- PART 5: Add Check Constraints
-- ============================================================================

-- User table constraints
ALTER TABLE users ADD CONSTRAINT check_company_role 
  CHECK (company_role IS NULL OR company_role IN ('manager', 'user', 'authorized_user'));

ALTER TABLE users ADD CONSTRAINT check_approval_status 
  CHECK (approval_status IN ('pending', 'approved', 'rejected', 'requires_update'));

ALTER TABLE users ADD CONSTRAINT check_id_type 
  CHECK (id_type IS NULL OR id_type IN ('drivers_license', 'passport', 'state_id_card'));

ALTER TABLE users ADD CONSTRAINT check_foreign_languages 
  CHECK (foreign_languages IS NULL OR 
         (foreign_languages <@ ARRAY['Spanish', 'Italian', 'French', 'Portuguese', 'German', 'Mandarin']));

-- Update existing constraint for enhanced notary type
DROP CONSTRAINT IF EXISTS check_notary_type;
ALTER TABLE users ADD CONSTRAINT check_notary_type 
  CHECK (notary_type IS NULL OR notary_type IN ('contractor', 'subscriber'));

-- ============================================================================
-- PART 6: Data Migration and Updates
-- ============================================================================

-- Update existing users with full_name from first_name and last_name
UPDATE users SET full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE full_name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- Copy state field to commission_state for existing notaries
UPDATE users SET commission_state = state 
WHERE role = 'notary' AND commission_state IS NULL AND state IS NOT NULL;

-- Copy county field to county_parish for existing notaries  
UPDATE users SET county_parish = county 
WHERE county_parish IS NULL AND county IS NOT NULL;

-- Set default approval status for existing notaries
UPDATE users SET approval_status = 'approved' 
WHERE role = 'notary' AND approval_status = 'pending' AND is_active = true;

-- Mark legacy title companies for migration
UPDATE title_companies SET migrated_to_companies_table = false;

-- ============================================================================
-- PART 7: Create Triggers for Automatic Updates
-- ============================================================================

-- Function to update full_name when first_name or last_name changes
CREATE OR REPLACE FUNCTION update_user_full_name()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name = TRIM(CONCAT(COALESCE(NEW.first_name, ''), ' ', COALESCE(NEW.last_name, '')));
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update full_name
DROP TRIGGER IF EXISTS trigger_update_user_full_name ON users;
CREATE TRIGGER trigger_update_user_full_name
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_user_full_name();

-- Function to update company updated_at timestamp
CREATE OR REPLACE FUNCTION update_company_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update company updated_at
DROP TRIGGER IF EXISTS trigger_update_company_timestamp ON companies;
CREATE TRIGGER trigger_update_company_timestamp
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_company_timestamp();

-- ============================================================================
-- PART 8: Migration Completed
-- ============================================================================

-- Migration completed! Enhanced user management system is now ready. 