-- COMPREHENSIVE JOB INTEGRITY FIX
-- Addresses all identified issues with jobs, notaries, participants, and documents

BEGIN;

-- =============================================================================
-- 1. DATA INTEGRITY FIXES
-- =============================================================================

-- Fix Job 12 and other jobs marked as "completed" without proper data
UPDATE jobs 
SET 
  job_status = 'pending',
  completed_at = NULL,
  completed_by = NULL
WHERE 
  job_status = 'completed' 
  AND (notary_id IS NULL OR id NOT IN (
    SELECT DISTINCT job_id FROM signers WHERE job_id IS NOT NULL
  ) OR id NOT IN (
    SELECT DISTINCT job_id FROM job_documents WHERE job_id IS NOT NULL
  ));

-- Fix jobs with inconsistent notary data
UPDATE jobs 
SET 
  selected_notary = notary_id::text
WHERE 
  notary_id IS NOT NULL 
  AND (selected_notary IS NULL OR selected_notary != notary_id::text);

-- Fix orphaned jobs with selected_notary but no notary_id
UPDATE jobs 
SET 
  notary_id = CASE 
    WHEN selected_notary ~ '^[0-9]+$' THEN selected_notary::integer 
    ELSE NULL 
  END
WHERE 
  selected_notary IS NOT NULL 
  AND notary_id IS NULL;

-- =============================================================================
-- 2. AUTO-ASSIGNMENT FIXES
-- =============================================================================

-- Update jobs with notary_option = 'auto' but no notary assigned
-- Set them to open status for manual intervention
UPDATE jobs 
SET 
  job_status = 'open'
WHERE 
  notary_option = 'auto' 
  AND notary_id IS NULL 
  AND job_status != 'cancelled';

-- =============================================================================
-- 3. ADD COMPREHENSIVE CONSTRAINTS
-- =============================================================================

-- Add constraint to prevent completing jobs without notary
ALTER TABLE jobs 
ADD CONSTRAINT check_completed_has_notary 
CHECK (
  job_status != 'completed' OR 
  (job_status = 'completed' AND notary_id IS NOT NULL)
);

-- Add constraint to ensure notary consistency
ALTER TABLE jobs 
ADD CONSTRAINT check_notary_consistency 
CHECK (
  (notary_id IS NULL AND (selected_notary IS NULL OR selected_notary = '')) OR
  (notary_id IS NOT NULL AND selected_notary = notary_id::text)
);

-- Add constraint for job status transitions
ALTER TABLE jobs 
ADD CONSTRAINT check_job_status_values 
CHECK (
  job_status IN ('open', 'pending', 'in_progress', 'completed', 'cancelled', 'expired')
);

-- =============================================================================
-- 4. PARTICIPANT VALIDATION FUNCTIONS
-- =============================================================================

