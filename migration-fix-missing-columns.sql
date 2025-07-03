-- Migration: Fix Missing Columns for Supabase Database
-- Date: 2024-01-XX
-- Description: Add missing columns that are referenced in the application but not in the schema

BEGIN;

-- Add missing verification columns to users table
ALTER TABLE users 
-- Basic verification status columns
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'denied', 'review'

-- EVS Transaction tracking (these should already exist from the EVS migration)
ADD COLUMN IF NOT EXISTS evs_transaction_id TEXT,
ADD COLUMN IF NOT EXISTS evs_verification_confidence INTEGER, -- Confidence score from EVS (0-100)
ADD COLUMN IF NOT EXISTS evs_verified_at TIMESTAMP,

-- Extracted document data from EVS
ADD COLUMN IF NOT EXISTS evs_extracted_first_name TEXT,
ADD COLUMN IF NOT EXISTS evs_extracted_last_name TEXT,
ADD COLUMN IF NOT EXISTS evs_extracted_full_name TEXT,
ADD COLUMN IF NOT EXISTS evs_extracted_date_of_birth TEXT,
ADD COLUMN IF NOT EXISTS evs_extracted_address TEXT,

-- Biometric verification data from EVS
ADD COLUMN IF NOT EXISTS evs_face_match_result BOOLEAN,
ADD COLUMN IF NOT EXISTS evs_face_match_confidence INTEGER, -- Face matching confidence (0-100)
ADD COLUMN IF NOT EXISTS evs_liveness_score INTEGER, -- Liveness detection score (0-100)

-- EVS verification status and metadata
ADD COLUMN IF NOT EXISTS evs_verification_errors TEXT[], -- Array of error messages
ADD COLUMN IF NOT EXISTS evs_verification_warnings TEXT[], -- Array of warning messages
ADD COLUMN IF NOT EXISTS evs_document_type_detected TEXT, -- Document type detected by EVS
ADD COLUMN IF NOT EXISTS evs_verification_method TEXT DEFAULT 'api', -- 'api', 'manual', 'fallback'

-- Additional metadata
ADD COLUMN IF NOT EXISTS verification_ip_address TEXT, -- IP address during verification
ADD COLUMN IF NOT EXISTS verification_user_agent TEXT, -- Browser/device info during verification
ADD COLUMN IF NOT EXISTS verification_retry_count INTEGER DEFAULT 0; -- Number of verification attempts

-- Create user_verification_attempts table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_verification_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  
  -- EVS API response data
  evs_transaction_id TEXT,
  status TEXT NOT NULL, -- 'approved', 'denied', 'review', 'error'
  confidence_score INTEGER,
  
  -- Document information
  document_type TEXT,
  front_image_uploaded BOOLEAN DEFAULT FALSE,
  back_image_uploaded BOOLEAN DEFAULT FALSE,
  selfie_uploaded BOOLEAN DEFAULT FALSE,
  
  -- Extracted data from this attempt
  extracted_first_name TEXT,
  extracted_last_name TEXT,
  extracted_date_of_birth TEXT,
  extracted_document_number TEXT,
  extracted_expiration_date TEXT,
  extracted_address TEXT,
  
  -- Biometric results
  face_match_result BOOLEAN,
  face_match_confidence INTEGER,
  liveness_score INTEGER,
  
  -- Verification details
  errors TEXT[],
  warnings TEXT[],
  ip_address TEXT,
  user_agent TEXT,
  
  -- Metadata
  attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processing_time_ms INTEGER, -- How long verification took
  api_environment TEXT DEFAULT 'sandbox', -- 'sandbox' or 'production'
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Update existing users to set is_verified based on EVS verification data
UPDATE users 
SET is_verified = CASE 
  WHEN evs_verification_confidence >= 80 AND evs_face_match_result = TRUE THEN TRUE
  WHEN evs_verified_at IS NOT NULL AND evs_verification_confidence >= 70 THEN TRUE
  ELSE FALSE
END
WHERE evs_transaction_id IS NOT NULL;

-- Set verification_status based on EVS data
UPDATE users 
SET verification_status = CASE 
  WHEN evs_verification_confidence >= 80 AND evs_face_match_result = TRUE THEN 'approved'
  WHEN evs_verification_confidence >= 70 THEN 'approved'
  WHEN evs_verification_confidence >= 50 THEN 'review'
  WHEN evs_transaction_id IS NOT NULL THEN 'denied'
  ELSE 'pending'
