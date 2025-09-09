-- Migration: Add job-specific role assignments
-- This allows users to have different roles within different jobs
-- while maintaining their primary system role

-- Add job-specific role fields to job_participants table
ALTER TABLE job_participants 
ADD COLUMN IF NOT EXISTS job_specific_role text, -- Role for this specific job (e.g., 'signer', 'witness')
ADD COLUMN IF NOT EXISTS primary_role text, -- User's primary system role (e.g., 'notary', 'title_company')
ADD COLUMN IF NOT EXISTS requires_id_verification boolean DEFAULT false, -- Whether this participant needs ID verification for this job
ADD COLUMN IF NOT EXISTS id_verification_completed boolean DEFAULT false, -- Whether ID verification is completed
ADD COLUMN IF NOT EXISTS id_verification_completed_at timestamp,
ADD COLUMN IF NOT EXISTS id_verification_bypass_reason text, -- Reason if verification was bypassed
ADD COLUMN IF NOT EXISTS id_verification_bypassed_by integer REFERENCES users(id),
ADD COLUMN IF NOT EXISTS id_verification_bypassed_at timestamp;

-- Add job-specific role fields to signers table for consistency
ALTER TABLE signers 
ADD COLUMN IF NOT EXISTS primary_user_role text, -- User's primary system role
ADD COLUMN IF NOT EXISTS requires_id_verification boolean DEFAULT true, -- Signers typically need ID verification
ADD COLUMN IF NOT EXISTS id_verification_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS id_verification_completed_at timestamp,
ADD COLUMN IF NOT EXISTS id_verification_method text; -- 'evs', 'admin_bypass', 'notary_bypass'

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_job_participants_job_specific_role ON job_participants(job_specific_role);
CREATE INDEX IF NOT EXISTS idx_job_participants_requires_verification ON job_participants(requires_id_verification);
CREATE INDEX IF NOT EXISTS idx_signers_primary_user_role ON signers(primary_user_role);

-- Update existing job_participants to set primary_role from users table
UPDATE job_participants 
SET primary_role = users.role 
FROM users 
WHERE job_participants.user_id = users.id 
AND job_participants.primary_role IS NULL;

-- Update existing job_participants to set job_specific_role same as role initially
UPDATE job_participants 
SET job_specific_role = role 
WHERE job_specific_role IS NULL;

-- Set requires_id_verification based on job_specific_role
UPDATE job_participants 
SET requires_id_verification = CASE 
    WHEN job_specific_role IN ('signer', 'witness') THEN true 
    ELSE false 
END
WHERE requires_id_verification IS NULL OR requires_id_verification = false;

-- Update existing signers to set primary_user_role from users table
UPDATE signers 
SET primary_user_role = users.role 
FROM users 
WHERE signers.user_id = users.id 
AND signers.primary_user_role IS NULL;

-- Create a view for easy querying of participant roles
CREATE OR REPLACE VIEW participant_role_summary AS
SELECT 
    jp.id,
    jp.job_id,
    jp.user_id,
    jp.email,
    u.username,
    u.first_name,
    u.last_name,
    jp.primary_role as user_system_role,
    jp.job_specific_role as job_role,
    jp.requires_id_verification,
    jp.id_verification_completed,
    jp.invite_status,
    CASE 
        WHEN jp.primary_role != jp.job_specific_role THEN true 
        ELSE false 
    END as has_dual_role,
    CASE 
        WHEN jp.requires_id_verification AND NOT jp.id_verification_completed THEN 'verification_required'
        WHEN jp.requires_id_verification AND jp.id_verification_completed THEN 'verified'
        ELSE 'no_verification_needed'
    END as verification_status
FROM job_participants jp
LEFT JOIN users u ON jp.user_id = u.id;

-- Add comments for documentation
COMMENT ON COLUMN job_participants.job_specific_role IS 'The role this user has for this specific job (e.g., signer, witness, observer)';
COMMENT ON COLUMN job_participants.primary_role IS 'The users primary system role (e.g., notary, title_company, client)';
COMMENT ON COLUMN job_participants.requires_id_verification IS 'Whether this participant needs ID verification for their job-specific role';
COMMENT ON VIEW participant_role_summary IS 'Summary view of participant roles and verification status for easy querying';
