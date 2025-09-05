-- Migration: Enhance Audit Trail Schema for RON Platform Requirements
-- This migration enhances the audit_trail table to support comprehensive
-- Remote Online Notarization (RON) audit requirements

-- Add new columns to audit_trail table for comprehensive RON audit requirements
ALTER TABLE audit_trail 
ADD COLUMN IF NOT EXISTS user_role TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'unknown_event',
ADD COLUMN IF NOT EXISTS event_details TEXT,
ADD COLUMN IF NOT EXISTS coordinates_page_reference TEXT,
ADD COLUMN IF NOT EXISTS previous_state JSONB,
ADD COLUMN IF NOT EXISTS new_state JSONB,
ADD COLUMN IF NOT EXISTS authentication_method TEXT,
ADD COLUMN IF NOT EXISTS verification_result TEXT,
ADD COLUMN IF NOT EXISTS credential_reference TEXT,
ADD COLUMN IF NOT EXISTS seal_applied JSONB,
ADD COLUMN IF NOT EXISTS notary_certificate_reference TEXT,
ADD COLUMN IF NOT EXISTS digital_signature_hash TEXT,
ADD COLUMN IF NOT EXISTS system_source TEXT DEFAULT 'RON_PLATFORM',
ADD COLUMN IF NOT EXISTS audit_log_integrity_hash TEXT,
ADD COLUMN IF NOT EXISTS retention_metadata JSONB DEFAULT '{"retentionYears": 10, "policy": "WORM"}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add audit trail report fields to jobs table
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS audit_trail_report_path TEXT,
ADD COLUMN IF NOT EXISTS audit_trail_generated_at TIMESTAMP;

-- Update existing audit trail entries to populate new required fields
UPDATE audit_trail 
SET 
  user_role = COALESCE(
    (SELECT role FROM users WHERE users.id = audit_trail.user_id), 
    'unknown'
  ),
  event_type = COALESCE(action, 'legacy_action'),
  system_source = 'RON_PLATFORM',
  retention_metadata = '{"retentionYears": 10, "policy": "WORM"}'::jsonb,
  created_at = COALESCE(timestamp, NOW()),
  updated_at = COALESCE(timestamp, NOW())
