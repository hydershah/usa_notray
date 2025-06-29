-- Migration: Add invitation fields to signers table
-- Date: 2024-01-XX
-- Description: Add invitation token, sent timestamp, and status fields to support email invitations

BEGIN;

-- Add new columns to signers table
ALTER TABLE signers 
ADD COLUMN invitation_token TEXT,
ADD COLUMN invitation_sent_at TIMESTAMP,
ADD COLUMN access_type TEXT DEFAULT 'guest',
ADD COLUMN guest_verification_status TEXT DEFAULT 'pending',
ADD COLUMN signing_status TEXT DEFAULT 'pending';

-- Create index on invitation_token for fast lookups
CREATE INDEX IF NOT EXISTS idx_signers_invitation_token ON signers(invitation_token);

-- Create index on signing_status for filtering
CREATE INDEX IF NOT EXISTS idx_signers_signing_status ON signers(signing_status);

-- Update existing signers to have proper default values
UPDATE signers 
SET 
    access_type = 'guest',
    guest_verification_status = 'pending',
    signing_status = 'pending'
WHERE 
    access_type IS NULL 
    OR guest_verification_status IS NULL 
    OR signing_status IS NULL;

-- Generate invitation tokens for existing signers without them
-- We'll let the application generate tokens as needed
UPDATE signers 
SET invitation_token = NULL
WHERE invitation_token IS NULL;

COMMIT;

-- Verify the migration
-- SELECT 
--     table_name, 
--     column_name, 
--     data_type, 
--     is_nullable,
--     column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'signers' 
-- AND column_name IN ('invitation_token', 'invitation_sent_at', 'access_type', 'guest_verification_status', 'signing_status')
-- ORDER BY ordinal_position; 