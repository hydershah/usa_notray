-- Migration: Add Live Signing Session Support
-- File: migration-live-signing-session-states.sql
-- Priority: CRITICAL - Required for live signing functionality

-- Add session state management to existing editor_sessions table
ALTER TABLE editor_sessions 
ADD COLUMN IF NOT EXISTS signing_state VARCHAR(50) DEFAULT 'waiting',
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS active_user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS is_live_session BOOLEAN DEFAULT false;

-- Add content storage to existing document_tags table  
ALTER TABLE document_tags
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS content_data JSONB,
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS completed_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

-- Create session participants status tracking
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

-- Create audit trail for live sessions
CREATE TABLE IF NOT EXISTS live_session_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES editor_sessions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_editor_sessions_signing_state ON editor_sessions(signing_state);
CREATE INDEX IF NOT EXISTS idx_session_participants_session_user ON session_participants_status(session_id, user_id);
CREATE INDEX IF NOT EXISTS idx_live_session_events_session ON live_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_completed ON document_tags(is_completed, completed_at);

-- Insert some initial states if needed
INSERT INTO live_session_events (session_id, event_type, event_data) 
SELECT id, 'session_initialized', '{"mode": "tagging"}'::jsonb 
FROM editor_sessions 
WHERE signing_state IS NULL
ON CONFLICT DO NOTHING;

COMMENT ON TABLE session_participants_status IS 'Tracks participant status in live signing sessions';
COMMENT ON TABLE live_session_events IS 'Audit trail for all live session activities';
COMMENT ON COLUMN editor_sessions.signing_state IS 'Current state: waiting, active, paused, completing, completed';
COMMENT ON COLUMN editor_sessions.active_user_id IS 'Currently active user who can interact with tags'; 