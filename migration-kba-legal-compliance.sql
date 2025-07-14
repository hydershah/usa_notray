-- KBA Legal Compliance Migration
-- Adds proper tracking for 2 attempts and 24-hour lockout as required by law

BEGIN;

-- Add legal compliance fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_attempts_used INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_last_attempt_date TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_lockout_reason TEXT;

-- Update KBA sessions table for legal compliance
ALTER TABLE kba_sessions ADD COLUMN IF NOT EXISTS attempt_number INTEGER DEFAULT 1;
ALTER TABLE kba_sessions ADD COLUMN IF NOT EXISTS questions_correct INTEGER DEFAULT 0;
ALTER TABLE kba_sessions ADD COLUMN IF NOT EXISTS passing_threshold INTEGER DEFAULT 4; -- Legal requirement: 4 out of 5 correct
ALTER TABLE kba_sessions ADD COLUMN IF NOT EXISTS is_legal_attempt BOOLEAN DEFAULT true;
ALTER TABLE kba_sessions ADD COLUMN IF NOT EXISTS lockout_applied BOOLEAN DEFAULT false;

-- Create KBA lockout log table for audit compliance
CREATE TABLE IF NOT EXISTS kba_lockout_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    job_id INTEGER REFERENCES jobs(id), -- Track which job triggered the lockout
    lockout_reason TEXT NOT NULL, -- 'failed_two_attempts', 'manual_admin', etc.
    locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMP NOT NULL,
    unlocked_at TIMESTAMP,
    unlocked_by INTEGER REFERENCES users(id), -- Admin who manually unlocked
    unlock_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_kba_locked_until ON users(kba_locked_until);
CREATE INDEX IF NOT EXISTS idx_users_kba_attempts ON users(kba_attempts_used);
CREATE INDEX IF NOT EXISTS idx_kba_sessions_attempt_number ON kba_sessions(attempt_number);
CREATE INDEX IF NOT EXISTS idx_kba_lockout_log_user_locked ON kba_lockout_log(user_id, locked_until);

-- Function to check if user is currently locked out from KBA
CREATE OR REPLACE FUNCTION is_user_kba_locked(user_id_param INTEGER)
RETURNS TABLE(
    is_locked BOOLEAN,
    locked_until TIMESTAMP,
    reason TEXT,
    time_remaining_seconds INTEGER
) AS $$
DECLARE
    user_record RECORD;
    current_time TIMESTAMP;
BEGIN
    current_time := NOW();
    
    SELECT kba_locked_until, kba_lockout_reason, kba_attempts_used
    INTO user_record
    FROM users 
    WHERE id = user_id_param;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::TIMESTAMP, 'user_not_found'::TEXT, 0;
        RETURN;
    END IF;
    
    -- Check if user is currently locked out
    IF user_record.kba_locked_until IS NOT NULL AND user_record.kba_locked_until > current_time THEN
        RETURN QUERY SELECT 
            TRUE,
            user_record.kba_locked_until,
            COALESCE(user_record.kba_lockout_reason, 'locked'),
            EXTRACT(EPOCH FROM (user_record.kba_locked_until - current_time))::INTEGER;
    ELSE
        RETURN QUERY SELECT FALSE, NULL::TIMESTAMP, NULL::TEXT, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to apply KBA lockout after failed attempts
CREATE OR REPLACE FUNCTION apply_kba_lockout(
    user_id_param INTEGER,
    job_id_param INTEGER DEFAULT NULL,
    lockout_reason_param TEXT DEFAULT 'failed_two_attempts'
) RETURNS BOOLEAN AS $$
DECLARE
    lockout_until TIMESTAMP;
