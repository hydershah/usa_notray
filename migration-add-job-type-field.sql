-- Migration to add jobType field for subscriber vs title company job differentiation
-- Run this against your database to add the new field

-- Add jobType field to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'title_company';

-- Add constraint to ensure valid job types
ALTER TABLE jobs ADD CONSTRAINT check_job_type 
  CHECK (job_type IN ('title_company', 'subscriber_personal'));

-- Update the assignment type constraint to include subscriber_self
ALTER TABLE notary_assignment_log DROP CONSTRAINT IF EXISTS check_assignment_type;
ALTER TABLE notary_assignment_log ADD CONSTRAINT check_assignment_type 
  CHECK (assignment_type IN ('manual', 'random', 'preferred', 'subscriber_self'));

-- Create index for better query performance on job type
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);

-- Create index for subscriber jobs specifically (for fee calculation queries)
CREATE INDEX IF NOT EXISTS idx_jobs_subscriber_personal ON jobs(job_type, user_id) WHERE job_type = 'subscriber_personal';

-- Migration completed - job type field added for workflow differentiation 