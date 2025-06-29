-- Migration to add notary approval workflow system
-- Run this against your database to add approval workflow fields

-- Add notary approval fields to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notary_approval_status TEXT DEFAULT 'pending_assignment'; 
-- 'pending_assignment', 'assigned_pending_approval', 'approved', 'rejected', 'approved_with_conditions'

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notary_approved_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notary_approval_notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notary_approval_conditions TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS signer_notifications_sent BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS signer_notifications_sent_at TIMESTAMP;

-- Create notifications table for enhanced notification system
CREATE TABLE IF NOT EXISTS job_notifications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) NOT NULL,
  recipient_id INTEGER REFERENCES users(id) NOT NULL,
  recipient_email TEXT NOT NULL,
  notification_type TEXT NOT NULL, -- 'job_assignment', 'approval_request', 'approval_granted', 'signer_invite', 'job_reminder', 'job_completed'
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'sent', 'failed', 'opened', 'clicked'
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB, -- Additional notification data
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create approval queue table for better tracking
CREATE TABLE IF NOT EXISTS notary_approval_queue (
  id SERIAL PRIMARY KEY,
  job_id INTEGER REFERENCES jobs(id) NOT NULL,
  notary_id INTEGER REFERENCES users(id) NOT NULL,
  title_company TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' NOT NULL, -- 'low', 'normal', 'high', 'urgent'
  deadline TIMESTAMP,
  special_instructions TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(job_id, notary_id)
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_approval_status ON jobs(notary_approval_status);
CREATE INDEX IF NOT EXISTS idx_jobs_notary_approval ON jobs(notary_id, notary_approval_status);
CREATE INDEX IF NOT EXISTS idx_job_notifications_recipient ON job_notifications(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_job_notifications_job ON job_notifications(job_id, notification_type);
CREATE INDEX IF NOT EXISTS idx_job_notifications_status ON job_notifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notary_approval_queue_notary ON notary_approval_queue(notary_id);
CREATE INDEX IF NOT EXISTS idx_notary_approval_queue_deadline ON notary_approval_queue(deadline);

-- Add constraints
ALTER TABLE jobs ADD CONSTRAINT check_notary_approval_status 
  CHECK (notary_approval_status IN ('pending_assignment', 'assigned_pending_approval', 'approved', 'rejected', 'approved_with_conditions'));

ALTER TABLE job_notifications ADD CONSTRAINT check_notification_status 
  CHECK (status IN ('pending', 'sent', 'failed', 'opened', 'clicked'));

ALTER TABLE job_notifications ADD CONSTRAINT check_notification_type 
  CHECK (notification_type IN ('job_assignment', 'approval_request', 'approval_granted', 'signer_invite', 'job_reminder', 'job_completed', 'job_cancelled'));

ALTER TABLE notary_approval_queue ADD CONSTRAINT check_priority 
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Update existing jobs to have proper approval status
UPDATE jobs SET notary_approval_status = 'pending_assignment' 
WHERE notary_approval_status IS NULL AND notary_id IS NULL;

UPDATE jobs SET notary_approval_status = 'assigned_pending_approval' 
WHERE notary_approval_status IS NULL AND notary_id IS NOT NULL AND job_status = 'pending';

UPDATE jobs SET notary_approval_status = 'approved' 
WHERE notary_approval_status IS NULL AND notary_id IS NOT NULL AND job_status IN ('in_progress', 'completed');

-- Create function to automatically update notary approval queue when jobs are assigned
CREATE OR REPLACE FUNCTION update_notary_approval_queue()
RETURNS TRIGGER AS $$
BEGIN
  -- If notary is assigned and approval status is pending approval, add to queue
  IF NEW.notary_id IS NOT NULL AND NEW.notary_approval_status = 'assigned_pending_approval' AND
     (OLD.notary_id IS NULL OR OLD.notary_approval_status != 'assigned_pending_approval') THEN
    
    INSERT INTO notary_approval_queue (job_id, notary_id, title_company, deadline)
    VALUES (NEW.id, NEW.notary_id, NEW.title_company, NEW.scheduled_at)
    ON CONFLICT (job_id, notary_id) DO UPDATE SET
      title_company = EXCLUDED.title_company,
      deadline = EXCLUDED.deadline,
      updated_at = NOW();
  END IF;
  
  -- Remove from queue if approved or rejected
  IF NEW.notary_approval_status IN ('approved', 'rejected', 'approved_with_conditions') AND
     OLD.notary_approval_status = 'assigned_pending_approval' THEN
    
    DELETE FROM notary_approval_queue 
    WHERE job_id = NEW.id AND notary_id = NEW.notary_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic approval queue management
DROP TRIGGER IF EXISTS trigger_update_notary_approval_queue ON jobs;
CREATE TRIGGER trigger_update_notary_approval_queue
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_notary_approval_queue();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_notification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
DROP TRIGGER IF EXISTS trigger_update_job_notification_timestamp ON job_notifications;
CREATE TRIGGER trigger_update_job_notification_timestamp
  BEFORE UPDATE ON job_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

DROP TRIGGER IF EXISTS trigger_update_approval_queue_timestamp ON notary_approval_queue;
CREATE TRIGGER trigger_update_approval_queue_timestamp
  BEFORE UPDATE ON notary_approval_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_timestamp();

-- Migration completed - notary approval workflow system ready 