BEGIN
    -- Calculate 24-hour lockout period
    lockout_until := NOW() + INTERVAL '24 hours';
    
    -- Update user's lockout status
    UPDATE users 
    SET 
        kba_locked_until = lockout_until,
        kba_lockout_reason = lockout_reason_param,
        updated_at = NOW()
    WHERE id = user_id_param;
    
    -- Log the lockout for audit purposes
    INSERT INTO kba_lockout_log (
        user_id,
        job_id,
        lockout_reason,
        locked_until
    ) VALUES (
        user_id_param,
        job_id_param,
        lockout_reason_param,
        lockout_until
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment KBA attempts and check if lockout needed
CREATE OR REPLACE FUNCTION increment_kba_attempts(
    user_id_param INTEGER,
    job_id_param INTEGER DEFAULT NULL,
    failed_attempt BOOLEAN DEFAULT TRUE
) RETURNS TABLE(
    attempts_used INTEGER,
    should_lockout BOOLEAN,
    lockout_applied BOOLEAN
) AS $$
DECLARE
    current_attempts INTEGER;
    lockout_applied_result BOOLEAN := FALSE;
BEGIN
    -- Get current attempts
    SELECT kba_attempts_used INTO current_attempts
    FROM users WHERE id = user_id_param;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT 0, FALSE, FALSE;
        RETURN;
    END IF;
    
    -- Increment attempts only if it's a failed attempt
    IF failed_attempt THEN
        current_attempts := current_attempts + 1;
        
        UPDATE users 
        SET 
            kba_attempts_used = current_attempts,
            kba_last_attempt_date = NOW(),
            updated_at = NOW()
        WHERE id = user_id_param;
        
        -- Check if user should be locked out (2 attempts used)
        IF current_attempts >= 2 THEN
            SELECT apply_kba_lockout(user_id_param, job_id_param) INTO lockout_applied_result;
            RETURN QUERY SELECT current_attempts, TRUE, lockout_applied_result;
        ELSE
            RETURN QUERY SELECT current_attempts, FALSE, FALSE;
        END IF;
    ELSE
        -- Successful attempt - reset attempts counter
        UPDATE users 
        SET 
            kba_attempts_used = 0,
            kba_locked_until = NULL,
            kba_lockout_reason = NULL,
            kba_last_attempt_date = NOW(),
            updated_at = NOW()
        WHERE id = user_id_param;
        
        RETURN QUERY SELECT 0, FALSE, FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to manually unlock a user (admin only)
CREATE OR REPLACE FUNCTION unlock_kba_user(
    user_id_param INTEGER,
    admin_id_param INTEGER,
    unlock_reason_param TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Update user status
    UPDATE users 
    SET 
        kba_locked_until = NULL,
        kba_lockout_reason = NULL,
        kba_attempts_used = 0,
        updated_at = NOW()
    WHERE id = user_id_param;
    
    -- Update the lockout log
    UPDATE kba_lockout_log 
    SET 
        unlocked_at = NOW(),
        unlocked_by = admin_id_param,
        unlock_reason = unlock_reason_param
    WHERE user_id = user_id_param 
    AND unlocked_at IS NULL
    AND locked_until > NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to reset KBA attempts after 24 hours
CREATE OR REPLACE FUNCTION reset_expired_kba_lockouts()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER;
BEGIN
    -- Reset users whose lockout period has expired
    UPDATE users 
    SET 
        kba_locked_until = NULL,
        kba_lockout_reason = NULL,
        kba_attempts_used = 0,
        updated_at = NOW()
    WHERE kba_locked_until IS NOT NULL 
    AND kba_locked_until <= NOW();
    
    GET DIAGNOSTICS reset_count = ROW_COUNT;
    
    -- Log the automatic reset
    INSERT INTO system_logs (level, message, details, created_at)
    VALUES ('info', 'Reset expired KBA lockouts', 
            jsonb_build_object('reset_count', reset_count), NOW());
    
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON COLUMN users.kba_attempts_used IS 'Number of KBA attempts used (max 2 allowed)';
COMMENT ON COLUMN users.kba_locked_until IS 'When the KBA lockout expires (24-hour lockout)';
COMMENT ON COLUMN users.kba_last_attempt_date IS 'Date of last KBA attempt';
COMMENT ON COLUMN users.kba_lockout_reason IS 'Reason for KBA lockout';

COMMENT ON TABLE kba_lockout_log IS 'Audit log for KBA lockouts and unlocks';
COMMENT ON COLUMN kba_lockout_log.lockout_reason IS 'Reason for lockout (failed_two_attempts, manual_admin, etc.)';

COMMENT ON FUNCTION is_user_kba_locked IS 'Check if user is currently locked out from KBA';
COMMENT ON FUNCTION apply_kba_lockout IS 'Apply 24-hour KBA lockout to user';
COMMENT ON FUNCTION increment_kba_attempts IS 'Increment KBA attempts and apply lockout if needed';

-- Insert default system settings for KBA legal compliance
INSERT INTO system_settings (key, value, type, description, is_protected) VALUES
('kba_max_attempts', '2', 'number', 'Maximum KBA attempts before 24-hour lockout (LEGAL REQUIREMENT)', true),
('kba_lockout_hours', '24', 'number', 'Hours to lock user after failed attempts (LEGAL REQUIREMENT)', true),
('kba_questions_required', '5', 'number', 'Number of questions per KBA session (from EVS)', true),
('kba_correct_answers_required', '4', 'number', 'Minimum correct answers required (LEGAL REQUIREMENT)', true),
('kba_cleanup_interval_hours', '1', 'number', 'How often to reset expired lockouts (hours)', false)
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- Log the migration
INSERT INTO system_logs (level, message, details, created_at)
VALUES ('info', 'KBA legal compliance migration completed', 
        jsonb_build_object(
            'migration', 'migration-kba-legal-compliance.sql',
            'functions_created', 5,
            'columns_added', 4,
            'tables_created', 1,
            'compliance_level', 'legal_requirements_implemented'
        ), NOW()); 