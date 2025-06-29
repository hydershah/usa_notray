-- Migration to add random notary assignment system fields
-- Run this against your database to add the new fields

-- Add notary qualification fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_notary_signing_agent BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_spanish_speaking BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_concurrent_jobs INTEGER DEFAULT 1;

-- Add preferred notary field to title_companies table
ALTER TABLE title_companies ADD COLUMN IF NOT EXISTS preferred_notary_id INTEGER REFERENCES users(id);

-- Add random assignment fields to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_nsa BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_spanish_speaking BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assignment_attempts INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rejected_notaries TEXT[] DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_random_assignment BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notary_id INTEGER REFERENCES users(id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_notary_qualifications ON users(role, notary_type, is_notary_signing_agent, is_spanish_speaking, is_active);
CREATE INDEX IF NOT EXISTS idx_title_companies_preferred_notary ON title_companies(preferred_notary_id);
CREATE INDEX IF NOT EXISTS idx_jobs_notary_assignment ON jobs(notary_id, is_random_assignment, job_status);
CREATE INDEX IF NOT EXISTS idx_jobs_requirements ON jobs(requires_nsa, requires_spanish_speaking);

-- Add constraints
ALTER TABLE jobs ADD CONSTRAINT check_assignment_attempts 
  CHECK (assignment_attempts >= 0);

-- Create a table to track notary assignment history for analytics
CREATE TABLE IF NOT EXISTS notary_assignment_log (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) NOT NULL,
  notary_id INTEGER REFERENCES users(id) NOT NULL,
  assignment_type TEXT NOT NULL, -- 'manual', 'random', 'preferred'
  assignment_status TEXT NOT NULL, -- 'assigned', 'accepted', 'rejected', 'completed'
  assigned_at TIMESTAMP DEFAULT NOW() NOT NULL,
  responded_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notary_assignment_log_job ON notary_assignment_log(job_id);
CREATE INDEX IF NOT EXISTS idx_notary_assignment_log_notary ON notary_assignment_log(notary_id);
CREATE INDEX IF NOT EXISTS idx_notary_assignment_log_status ON notary_assignment_log(assignment_status);

-- Add constraint for assignment status
ALTER TABLE notary_assignment_log ADD CONSTRAINT check_assignment_status 
  CHECK (assignment_status IN ('assigned', 'accepted', 'rejected', 'completed'));

ALTER TABLE notary_assignment_log ADD CONSTRAINT check_assignment_type 
  CHECK (assignment_type IN ('manual', 'random', 'preferred'));

-- Migration completed - random notary assignment system ready 