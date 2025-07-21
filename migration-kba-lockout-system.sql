-- Migration: Add KBA lockout and attempt tracking system
-- This adds fields to track KBA attempts, failures, and lockouts

-- Add KBA attempt tracking and lockout fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_attempts_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_lockout_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_last_attempt_date TIMESTAMP;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_kba_locked_until ON users(kba_locked_until) WHERE kba_locked_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_kba_attempts ON users(kba_attempts_used) WHERE kba_attempts_used > 0;
CREATE INDEX IF NOT EXISTS idx_users_kba_last_attempt ON users(kba_last_attempt_date) WHERE kba_last_attempt_date IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.kba_attempts_used IS 'Number of KBA verification attempts used by this user';
COMMENT ON COLUMN users.kba_locked_until IS 'Timestamp until which user is locked out from KBA attempts';
COMMENT ON COLUMN users.kba_lockout_reason IS 'Reason for KBA lockout (e.g., too many failed attempts)';
COMMENT ON COLUMN users.kba_last_attempt_date IS 'Date and time of users last KBA attempt';

-- Create function to check if user is KBA locked
CREATE OR REPLACE FUNCTION is_user_kba_locked(user_id_param INTEGER)
RETURNS TABLE(
    is_locked BOOLEAN,
    locked_until TIMESTAMP,
    attempts_used INTEGER,
    can_retry BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (kba_locked_until IS NOT NULL AND kba_locked_until > NOW()) as is_locked,
        kba_locked_until as locked_until,
        COALESCE(kba_attempts_used, 0) as attempts_used,
        (COALESCE(kba_attempts_used, 0) < 2 AND (kba_locked_until IS NULL OR kba_locked_until <= NOW())) as can_retry
    FROM users 
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create function to handle KBA attempt tracking and lockout
CREATE OR REPLACE FUNCTION update_kba_attempt(
    user_id_param INTEGER,
    failed_attempt BOOLEAN DEFAULT TRUE
) RETURNS TABLE(
    attempts_used INTEGER,
    is_locked BOOLEAN,
    locked_until TIMESTAMP
) AS $$
DECLARE
    current_attempts INTEGER := 0;
    lockout_time TIMESTAMP;
BEGIN
    -- Get current attempts
    SELECT COALESCE(kba_attempts_used, 0) INTO current_attempts
    FROM users WHERE id = user_id_param;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0, FALSE, NULL::TIMESTAMP;
        RETURN;
    END IF;
    
    -- If this was a successful attempt, reset everything
    IF NOT failed_attempt THEN
        UPDATE users 
        SET 
            kba_attempts_used = 0,
            kba_locked_until = NULL,
            kba_lockout_reason = NULL,
            kba_last_attempt_date = NOW(),
            updated_at = NOW()
        WHERE id = user_id_param;
        
        RETURN QUERY SELECT 0, FALSE, NULL::TIMESTAMP;
        RETURN;
    END IF;
    
    -- Increment attempts for failed attempt
    current_attempts := current_attempts + 1;
    
    -- Check if user should be locked out (2 attempts = lockout)
    IF current_attempts >= 2 THEN
        lockout_time := NOW() + INTERVAL '24 hours';
        
        UPDATE users 
        SET 
            kba_attempts_used = current_attempts,
            kba_locked_until = lockout_time,
            kba_lockout_reason = 'Too many failed KBA attempts',
            kba_last_attempt_date = NOW(),
            updated_at = NOW()
        WHERE id = user_id_param;
        
        RETURN QUERY SELECT current_attempts, TRUE, lockout_time;
    ELSE
        -- Just update attempt count
        UPDATE users 
        SET 
            kba_attempts_used = current_attempts,
            kba_last_attempt_date = NOW(),
            updated_at = NOW()
        WHERE id = user_id_param;
        
        RETURN QUERY SELECT current_attempts, FALSE, NULL::TIMESTAMP;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to manually unlock KBA user (admin only)
CREATE OR REPLACE FUNCTION unlock_kba_user(
    user_id_param INTEGER,
    admin_id_param INTEGER,
    unlock_reason_param TEXT DEFAULT 'Manual unlock by admin'
) RETURNS BOOLEAN AS $$
BEGIN
    -- Reset KBA lockout and attempts
    UPDATE users 
    SET 
        kba_attempts_used = 0,
        kba_locked_until = NULL,
        kba_lockout_reason = NULL,
        kba_last_attempt_date = NOW(),
        updated_at = NOW()
    WHERE id = user_id_param;
    
    -- Log the unlock action (you could extend this to log in an audit table)
    INSERT INTO system_activity_logs (
        user_id, user_role, user_email, user_name,
        action, action_category, action_description,
        target_type, target_id, target_name,
        details, ip_address, is_system_action, created_at
    )
    SELECT 
        admin_id_param, u.role, u.email, u.full_name,
        'kba_user_unlocked', 'user_management', 'Admin manually unlocked KBA for user',
        'user', user_id_param, target.full_name,
        jsonb_build_object('reason', unlock_reason_param, 'unlocked_user_id', user_id_param),
        NULL, FALSE, NOW()
    FROM users u, users target
    WHERE u.id = admin_id_param AND target.id = user_id_param;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- System settings for KBA configuration
INSERT INTO system_settings (key, value, description) 
VALUES 
    ('kba_max_attempts', '2', 'Maximum KBA attempts before lockout')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO system_settings (key, value, description) 
VALUES 
    ('kba_lockout_hours', '24', 'Hours to lock user after max failed attempts')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

INSERT INTO system_settings (key, value, description) 
VALUES 
    ('kba_passing_score', '80', 'Minimum percentage to pass KBA (4 out of 5 questions)')
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value; 