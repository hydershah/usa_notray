-- Migration: Notary Verification Bypass System
-- Date: 2024-01-XX
-- Description: Add notary verification bypass functionality to allow notaries to manually override KYC/ID verification for participants in their specific jobs

BEGIN;

-- Add notary verification bypass fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS notary_verification_bypassed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notary_verification_bypassed_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS notary_verification_bypassed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS notary_verification_bypassed_job_id INTEGER REFERENCES jobs(id),
ADD COLUMN IF NOT EXISTS notary_verification_bypass_reason TEXT;

-- Create indexes for faster queries on notary bypassed users
CREATE INDEX IF NOT EXISTS idx_users_notary_verification_bypassed ON users(notary_verification_bypassed);
CREATE INDEX IF NOT EXISTS idx_users_notary_verification_bypassed_by ON users(notary_verification_bypassed_by);
CREATE INDEX IF NOT EXISTS idx_users_notary_verification_bypassed_job_id ON users(notary_verification_bypassed_job_id);

-- Create table for notary verification bypass audit log
CREATE TABLE IF NOT EXISTS notary_verification_bypass_log (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    participant_id INTEGER NOT NULL REFERENCES users(id),
    notary_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL CHECK (action IN ('bypass', 'remove_bypass')),
    reason TEXT NOT NULL,
    previous_verification_status TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for notary verification bypass log
CREATE INDEX IF NOT EXISTS idx_notary_bypass_log_job_id ON notary_verification_bypass_log(job_id);
CREATE INDEX IF NOT EXISTS idx_notary_bypass_log_participant_id ON notary_verification_bypass_log(participant_id);
CREATE INDEX IF NOT EXISTS idx_notary_bypass_log_notary_id ON notary_verification_bypass_log(notary_id);
CREATE INDEX IF NOT EXISTS idx_notary_bypass_log_created_at ON notary_verification_bypass_log(created_at);

-- Function to check if notary can bypass verification for a participant
CREATE OR REPLACE FUNCTION can_notary_bypass_verification(
    p_notary_id INTEGER,
    p_participant_id INTEGER,
    p_job_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_is_notary_assigned BOOLEAN;
    v_is_participant_in_job BOOLEAN;
BEGIN
    -- Check if the notary is assigned to this job
    SELECT EXISTS (
        SELECT 1 FROM jobs 
        WHERE id = p_job_id 
        AND notary_id = p_notary_id
    ) INTO v_is_notary_assigned;
    
    -- Check if the participant is part of this job
    SELECT EXISTS (
        SELECT 1 FROM job_participants 
        WHERE job_id = p_job_id 
        AND user_id = p_participant_id
        AND role IN ('signer', 'witness')
    ) INTO v_is_participant_in_job;
    
    RETURN v_is_notary_assigned AND v_is_participant_in_job;
END;
$$ LANGUAGE plpgsql;

-- Function to bypass participant verification by notary
CREATE OR REPLACE FUNCTION notary_bypass_participant_verification(
    p_notary_id INTEGER,
    p_participant_id INTEGER,
    p_job_id INTEGER,
    p_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_previous_status TEXT;
    v_can_bypass BOOLEAN;
BEGIN
    -- Check if notary has permission to bypass for this participant
    SELECT can_notary_bypass_verification(p_notary_id, p_participant_id, p_job_id) INTO v_can_bypass;
    
    IF NOT v_can_bypass THEN
        RAISE EXCEPTION 'Notary % does not have permission to bypass verification for participant % in job %', 
            p_notary_id, p_participant_id, p_job_id;
    END IF;
    
    -- Get current verification status
    SELECT verification_status INTO v_previous_status
    FROM users WHERE id = p_participant_id;
    
    -- Update user verification status with notary bypass
    UPDATE users SET
        is_verified = TRUE,
        verification_status = 'approved',
        notary_verification_bypassed = TRUE,
        notary_verification_bypassed_by = p_notary_id,
        notary_verification_bypassed_at = NOW(),
        notary_verification_bypassed_job_id = p_job_id,
        notary_verification_bypass_reason = p_reason
    WHERE id = p_participant_id;
    
    -- Log the bypass action
    INSERT INTO notary_verification_bypass_log (
        job_id,
        participant_id,
        notary_id,
        action,
        reason,
        previous_verification_status
    ) VALUES (
        p_job_id,
        p_participant_id,
        p_notary_id,
        'bypass',
        p_reason,
        v_previous_status
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to remove notary bypass
CREATE OR REPLACE FUNCTION remove_notary_bypass_verification(
    p_notary_id INTEGER,
    p_participant_id INTEGER,
    p_job_id INTEGER,
    p_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_previous_status TEXT;
BEGIN
    -- Only the notary who bypassed or an admin can remove the bypass
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_participant_id 
        AND notary_verification_bypassed_by = p_notary_id
        AND notary_verification_bypassed_job_id = p_job_id
    ) AND NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_notary_id 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Only the notary who bypassed or an admin can remove the bypass';
    END IF;
    
    -- Get current verification status
    SELECT verification_status INTO v_previous_status
    FROM users WHERE id = p_participant_id;
    
    -- Remove notary bypass (keeps admin bypass if exists)
    UPDATE users SET
        notary_verification_bypassed = FALSE,
        notary_verification_bypassed_by = NULL,
        notary_verification_bypassed_at = NULL,
        notary_verification_bypassed_job_id = NULL,
        notary_verification_bypass_reason = NULL,
        -- Only reset verification if no admin bypass exists
        is_verified = CASE 
            WHEN is_verification_bypassed = TRUE THEN TRUE
            WHEN evs_transaction_id IS NOT NULL AND verification_status = 'approved' THEN TRUE
            ELSE FALSE
        END,
        verification_status = CASE
            WHEN is_verification_bypassed = TRUE THEN 'approved'
            WHEN evs_transaction_id IS NOT NULL AND verification_status = 'approved' THEN 'approved'
            ELSE 'pending'
        END
    WHERE id = p_participant_id;
    
    -- Log the removal
    INSERT INTO notary_verification_bypass_log (
        job_id,
        participant_id,
        notary_id,
        action,
        reason,
        previous_verification_status
    ) VALUES (
        p_job_id,
        p_participant_id,
        p_notary_id,
        'remove_bypass',
        p_reason,
        v_previous_status
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create view for notary verification dashboard
CREATE OR REPLACE VIEW notary_job_participants_verification AS
SELECT 
    jp.job_id,
    jp.user_id as participant_id,
    jp.role as participant_role,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    u.full_name,
    u.phone_number,
    u.is_verified,
    u.verification_status,
    u.is_verification_bypassed as admin_bypassed,
    u.notary_verification_bypassed as notary_bypassed,
    u.notary_verification_bypassed_by,
    u.notary_verification_bypassed_at,
    u.notary_verification_bypass_reason,
    bypass_notary.full_name as bypassed_by_notary_name,
    j.notary_id as assigned_notary_id,
    j.title_company,
    j.closing_type,
    j.selected_date,
    j.selected_time,
    jp.invite_status,
    jp.joined_at
FROM job_participants jp
INNER JOIN users u ON jp.user_id = u.id
INNER JOIN jobs j ON jp.job_id = j.id
LEFT JOIN users bypass_notary ON u.notary_verification_bypassed_by = bypass_notary.id
WHERE jp.role IN ('signer', 'witness')
ORDER BY jp.job_id, jp.role, u.full_name;

-- Grant permissions (adjust roles as needed)
GRANT SELECT ON notary_job_participants_verification TO authenticated;
GRANT EXECUTE ON FUNCTION can_notary_bypass_verification TO authenticated;
GRANT EXECUTE ON FUNCTION notary_bypass_participant_verification TO authenticated;
GRANT EXECUTE ON FUNCTION remove_notary_bypass_verification TO authenticated;

COMMIT; 