-- Fix EVS Confidence Constraint to Allow Values Above 100%
-- EVS Solutions can return confidence scores above 100% (e.g., 110%)
-- This updates the constraint to allow values from 0-200% to accommodate higher confidence scores

-- Drop existing constraints if they exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_evs_verification_confidence') THEN
    ALTER TABLE users DROP CONSTRAINT check_evs_verification_confidence;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_evs_face_match_confidence') THEN
    ALTER TABLE users DROP CONSTRAINT check_evs_face_match_confidence;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_evs_liveness_score') THEN
    ALTER TABLE users DROP CONSTRAINT check_evs_liveness_score;
  END IF;
END $$;

-- Add updated constraints
-- EVS verification confidence allows up to 200% for high-confidence matches
ALTER TABLE users ADD CONSTRAINT check_evs_verification_confidence 
  CHECK (evs_verification_confidence IS NULL OR (evs_verification_confidence >= 0 AND evs_verification_confidence <= 200));

-- Face match confidence stays 0-100%
ALTER TABLE users ADD CONSTRAINT check_evs_face_match_confidence 
  CHECK (evs_face_match_confidence IS NULL OR (evs_face_match_confidence >= 0 AND evs_face_match_confidence <= 100));

-- Liveness score stays 0-100%
ALTER TABLE users ADD CONSTRAINT check_evs_liveness_score 
  CHECK (evs_liveness_score IS NULL OR (evs_liveness_score >= 0 AND evs_liveness_score <= 100)); 