-- Migration: Add support for 'both' notary type
-- Date: 2025-01-26
-- Description: Update the system to support notaries who can be both contractors and subscribers

-- First, let's see the current notary type distribution
SELECT notary_type, COUNT(*) as count 
FROM users 
WHERE role = 'notary' 
GROUP BY notary_type;

-- Add a check constraint that allows 'both' as a valid notary type
-- Note: PostgreSQL text fields don't have built-in constraints, but we can add one
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS chk_notary_type;

ALTER TABLE users 
ADD CONSTRAINT chk_notary_type 
CHECK (notary_type IS NULL OR notary_type IN ('contractor', 'subscriber', 'both'));

-- Update the fee_calculation_rules table to support 'both' type
UPDATE fee_calculation_rules 
SET applicable_to_role = 'both' 
WHERE applicable_to_role = 'subscriber' OR applicable_to_role = 'contractor';

-- Add new fee rules specifically for hybrid notaries if needed
INSERT INTO fee_calculation_rules (
  rule_name,
  fee_type,
  amount,
  description,
  is_active,
  applicable_to_role,
  metadata,
  created_at
) VALUES (
  'hybrid_notary_platform_fee',
  'platform_base',
  1000, -- $10.00 in cents
  'Base platform fee for hybrid notaries when acting as subscribers',
  true,
  'both',
  '{"context": "subscriber_mode", "includes": ["id_verification", "20_minutes_session"]}',
  NOW()
) ON CONFLICT (rule_name) DO NOTHING;

-- Create indexes for better performance on notary type queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_notary_type_both 
ON users (notary_type) 
WHERE notary_type = 'both';

-- Update any existing 'contractor' notaries to 'both' if they should have both capabilities
-- This is commented out as it should be done manually based on business requirements
/*
UPDATE users 
SET notary_type = 'both' 
WHERE role = 'notary' 
  AND notary_type = 'contractor' 
  AND id IN (
    -- Add specific user IDs or criteria here based on business requirements
    SELECT id FROM users WHERE email IN ('specific@example.com')
  );
*/

-- Add a comment to document the change
COMMENT ON COLUMN users.notary_type IS 'Notary type: contractor (gets assigned jobs), subscriber (can create jobs), or both (can do either)';

-- Verify the changes
SELECT 
  'Updated notary type constraints and rules' as status,
  COUNT(*) as total_notaries,
  COUNT(CASE WHEN notary_type = 'contractor' THEN 1 END) as contractors,
  COUNT(CASE WHEN notary_type = 'subscriber' THEN 1 END) as subscribers,
  COUNT(CASE WHEN notary_type = 'both' THEN 1 END) as both_types
FROM users 
WHERE role = 'notary';
