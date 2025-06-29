-- Migration to add notary type and active status fields to users table
-- Run this against your database to add the new columns

-- Add notary_type column for distinguishing contractor vs subscriber notaries
ALTER TABLE users ADD COLUMN notary_type TEXT;

-- Add is_active column for admin to activate/deactivate users
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Update existing notary users to have default notary_type of 'contractor'
UPDATE users SET notary_type = 'contractor' WHERE role = 'notary' AND notary_type IS NULL;

-- Add check constraint to ensure notary_type is valid
ALTER TABLE users ADD CONSTRAINT check_notary_type 
  CHECK (notary_type IS NULL OR notary_type IN ('contractor', 'subscriber'));

-- Create index on notary_type for better query performance
CREATE INDEX idx_users_notary_type ON users(notary_type);

-- Create index on is_active for better query performance  
CREATE INDEX idx_users_is_active ON users(is_active);

-- Update any existing inactive users (optional - modify as needed)
-- UPDATE users SET is_active = false WHERE <your_condition_here>;

-- Migration completed - notary fields added 