-- Migration: ID Verification Requirements for Signers and Witnesses
-- Date: 2024-01-XX
-- Description: Add verification tracking and session access controls specifically for signers and witnesses

BEGIN;

-- Add verification tracking fields to job_participants table
ALTER TABLE job_participants 
ADD COLUMN IF NOT EXISTS verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS can_join_session BOOLEAN DEFAULT TRUE;

-- Update existing participants to require verification for signers and witnesses
UPDATE job_participants 
SET verification_required = TRUE 
WHERE role IN ('signer', 'witness');

-- Add session access log table to track verification attempts
CREATE TABLE IF NOT EXISTS session_access_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  access_granted BOOLEAN NOT NULL DEFAULT FALSE,
  denial_reason TEXT, -- 'not_verified', 'account_incomplete', 'not_authorized'
  user_role TEXT NOT NULL,
  verification_status TEXT, -- Current verification status at time of attempt
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_participants_verification ON job_participants(verification_required, verification_completed_at);
CREATE INDEX IF NOT EXISTS idx_job_participants_role ON job_participants(role);
CREATE INDEX IF NOT EXISTS idx_session_access_attempts_user_job ON session_access_attempts(user_id, job_id);
CREATE INDEX IF NOT EXISTS idx_session_access_attempts_denied ON session_access_attempts(access_granted, denial_reason);

-- Update session_participants table to track ID verification status
ALTER TABLE session_participants 
ADD COLUMN IF NOT EXISTS id_verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS id_verification_completed BOOLEAN DEFAULT FALSE;

-- Function to check if user can join session
CREATE OR REPLACE FUNCTION can_user_join_session(user_id_param INTEGER, job_id_param INTEGER)
RETURNS TABLE(
  can_join BOOLEAN,
  reason TEXT,
  user_role TEXT,
  verification_status TEXT
) AS $$
DECLARE
  user_record RECORD;
  participant_record RECORD;
BEGIN
  -- Get user details
  SELECT * INTO user_record FROM users WHERE id = user_id_param;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'user_not_found', NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Get participant details
  SELECT * INTO participant_record FROM job_participants 
  WHERE user_id = user_id_param AND job_id = job_id_param;
  
  -- Check if user is authorized for this job
  IF participant_record IS NULL THEN
    -- Check if user is admin, job creator, or assigned notary
    IF user_record.role = 'admin' THEN
      RETURN QUERY SELECT TRUE, 'admin_access', user_record.role, user_record.verification_status;
      RETURN;
    END IF;
    
    -- Check if user is job creator or assigned notary
    IF EXISTS (
      SELECT 1 FROM jobs 
      WHERE id = job_id_param 
      AND (user_id = user_id_param OR notary_id = user_id_param)
    ) THEN
      RETURN QUERY SELECT TRUE, 'job_access', user_record.role, user_record.verification_status;
      RETURN;
    END IF;
    
    RETURN QUERY SELECT FALSE, 'not_authorized', user_record.role, user_record.verification_status;
    RETURN;
  END IF;
  
  -- Check if invitation is accepted
  IF participant_record.invite_status != 'accepted' THEN
    RETURN QUERY SELECT FALSE, 'invitation_not_accepted', user_record.role, user_record.verification_status;
    RETURN;
  END IF;
  
  -- For signers and witnesses, check verification requirements
  IF user_record.role IN ('signer', 'witness') THEN
    -- Check account setup
    IF NOT COALESCE(user_record.account_setup_complete, FALSE) THEN
      RETURN QUERY SELECT FALSE, 'account_setup_incomplete', user_record.role, user_record.verification_status;
      RETURN;
    END IF;
    
    -- Check ID verification
    IF NOT COALESCE(user_record.is_verified, FALSE) THEN
      RETURN QUERY SELECT FALSE, 'id_verification_required', user_record.role, user_record.verification_status;
      RETURN;
    END IF;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT TRUE, 'access_granted', user_record.role, user_record.verification_status;
END;
$$ LANGUAGE plpgsql;

-- Log session access attempts for auditing
CREATE OR REPLACE FUNCTION log_session_access_attempt(
  user_id_param INTEGER,
  job_id_param INTEGER,
  access_granted_param BOOLEAN,
  denial_reason_param TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT role, verification_status INTO user_record FROM users WHERE id = user_id_param;
  
  INSERT INTO session_access_attempts (
    user_id,
    job_id,
    access_granted,
    denial_reason,
    user_role,
    verification_status
  ) VALUES (
    user_id_param,
    job_id_param,
    access_granted_param,
    denial_reason_param,
    user_record.role,
    user_record.verification_status
  );
END;
$$ LANGUAGE plpgsql;

-- Add constraints
ALTER TABLE job_participants ADD CONSTRAINT check_verification_role 
  CHECK (
    (role IN ('signer', 'witness') AND verification_required = TRUE) OR 
    (role NOT IN ('signer', 'witness'))
  );

ALTER TABLE session_access_attempts ADD CONSTRAINT check_denial_reason 
  CHECK (
    (access_granted = FALSE AND denial_reason IS NOT NULL) OR 
    (access_granted = TRUE AND denial_reason IS NULL)
  );

COMMIT;

-- Verification queries to check the migration
-- SELECT role, verification_required, COUNT(*) 
-- FROM job_participants 
-- GROUP BY role, verification_required 
-- ORDER BY role;

-- SELECT user_role, access_granted, denial_reason, COUNT(*) 
-- FROM session_access_attempts 
-- GROUP BY user_role, access_granted, denial_reason 
-- ORDER BY user_role; 