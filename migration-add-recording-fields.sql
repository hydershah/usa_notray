-- Migration: Add recording fields to jobs table
-- Date: 2025-01-08
-- Description: Add fields to store screen recording information for live signing sessions

-- Add recording fields to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_file_key TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_file_url TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_file_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_duration INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_started_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_uploaded_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_participant_count INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_session_id TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_live_session_id TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recording_metadata JSONB;

-- Add comments for clarity
COMMENT ON COLUMN jobs.recording_file_key IS 'Vultr storage key for session recording';
COMMENT ON COLUMN jobs.recording_file_url IS 'Vultr URL for session recording';
COMMENT ON COLUMN jobs.recording_file_name IS 'Original filename of recording';
COMMENT ON COLUMN jobs.recording_duration IS 'Recording duration in seconds';
COMMENT ON COLUMN jobs.recording_started_at IS 'When recording started';
COMMENT ON COLUMN jobs.recording_uploaded_at IS 'When recording was uploaded to Vultr';
COMMENT ON COLUMN jobs.recording_participant_count IS 'Number of participants during recording';
COMMENT ON COLUMN jobs.recording_session_id IS 'Editor session ID during recording';
COMMENT ON COLUMN jobs.recording_live_session_id IS 'Live session ID during recording';
COMMENT ON COLUMN jobs.recording_metadata IS 'Additional recording metadata (participants, session details, etc.)';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_recording_file_key ON jobs(recording_file_key);
CREATE INDEX IF NOT EXISTS idx_jobs_recording_started_at ON jobs(recording_started_at);

-- Output success message
DO $$
BEGIN
    RAISE NOTICE 'Recording fields migration completed successfully';
END
$$; 