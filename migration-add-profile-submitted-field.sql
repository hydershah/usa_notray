-- Migration to add profileSubmitted field to users table
-- This field tracks whether a user has completed the profile submission process

BEGIN;

-- Add the profileSubmitted field to the users table
ALTER TABLE users 
ADD COLUMN profile_submitted BOOLEAN DEFAULT FALSE;

-- Set existing notary users who have some profile data as having submitted their profile
-- This prevents existing users from being forced to re-complete their profiles
UPDATE users 
SET profile_submitted = TRUE 
WHERE role = 'notary' 
  AND (
    name_on_commission IS NOT NULL 
    OR commission_number IS NOT NULL 
    OR commission_expiration IS NOT NULL
  );

-- Add a comment to the column for documentation
COMMENT ON COLUMN users.profile_submitted IS 'Tracks if user has gone through profile completion process';

COMMIT; 