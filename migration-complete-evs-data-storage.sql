-- Migration: Complete EVS Verification Data Storage
-- Date: 2024-01-XX
-- Description: Add comprehensive EVS verification data fields to store all information from EVS API response

BEGIN;

-- Add comprehensive EVS verification fields to users table
ALTER TABLE users 
-- EVS Transaction tracking
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

-- Create table to store verification attempts history
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_evs_transaction_id ON users(evs_transaction_id);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status, is_verified);
CREATE INDEX IF NOT EXISTS idx_users_evs_verified_at ON users(evs_verified_at);
CREATE INDEX IF NOT EXISTS idx_users_verification_confidence ON users(evs_verification_confidence);

CREATE INDEX IF NOT EXISTS idx_user_verification_attempts_user_id ON user_verification_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_verification_attempts_status ON user_verification_attempts(status);
CREATE INDEX IF NOT EXISTS idx_user_verification_attempts_attempted_at ON user_verification_attempts(attempted_at);

-- Add constraints
ALTER TABLE users ADD CONSTRAINT check_evs_verification_confidence 
  CHECK (evs_verification_confidence IS NULL OR (evs_verification_confidence >= 0 AND evs_verification_confidence <= 100));

ALTER TABLE users ADD CONSTRAINT check_evs_face_match_confidence 
  CHECK (evs_face_match_confidence IS NULL OR (evs_face_match_confidence >= 0 AND evs_face_match_confidence <= 100));

ALTER TABLE users ADD CONSTRAINT check_evs_liveness_score 
  CHECK (evs_liveness_score IS NULL OR (evs_liveness_score >= 0 AND evs_liveness_score <= 100));

ALTER TABLE user_verification_attempts ADD CONSTRAINT check_confidence_score 
  CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100));

ALTER TABLE user_verification_attempts ADD CONSTRAINT check_face_match_confidence_attempts 
  CHECK (face_match_confidence IS NULL OR (face_match_confidence >= 0 AND face_match_confidence <= 100));

ALTER TABLE user_verification_attempts ADD CONSTRAINT check_liveness_score_attempts 
  CHECK (liveness_score IS NULL OR (liveness_score >= 0 AND liveness_score <= 100));

-- Function to log verification attempts
CREATE OR REPLACE FUNCTION log_verification_attempt(
  user_id_param INTEGER,
  attempt_data JSONB
) RETURNS VOID AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  -- Get current attempt count for user
  SELECT COUNT(*) + 1 INTO attempt_count 
  FROM user_verification_attempts 
  WHERE user_id = user_id_param;
  
  -- Insert verification attempt
  INSERT INTO user_verification_attempts (
    user_id,
    attempt_number,
    evs_transaction_id,
    status,
    confidence_score,
    document_type,
    front_image_uploaded,
    back_image_uploaded,
    selfie_uploaded,
    extracted_first_name,
    extracted_last_name,
    extracted_date_of_birth,
    extracted_document_number,
    extracted_expiration_date,
    extracted_address,
    face_match_result,
    face_match_confidence,
    liveness_score,
    errors,
    warnings,
    ip_address,
    user_agent,
    processing_time_ms,
    api_environment
  ) VALUES (
    user_id_param,
    attempt_count,
    attempt_data->>'evs_transaction_id',
    attempt_data->>'status',
    (attempt_data->>'confidence_score')::INTEGER,
    attempt_data->>'document_type',
    (attempt_data->>'front_image_uploaded')::BOOLEAN,
    (attempt_data->>'back_image_uploaded')::BOOLEAN,
    (attempt_data->>'selfie_uploaded')::BOOLEAN,
    attempt_data->>'extracted_first_name',
    attempt_data->>'extracted_last_name',
    attempt_data->>'extracted_date_of_birth',
    attempt_data->>'extracted_document_number',
    attempt_data->>'extracted_expiration_date',
    attempt_data->>'extracted_address',
    (attempt_data->>'face_match_result')::BOOLEAN,
    (attempt_data->>'face_match_confidence')::INTEGER,
    (attempt_data->>'liveness_score')::INTEGER,
    CASE 
      WHEN attempt_data->'errors' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(attempt_data->'errors'))
      ELSE NULL 
    END,
    CASE 
      WHEN attempt_data->'warnings' IS NOT NULL 
      THEN ARRAY(SELECT jsonb_array_elements_text(attempt_data->'warnings'))
      ELSE NULL 
    END,
    attempt_data->>'ip_address',
    attempt_data->>'user_agent',
    (attempt_data->>'processing_time_ms')::INTEGER,
    attempt_data->>'api_environment'
  );
  
  -- Update user's retry count
  UPDATE users 
  SET verification_retry_count = attempt_count
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- Sample query to view verification data for admins:
-- SELECT 
--   u.id,
--   u.username,
--   u.email,
--   u.role,
--   u.verification_status,
--   u.is_verified,
--   u.evs_verification_confidence,
--   u.evs_extracted_first_name,
--   u.evs_extracted_last_name,
--   u.evs_extracted_date_of_birth,
--   u.evs_face_match_result,
--   u.evs_face_match_confidence,
--   u.evs_liveness_score,
--   u.evs_verified_at,
--   u.verification_retry_count
-- FROM users u 
-- WHERE u.role IN ('signer', 'witness')
-- ORDER BY u.evs_verified_at DESC NULLS LAST; 