END
WHERE evs_transaction_id IS NOT NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_evs_transaction_id ON users(evs_transaction_id);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);
CREATE INDEX IF NOT EXISTS idx_users_evs_verified_at ON users(evs_verified_at);
CREATE INDEX IF NOT EXISTS idx_users_verification_confidence ON users(evs_verification_confidence);

CREATE INDEX IF NOT EXISTS idx_user_verification_attempts_user_id ON user_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_verification_attempts_status ON user_verification_attempts(status);
CREATE INDEX IF NOT EXISTS idx_user_verification_attempts_attempted_at ON user_verification_attempts(attempted_at);

-- Add constraints (drop and recreate to avoid conflicts)
DO $$ 
BEGIN
  -- Drop constraints if they exist
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_evs_verification_confidence') THEN
    ALTER TABLE users DROP CONSTRAINT check_evs_verification_confidence;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_evs_face_match_confidence') THEN
    ALTER TABLE users DROP CONSTRAINT check_evs_face_match_confidence;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_evs_liveness_score') THEN
    ALTER TABLE users DROP CONSTRAINT check_evs_liveness_score;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_verification_status') THEN
    ALTER TABLE users DROP CONSTRAINT check_verification_status;
  END IF;
END $$;

-- Add constraints
ALTER TABLE users ADD CONSTRAINT check_evs_verification_confidence 
  CHECK (evs_verification_confidence IS NULL OR (evs_verification_confidence >= 0 AND evs_verification_confidence <= 100));

ALTER TABLE users ADD CONSTRAINT check_evs_face_match_confidence 
  CHECK (evs_face_match_confidence IS NULL OR (evs_face_match_confidence >= 0 AND evs_face_match_confidence <= 100));

ALTER TABLE users ADD CONSTRAINT check_evs_liveness_score 
  CHECK (evs_liveness_score IS NULL OR (evs_liveness_score >= 0 AND evs_liveness_score <= 100));

-- Add constraints for verification status
ALTER TABLE users ADD CONSTRAINT check_verification_status 
  CHECK (verification_status IN ('pending', 'approved', 'denied', 'review'));

-- Function to automatically update is_verified when EVS data changes
CREATE OR REPLACE FUNCTION update_verification_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update is_verified based on EVS verification results
  IF NEW.evs_verification_confidence IS NOT NULL THEN
    NEW.is_verified = CASE 
      WHEN NEW.evs_verification_confidence >= 80 AND NEW.evs_face_match_result = TRUE THEN TRUE
      WHEN NEW.evs_verification_confidence >= 70 THEN TRUE
      ELSE FALSE
    END;
    
    NEW.verification_status = CASE 
      WHEN NEW.evs_verification_confidence >= 80 AND NEW.evs_face_match_result = TRUE THEN 'approved'
      WHEN NEW.evs_verification_confidence >= 70 THEN 'approved'
      WHEN NEW.evs_verification_confidence >= 50 THEN 'review'
      ELSE 'denied'
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update verification status
DROP TRIGGER IF EXISTS trigger_update_verification_status ON users;
CREATE TRIGGER trigger_update_verification_status
  BEFORE UPDATE ON users
  FOR EACH ROW
  WHEN (OLD.evs_verification_confidence IS DISTINCT FROM NEW.evs_verification_confidence 
        OR OLD.evs_face_match_result IS DISTINCT FROM NEW.evs_face_match_result)
  EXECUTE FUNCTION update_verification_status();

-- Function to get verification statistics (used by admin dashboard)
CREATE OR REPLACE FUNCTION get_verification_stats()
RETURNS TABLE (
  total_users BIGINT,
  verified_users BIGINT,
  pending_verification BIGINT,
  avg_confidence_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_verified = true) as verified_users,
    COUNT(*) FILTER (WHERE verification_status = 'pending') as pending_verification,
    AVG(evs_verification_confidence) FILTER (WHERE is_verified = true) as avg_confidence_score
  FROM users 
  WHERE role IN ('signer', 'witness', 'notary');
END;
$$ LANGUAGE plpgsql;

COMMIT; 