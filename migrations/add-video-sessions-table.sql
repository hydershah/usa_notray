-- Add video sessions table for Daily.co integration
-- Supports up to 8 participants per notary session

CREATE TABLE IF NOT EXISTS video_sessions (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  room_name VARCHAR(255) NOT NULL UNIQUE,
  room_url VARCHAR(500) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'recording', 'completed', 'cancelled')),
  max_participants INTEGER DEFAULT 8 NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ended_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  recording_started_at TIMESTAMP WITH TIME ZONE,
  recording_stopped_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB, -- Additional session metadata from Daily.co
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create table for video session participants
CREATE TABLE IF NOT EXISTS video_session_participants (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES video_sessions(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL, -- Can be external user ID
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('notary', 'signer', 'witness', 'client')),
  token TEXT NOT NULL, -- Daily.co meeting token for this participant
  join_order INTEGER, -- Order in which participant was added
  joined_at TIMESTAMP WITH TIME ZONE,
  left_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  metadata JSONB, -- Additional participant metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_sessions_job_id ON video_sessions(job_id);
CREATE INDEX IF NOT EXISTS idx_video_sessions_room_name ON video_sessions(room_name);
CREATE INDEX IF NOT EXISTS idx_video_sessions_status ON video_sessions(status);
CREATE INDEX IF NOT EXISTS idx_video_sessions_created_by ON video_sessions(created_by);

CREATE INDEX IF NOT EXISTS idx_video_session_participants_session_id ON video_session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_video_session_participants_user_id ON video_session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_video_session_participants_role ON video_session_participants(role);

-- Update triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_video_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_sessions_updated_at_trigger
  BEFORE UPDATE ON video_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_video_sessions_updated_at();

CREATE OR REPLACE FUNCTION update_video_session_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER video_session_participants_updated_at_trigger
  BEFORE UPDATE ON video_session_participants
  FOR EACH ROW
  EXECUTE FUNCTION update_video_session_participants_updated_at();

-- Add constraints to ensure data integrity
ALTER TABLE video_sessions 
ADD CONSTRAINT video_sessions_max_participants_check 
CHECK (max_participants > 0 AND max_participants <= 100);

-- Ensure one active session per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_sessions_one_active_per_job 
ON video_sessions(job_id) 
WHERE status IN ('active', 'recording');