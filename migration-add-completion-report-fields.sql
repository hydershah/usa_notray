-- Migration: Add completion report fields to jobs table
-- Date: 2024-12-19
-- Description: Add fields to store completion report path and generation timestamp

-- Check if columns exist and add them if they don't
DO $$ 
BEGIN
    -- Add completion_report_path column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' 
        AND column_name = 'completion_report_path'
    ) THEN
        ALTER TABLE jobs ADD COLUMN completion_report_path TEXT;
    END IF;
    
    -- Add completion_report_generated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' 
        AND column_name = 'completion_report_generated_at'
    ) THEN
        ALTER TABLE jobs ADD COLUMN completion_report_generated_at TIMESTAMP;
    END IF;
END $$;

-- Add index for faster queries on completion report status (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_jobs_completion_report ON jobs(completion_report_path, completion_report_generated_at); 