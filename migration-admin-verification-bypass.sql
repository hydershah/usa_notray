-- Migration: Admin Verification Bypass System
-- Date: 2024-01-XX
-- Description: Add admin verification bypass functionality to allow admins to manually override KYC/ID verification

BEGIN;

-- Add admin verification bypass fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_bypassed_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS verification_bypassed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verification_bypass_reason TEXT,
ADD COLUMN IF NOT EXISTS is_verification_bypassed BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on bypassed users
CREATE INDEX IF NOT EXISTS idx_users_verification_bypassed ON users(is_verification_bypassed);
CREATE INDEX IF NOT EXISTS idx_users_verification_bypassed_by ON users(verification_bypassed_by);

-- Create table for verification bypass audit log
CREATE TABLE IF NOT EXISTS verification_bypass_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    admin_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL CHECK (action IN ('bypass', 'remove_bypass')),
    reason TEXT NOT NULL,
    previous_verification_status TEXT,
    new_verification_status TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for verification bypass log
CREATE INDEX IF NOT EXISTS idx_verification_bypass_log_user_id ON verification_bypass_log(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_bypass_log_admin_id ON verification_bypass_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_verification_bypass_log_created_at ON verification_bypass_log(created_at);

-- Function to update user verification with bypass
CREATE OR REPLACE FUNCTION bypass_user_verification(
    p_user_id INTEGER,
    p_admin_id INTEGER,
    p_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_previous_status TEXT;
BEGIN
    -- Get current verification status
    SELECT verification_status INTO v_previous_status
    FROM users 
    WHERE id = p_user_id;
    
    -- Update user verification status
    UPDATE users 
    SET 
        is_verified = TRUE,
        verification_status = 'approved',
        is_verification_bypassed = TRUE,
        verification_bypassed_by = p_admin_id,
        verification_bypassed_at = NOW(),
        verification_bypass_reason = p_reason
    WHERE id = p_user_id;
    
    -- Log the bypass action
    INSERT INTO verification_bypass_log (
        user_id, 
        admin_id, 
        action, 
        reason, 
        previous_verification_status,
        new_verification_status
    ) VALUES (
        p_user_id,
        p_admin_id,
        'bypass',
        p_reason,
        v_previous_status,
        'approved'
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to remove verification bypass
CREATE OR REPLACE FUNCTION remove_verification_bypass(
    p_user_id INTEGER,
    p_admin_id INTEGER,
    p_reason TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_previous_status TEXT;
BEGIN
    -- Get current verification status
    SELECT verification_status INTO v_previous_status
    FROM users 
    WHERE id = p_user_id;
    
    -- Update user verification status
    UPDATE users 
    SET 
        is_verified = FALSE,
        verification_status = 'pending',
        is_verification_bypassed = FALSE,
        verification_bypassed_by = NULL,
        verification_bypassed_at = NULL,
        verification_bypass_reason = NULL
    WHERE id = p_user_id;
    
    -- Log the bypass removal action
    INSERT INTO verification_bypass_log (
        user_id, 
        admin_id, 
        action, 
        reason, 
        previous_verification_status,
        new_verification_status
    ) VALUES (
        p_user_id,
        p_admin_id,
        'remove_bypass',
        p_reason,
        v_previous_status,
        'pending'
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create view for admin verification dashboard
CREATE OR REPLACE VIEW admin_verification_dashboard AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.first_name,
    u.last_name,
    u.full_name,
    u.role,
    u.phone_number,
    u.is_verified,
    u.verification_status,
    u.is_verification_bypassed,
    u.verification_bypassed_at,
    u.verification_bypass_reason,
    bypass_admin.full_name as bypassed_by_admin,
    u.evs_transaction_id,
    u.evs_verification_confidence,
    u.evs_verified_at,
    u.evs_extracted_first_name,
    u.evs_extracted_last_name,
    u.evs_extracted_date_of_birth,
    u.id_type,
    u.id_number,
    u.id_expiration_date,
    u.evs_face_match_result,
    u.evs_face_match_confidence,
    u.evs_liveness_score,
    u.verification_retry_count,
    u.created_at,
    -- Count of verification attempts
    (SELECT COUNT(*) FROM user_verification_attempts uva WHERE uva.user_id = u.id) as total_verification_attempts,
    -- Latest verification attempt
    (SELECT attempted_at FROM user_verification_attempts uva WHERE uva.user_id = u.id ORDER BY attempted_at DESC LIMIT 1) as latest_verification_attempt,
    -- Last login
    u.last_login_at,
    u.is_active
FROM users u
LEFT JOIN users bypass_admin ON u.verification_bypassed_by = bypass_admin.id
WHERE u.role IN ('notary', 'signer', 'witness') -- Only roles that require verification
ORDER BY u.created_at DESC;

COMMIT; 