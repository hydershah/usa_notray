-- Migration: Add Session Participants Status Table
-- Description: Add missing session_participants_status table for tracking participant status in live signing sessions

BEGIN;

-- Create session_participants_status table
CREATE TABLE IF NOT EXISTS session_participants_status (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES editor_sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT NOW(),
    left_at TIMESTAMP,
    is_active BOOLEAN DEFAULT false,
    last_activity TIMESTAMP DEFAULT NOW(),
    can_interact BOOLEAN DEFAULT false,
    UNIQUE(session_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_session_participants_status_session_id ON session_participants_status(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_status_user_id ON session_participants_status(user_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_status_active ON session_participants_status(is_active);

-- Add comments
COMMENT ON TABLE session_participants_status IS 'Tracks participant status in live signing sessions';
COMMENT ON COLUMN session_participants_status.session_id IS 'Reference to editor_sessions.id';
COMMENT ON COLUMN session_participants_status.user_id IS 'Reference to users.id';
COMMENT ON COLUMN session_participants_status.is_active IS 'Whether participant is currently active in session';
COMMENT ON COLUMN session_participants_status.can_interact IS 'Whether participant can interact with session (e.g., place tags)';

COMMIT; 