WHERE user_role = 'unknown' OR event_type = 'unknown_event';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_trail_session_id ON audit_trail(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_event_type ON audit_trail(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_trail_document_id ON audit_trail(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_role ON audit_trail(user_role);
CREATE INDEX IF NOT EXISTS idx_audit_trail_system_source ON audit_trail(system_source);

-- Create index on jobs table for audit trail report path
CREATE INDEX IF NOT EXISTS idx_jobs_audit_trail_report_path ON jobs(audit_trail_report_path) WHERE audit_trail_report_path IS NOT NULL;

-- Add comments to document the new schema
COMMENT ON TABLE audit_trail IS 'Enhanced audit trail table for comprehensive RON platform audit requirements';
COMMENT ON COLUMN audit_trail.id IS 'Audit ID - Unique identifier for the record entry';
COMMENT ON COLUMN audit_trail.session_id IS 'Session ID - Links all audit entries to a specific RON session';
COMMENT ON COLUMN audit_trail.document_id IS 'Document ID - Links the entry to a specific document being signed';
COMMENT ON COLUMN audit_trail.timestamp IS 'Timestamp (UTC) - Exact time of the event in standardized format';
COMMENT ON COLUMN audit_trail.user_id IS 'Actor/User ID - Who performed the action (notary, signer, witness, system)';
COMMENT ON COLUMN audit_trail.user_role IS 'Role - Role of the actor (Notary, Signer, Witness, System)';
COMMENT ON COLUMN audit_trail.ip_address IS 'IP Address - Source of the action, helps confirm location/device';
COMMENT ON COLUMN audit_trail.device_fingerprint IS 'Device fingerprint for additional security';
COMMENT ON COLUMN audit_trail.event_type IS 'Event Type - Type of event (login, signature, seal applied, video start, etc.)';
COMMENT ON COLUMN audit_trail.event_details IS 'Event Details - Detailed description of the event or action taken';
COMMENT ON COLUMN audit_trail.coordinates_page_reference IS 'Coordinates/Page Reference - Page number and coordinates if action involves a document';
COMMENT ON COLUMN audit_trail.previous_state IS 'Previous vs. New State - If something was changed (moved tag, deleted tag, etc.)';
COMMENT ON COLUMN audit_trail.new_state IS 'New state after the action';
COMMENT ON COLUMN audit_trail.authentication_method IS 'Authentication Method - How the actor was authenticated (KBA, ID, biometric, etc.)';
COMMENT ON COLUMN audit_trail.verification_result IS 'Verification Result - Pass/fail outcome of KBA, credential analysis, or biometric check';
COMMENT ON COLUMN audit_trail.credential_reference IS 'Credential Reference - ID of the ID verification session or token';
COMMENT ON COLUMN audit_trail.seal_applied IS 'Seal Applied - Details of notary seal use (image hash, location, time)';
COMMENT ON COLUMN audit_trail.notary_certificate_reference IS 'Notary Certificate Reference - Digital certificate or PFX used for final signature';
COMMENT ON COLUMN audit_trail.digital_signature_hash IS 'Digital Signature Hash - Cryptographic proof of integrity for the signed document';
COMMENT ON COLUMN audit_trail.system_source IS 'System Source - Which subsystem logged the event (signing module, video server)';
COMMENT ON COLUMN audit_trail.audit_log_integrity_hash IS 'Audit Log Integrity Hash - Cryptographic hash chain linking audit entries together';
COMMENT ON COLUMN audit_trail.retention_metadata IS 'Retention Metadata - WORM storage reference or retention policy tag (e.g., 10 years)';

-- Add comments for jobs table audit trail fields
COMMENT ON COLUMN jobs.audit_trail_report_path IS 'Path to the generated comprehensive audit trail PDF report';
COMMENT ON COLUMN jobs.audit_trail_generated_at IS 'Timestamp when the audit trail report was generated';

-- Create a function to automatically generate integrity hashes
CREATE OR REPLACE FUNCTION generate_audit_integrity_hash()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate a simple integrity hash based on key fields
    NEW.audit_log_integrity_hash := encode(
        digest(
            COALESCE(NEW.session_id::text, '') || '-' ||
            COALESCE(NEW.user_id::text, '') || '-' ||
            COALESCE(NEW.event_type, '') || '-' ||
            COALESCE(extract(epoch from NEW.timestamp)::text, ''),
            'sha256'
        ),
        'hex'
    );
    
    -- Set updated_at timestamp
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate integrity hashes
DROP TRIGGER IF EXISTS audit_trail_integrity_trigger ON audit_trail;
CREATE TRIGGER audit_trail_integrity_trigger
    BEFORE INSERT OR UPDATE ON audit_trail
    FOR EACH ROW
    EXECUTE FUNCTION generate_audit_integrity_hash();

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON audit_trail TO postgres;
GRANT USAGE, SELECT ON SEQUENCE audit_trail_id_seq TO postgres;

-- Create a view for easier audit trail reporting
CREATE OR REPLACE VIEW audit_trail_detailed AS
SELECT 
    at.*,
    u.first_name || ' ' || u.last_name AS user_full_name,
    u.email AS user_email,
    jd.original_name AS document_name,
    es.session_type,
    j.id AS job_id,
    j.title_company,
    j.closing_type
FROM audit_trail at
LEFT JOIN users u ON at.user_id = u.id
LEFT JOIN job_documents jd ON at.document_id = jd.id
LEFT JOIN editor_sessions es ON at.session_id = es.id
LEFT JOIN jobs j ON es.job_id = j.id;

COMMENT ON VIEW audit_trail_detailed IS 'Detailed view of audit trail with user, document, and job information for reporting';

-- Insert a system audit entry to mark the schema enhancement
INSERT INTO audit_trail (
    session_id,
    user_id,
    user_role,
    event_type,
    event_details,
    system_source,
    timestamp
) 
SELECT 
    1, -- Default session ID, will be updated if a real session exists
    1, -- System user ID, will be updated if a system user exists
    'system',
    'schema_enhancement',
    'Enhanced audit trail schema for comprehensive RON platform audit requirements',
    'DATABASE_MIGRATION',
    NOW()
WHERE EXISTS (SELECT 1 FROM editor_sessions LIMIT 1) 
  AND EXISTS (SELECT 1 FROM users WHERE role = 'admin' LIMIT 1);

COMMIT;