-- Function to check if job has participants
CREATE OR REPLACE FUNCTION job_has_participants(target_job_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM signers WHERE job_id = target_job_id
    UNION
    SELECT 1 FROM job_participants WHERE job_id = target_job_id AND role IN ('signer', 'witness')
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if job has documents
CREATE OR REPLACE FUNCTION job_has_documents(target_job_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM job_documents WHERE job_id = target_job_id
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 5. JOB COMPLETION VALIDATION TRIGGER
-- =============================================================================

-- Function to validate job completion
CREATE OR REPLACE FUNCTION validate_job_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- If job is being marked as completed, ensure it has required data
  IF NEW.job_status = 'completed' AND OLD.job_status != 'completed' THEN
    
    -- Check for notary
    IF NEW.notary_id IS NULL THEN
      RAISE EXCEPTION 'Cannot complete job without assigned notary. Job ID: %', NEW.id;
    END IF;
    
    -- Check for participants
    IF NOT job_has_participants(NEW.id) THEN
      RAISE EXCEPTION 'Cannot complete job without participants. Job ID: %', NEW.id;
    END IF;
    
    -- Check for documents
    IF NOT job_has_documents(NEW.id) THEN
      RAISE EXCEPTION 'Cannot complete job without documents. Job ID: %', NEW.id;
    END IF;
    
    -- Set completion timestamp and user
    NEW.completed_at = COALESCE(NEW.completed_at, NOW());
    
  END IF;
  
  -- Ensure notary consistency
  IF NEW.notary_id IS NOT NULL AND NEW.selected_notary != NEW.notary_id::text THEN
    NEW.selected_notary = NEW.notary_id::text;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for job completion validation
DROP TRIGGER IF EXISTS trigger_validate_job_completion ON jobs;
CREATE TRIGGER trigger_validate_job_completion
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION validate_job_completion();

-- =============================================================================
-- 6. AUTO-ASSIGNMENT IMPROVEMENT FUNCTION
-- =============================================================================

-- Function to auto-assign notary to jobs that need it
CREATE OR REPLACE FUNCTION auto_assign_notary_to_job(job_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  job_record RECORD;
  available_notary_id INTEGER;
  preferred_notary_user_id INTEGER;
BEGIN
  -- Get job details
  SELECT * INTO job_record FROM jobs WHERE id = job_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Skip if job already has notary
  IF job_record.notary_id IS NOT NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Try to find preferred notary first
  SELECT tc.preferred_notary_id INTO preferred_notary_user_id
  FROM title_companies tc
  WHERE tc.company_name = job_record.title_company
  AND tc.preferred_notary_id IS NOT NULL;
  
  -- Check if preferred notary is available
  IF preferred_notary_user_id IS NOT NULL THEN
    SELECT id INTO available_notary_id 
    FROM users 
    WHERE id = preferred_notary_user_id 
    AND role = 'notary' 
    AND is_active = true;
    
    IF available_notary_id IS NOT NULL THEN
      -- Assign preferred notary
      UPDATE jobs SET 
        notary_id = available_notary_id,
        selected_notary = available_notary_id::text,
        job_status = 'pending'
      WHERE id = job_id;
      
      -- Log the assignment
      INSERT INTO notary_assignment_log (job_id, notary_id, assignment_type, assignment_status)
      VALUES (job_id, available_notary_id, 'preferred', 'assigned');
      
      RETURN TRUE;
    END IF;
  END IF;
  
  -- Fallback to any available notary
  SELECT id INTO available_notary_id 
  FROM users 
  WHERE role = 'notary' 
  AND notary_type = 'contractor'
  AND is_active = true
  AND id NOT IN (
    SELECT UNNEST(job_record.rejected_notaries::integer[])
  )
  ORDER BY RANDOM()
  LIMIT 1;
  
  IF available_notary_id IS NOT NULL THEN
    -- Assign random notary
    UPDATE jobs SET 
      notary_id = available_notary_id,
      selected_notary = available_notary_id::text,
      job_status = 'pending',
      is_random_assignment = true
    WHERE id = job_id;
    
    -- Log the assignment
    INSERT INTO notary_assignment_log (job_id, notary_id, assignment_type, assignment_status)
    VALUES (job_id, available_notary_id, 'random', 'assigned');
    
    RETURN TRUE;
  END IF;
  
  -- No notary found
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. BATCH FIX EXISTING JOBS
-- =============================================================================

-- Fix all jobs with notary_option = 'auto' but no notary
DO $$
DECLARE
  job_record RECORD;
  success_count INTEGER := 0;
  total_count INTEGER := 0;
BEGIN
  -- Process all jobs that need auto-assignment
  FOR job_record IN 
    SELECT id FROM jobs 
    WHERE notary_option = 'auto' 
    AND notary_id IS NULL 
    AND job_status IN ('open', 'pending')
  LOOP
    total_count := total_count + 1;
    
    IF auto_assign_notary_to_job(job_record.id) THEN
      success_count := success_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Auto-assignment completed: % out of % jobs assigned', success_count, total_count;
END;
$$;

-- =============================================================================
-- 8. MONITORING AND ALERTING
-- =============================================================================

-- Create view for problematic jobs
CREATE OR REPLACE VIEW problematic_jobs AS
SELECT 
  j.id,
  j.title_company,
  j.job_status,
  j.notary_option,
  j.notary_id,
  j.selected_notary,
  j.created_at,
  CASE 
    WHEN j.notary_id IS NULL THEN 'NO_NOTARY'
    WHEN NOT job_has_participants(j.id) THEN 'NO_PARTICIPANTS'
    WHEN NOT job_has_documents(j.id) THEN 'NO_DOCUMENTS'
    WHEN j.job_status = 'completed' AND j.completed_at IS NULL THEN 'INVALID_COMPLETION'
    WHEN j.notary_id IS NOT NULL AND j.selected_notary != j.notary_id::text THEN 'NOTARY_INCONSISTENCY'
    ELSE 'HEALTHY'
  END as issue_type,
  (SELECT COUNT(*) FROM signers s WHERE s.job_id = j.id) as signer_count,
  (SELECT COUNT(*) FROM job_participants jp WHERE jp.job_id = j.id AND jp.role IN ('signer', 'witness')) as participant_count,
  (SELECT COUNT(*) FROM job_documents jd WHERE jd.job_id = j.id) as document_count
FROM jobs j
WHERE j.job_status != 'cancelled'
ORDER BY j.created_at DESC;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_status_notary ON jobs(job_status, notary_id);
CREATE INDEX IF NOT EXISTS idx_jobs_notary_option_status ON jobs(notary_option, job_status);
CREATE INDEX IF NOT EXISTS idx_signers_job_id ON signers(job_id);
CREATE INDEX IF NOT EXISTS idx_job_participants_job_role ON job_participants(job_id, role);
CREATE INDEX IF NOT EXISTS idx_job_documents_job_id ON job_documents(job_id);

-- =============================================================================
-- 9. SUMMARY REPORT
-- =============================================================================

-- Generate fix summary
DO $$
DECLARE
  total_jobs INTEGER;
  healthy_jobs INTEGER;
  problematic_jobs INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_jobs FROM jobs WHERE job_status != 'cancelled';
  SELECT COUNT(*) INTO healthy_jobs FROM problematic_jobs WHERE issue_type = 'HEALTHY';
  SELECT COUNT(*) INTO problematic_jobs FROM problematic_jobs WHERE issue_type != 'HEALTHY';
  
  RAISE NOTICE '=== JOB INTEGRITY FIX SUMMARY ===';
  RAISE NOTICE 'Total Jobs: %', total_jobs;
  RAISE NOTICE 'Healthy Jobs: %', healthy_jobs;
  RAISE NOTICE 'Problematic Jobs: %', problematic_jobs;
  
  IF total_jobs > 0 THEN
    RAISE NOTICE 'Success Rate: %%%', ROUND((healthy_jobs::DECIMAL / total_jobs::DECIMAL) * 100, 2);
  ELSE
    RAISE NOTICE 'Success Rate: N/A (no jobs found)';
  END IF;
END;
$$;

COMMIT;

-- Show final status
SELECT 
  issue_type,
  COUNT(*) as count
FROM problematic_jobs 
GROUP BY issue_type
ORDER BY count DESC; 