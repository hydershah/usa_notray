-- KBA (Knowledge-Based Authentication) System Migration
-- This migration adds support for KBA verification alongside existing ID verification

-- Add KBA fields to the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_verification_date TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_score INTEGER; -- 0-100 score from KBA verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_provider TEXT; -- 'evs', 'lexisnexis', 'transunion'
ALTER TABLE users ADD COLUMN IF NOT EXISTS kba_sessions_completed INTEGER DEFAULT 0;

-- Create KBA sessions table for tracking KBA sessions
CREATE TABLE IF NOT EXISTS kba_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'initialized', -- 'initialized', 'ready', 'completed', 'failed', 'expired'
    questions_count INTEGER NOT NULL,
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0, -- 0-100 score
    provider TEXT NOT NULL, -- 'evs', 'lexisnexis', 'transunion'
    expires_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_kba_sessions_user_id ON kba_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_kba_sessions_session_id ON kba_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_kba_sessions_status ON kba_sessions(status);
CREATE INDEX IF NOT EXISTS idx_kba_sessions_provider ON kba_sessions(provider);
CREATE INDEX IF NOT EXISTS idx_users_kba_verified ON users(kba_verified);
CREATE INDEX IF NOT EXISTS idx_users_kba_provider ON users(kba_provider);

-- Add comments for documentation
COMMENT ON COLUMN users.kba_verified IS 'Whether user has successfully completed KBA verification';
COMMENT ON COLUMN users.kba_verification_date IS 'Date when user completed KBA verification';
COMMENT ON COLUMN users.kba_score IS 'Score from 0-100 from KBA verification process';
COMMENT ON COLUMN users.kba_provider IS 'KBA provider used (evs, lexisnexis, transunion)';
COMMENT ON COLUMN users.kba_sessions_completed IS 'Number of KBA sessions user has completed';

COMMENT ON TABLE kba_sessions IS 'Tracks KBA (Knowledge-Based Authentication) verification sessions';
COMMENT ON COLUMN kba_sessions.session_id IS 'Unique session identifier from KBA provider';
COMMENT ON COLUMN kba_sessions.status IS 'Current status of the KBA session';
COMMENT ON COLUMN kba_sessions.questions_count IS 'Total number of questions in the session';
COMMENT ON COLUMN kba_sessions.questions_answered IS 'Number of questions user has answered';
COMMENT ON COLUMN kba_sessions.correct_answers IS 'Number of questions answered correctly';
COMMENT ON COLUMN kba_sessions.score IS 'Final score from 0-100 based on correct answers';
COMMENT ON COLUMN kba_sessions.provider IS 'KBA provider used for this session';
COMMENT ON COLUMN kba_sessions.expires_at IS 'When this KBA session expires';
COMMENT ON COLUMN kba_sessions.completed_at IS 'When user completed the KBA session';

-- Update the updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_kba_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kba_sessions_updated_at 
    BEFORE UPDATE ON kba_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_kba_sessions_updated_at();

-- Function to clean up expired KBA sessions
CREATE OR REPLACE FUNCTION cleanup_expired_kba_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM kba_sessions 
    WHERE expires_at < NOW() 
    AND status NOT IN ('completed', 'failed');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    INSERT INTO system_logs (level, message, details, created_at)
    VALUES ('info', 'Cleaned up expired KBA sessions', 
            jsonb_build_object('deleted_count', deleted_count), NOW());
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert default KBA configuration settings
INSERT INTO system_settings (key, value, type, description, is_protected) VALUES
('kba_provider', 'evs', 'string', 'Default KBA provider (evs, lexisnexis, transunion)', true),
('kba_passing_score', '75', 'number', 'Minimum score required to pass KBA verification', true),
('kba_session_timeout', '10', 'number', 'KBA session timeout in minutes', true),
('kba_max_questions', '5', 'number', 'Maximum number of KBA questions per session', true),
('kba_retry_limit', '3', 'number', 'Maximum number of KBA retry attempts per user', true)
ON CONFLICT (key) DO NOTHING;

-- Log the migration
INSERT INTO system_logs (level, message, details, created_at)
VALUES ('info', 'KBA system migration completed successfully', 
        jsonb_build_object(
            'migration', 'migration-kba-system.sql',
            'tables_created', 1,
            'columns_added', 5,
            'indexes_created', 6,
            'functions_created', 2
        ), NOW());

-- Display completion message
DO $$ 
BEGIN 
    RAISE NOTICE '✅ KBA (Knowledge-Based Authentication) system migration completed successfully!';
    RAISE NOTICE '📋 Added KBA fields to users table';
    RAISE NOTICE '🗃️  Created kba_sessions table';
    RAISE NOTICE '📊 Added indexes for better performance';
    RAISE NOTICE '⚙️  Configured system settings for KBA';
    RAISE NOTICE '🧹 Added cleanup function for expired sessions';
END $$; 