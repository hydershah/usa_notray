-- Migration: Add Job Requests System
-- Description: Creates job requests table and updates jobs table for signer-initiated requests

-- Add new fields to jobs table for signer requests
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_signer_request BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS signer_request_notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS admin_review_notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS admin_reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS request_priority TEXT DEFAULT 'normal';

-- Create job_requests table
CREATE TABLE IF NOT EXISTS job_requests (
  id SERIAL PRIMARY KEY,
  
  -- Request details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  document_type TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal',
  preferred_date TEXT,
  preferred_time TEXT,
  location TEXT,
  
  -- Requestor information
  requestor_id INTEGER NOT NULL REFERENCES users(id),
  requestor_email TEXT NOT NULL,
  requestor_phone TEXT,
  
  -- Status and workflow
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT DEFAULT 'normal',
  
  -- Admin review
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  -- Assignment
  assigned_notary_id INTEGER REFERENCES users(id),
  assigned_at TIMESTAMP,
  assignment_notes TEXT,
  
  -- Conversion to job
  converted_to_job_id INTEGER REFERENCES jobs(id),
  converted_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Additional metadata
  metadata JSONB
);

-- Add constraints
ALTER TABLE jobs ADD CONSTRAINT check_request_priority 
  CHECK (request_priority IN ('low', 'normal', 'high', 'urgent'));

ALTER TABLE job_requests ADD CONSTRAINT check_urgency 
  CHECK (urgency IN ('low', 'normal', 'high', 'urgent'));

ALTER TABLE job_requests ADD CONSTRAINT check_status 
  CHECK (status IN ('pending', 'approved', 'rejected', 'assigned', 'completed', 'cancelled'));

ALTER TABLE job_requests ADD CONSTRAINT check_priority 
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);
CREATE INDEX IF NOT EXISTS idx_job_requests_requestor ON job_requests(requestor_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_priority ON job_requests(priority);
CREATE INDEX IF NOT EXISTS idx_job_requests_created_at ON job_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_job_requests_assigned_notary ON job_requests(assigned_notary_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_reviewed_by ON job_requests(reviewed_by);

-- Add indexes for jobs table new fields
CREATE INDEX IF NOT EXISTS idx_jobs_signer_request ON jobs(is_signer_request);
CREATE INDEX IF NOT EXISTS idx_jobs_request_priority ON jobs(request_priority);
CREATE INDEX IF NOT EXISTS idx_jobs_admin_reviewed_by ON jobs(admin_reviewed_by);

-- Update job_status constraint to include new statuses
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS check_job_status_values;
ALTER TABLE jobs ADD CONSTRAINT check_job_status_values 
  CHECK (job_status IN ('open', 'pending', 'completed', 'cancelled', 'expired', 'request_pending', 'request_approved', 'request_rejected'));

-- Migration completed - job requests system added 