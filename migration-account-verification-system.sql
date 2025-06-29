-- Migration: Account Verification System
-- Date: 2024-01-XX
-- Description: Add password reset tokens table, update users table with verification fields, and link signers to user accounts

BEGIN;

-- Add password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for password reset tokens
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Add verification fields to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS account_setup_complete BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- Update existing users to have proper verification status
UPDATE users 
SET 
    account_setup_complete = TRUE,
    verification_status = 'verified'
WHERE account_setup_complete IS NULL OR verification_status IS NULL;

-- Add user_id to signers table if it doesn't exist
ALTER TABLE signers 
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- Update default access type for signers to 'registered'
ALTER TABLE signers 
ALTER COLUMN access_type SET DEFAULT 'registered';

-- Update existing signers to have registered access type
UPDATE signers 
SET access_type = 'registered' 
WHERE access_type = 'guest' OR access_type IS NULL;

-- Create index on signers user_id
CREATE INDEX IF NOT EXISTS idx_signers_user_id ON signers(user_id);

COMMIT;

-- Verification queries to check the migration
-- SELECT 
--     table_name, 
--     column_name, 
--     data_type, 
--     is_nullable,
--     column_default
-- FROM information_schema.columns 
-- WHERE table_name IN ('password_reset_tokens', 'users', 'signers')
-- AND column_name IN ('user_id', 'token', 'expires_at', 'used', 'account_setup_complete', 'verification_status')
-- ORDER BY table_name, ordinal_position; 