-- Simplify participant roles to just Signer, Witness, Observer
-- This migration updates the participant_roles table to only include the three simplified roles

-- First, backup existing roles (in case rollback is needed)
CREATE TABLE IF NOT EXISTS participant_roles_backup_$(date +%Y%m%d) AS 
SELECT * FROM participant_roles;

-- Clear existing roles
DELETE FROM participant_roles;

-- Insert simplified roles
INSERT INTO participant_roles (name, display_name, description, category, requires_signature, requires_id_verification, is_active, sort_order, created_at, updated_at)
VALUES 
  (
    'signer', 
    'Signer', 
    'Signs documents (ID verification required)', 
    'signer', 
    true, 
    true, 
    true, 
    1, 
    NOW(), 
    NOW()
  ),
  (
    'witness', 
    'Witness', 
    'Observes signing (ID verification required)', 
    'witness', 
    false, 
    true, 
    true, 
    2, 
    NOW(), 
    NOW()
  ),
  (
    'observer', 
    'Observer', 
    'Can view but cannot sign (no ID verification)', 
    'observer', 
    false, 
    false, 
    true, 
    3, 
    NOW(), 
    NOW()
  );

-- Update existing signers and job_participants to use the simplified roles
-- Map old roles to new simplified roles:
-- 'borrower', 'co-borrower', 'seller', 'buyer', 'power_of_attorney', 'trust_beneficiary' -> 'signer'
-- 'witness' -> 'witness' 
-- Everything else -> 'observer'

-- Update signers table
UPDATE signers 
SET signer_role = CASE 
  WHEN signer_role IN ('borrower', 'co-borrower', 'seller', 'buyer', 'power_of_attorney', 'trust_beneficiary', 'other') THEN 'signer'
  WHEN signer_role = 'witness' THEN 'witness'
  ELSE 'observer'
END
WHERE signer_role IS NOT NULL;

-- Update job_participants table
UPDATE job_participants 
SET role = CASE 
  WHEN role IN ('borrower', 'co-borrower', 'seller', 'buyer', 'power_of_attorney', 'trust_beneficiary', 'other') THEN 'signer'
  WHEN role = 'witness' THEN 'witness'
  ELSE 'observer'
END
WHERE role IS NOT NULL;

-- Log the changes
INSERT INTO admin_logs (admin_id, action, details, target_type, target_id, created_at)
SELECT 
  1, -- Admin user ID (adjust if needed)
  'participant_roles_simplified',
  'Simplified participant roles to just Signer, Witness, and Observer',
  'participant_roles',
  null,
  NOW()
WHERE EXISTS (SELECT 1 FROM admin_logs LIMIT 1); -- Only if admin_logs table exists