-- Migration: Add signer_documents table
-- This table stores documents uploaded by signers/participants

CREATE TABLE IF NOT EXISTS signer_documents (
    id SERIAL PRIMARY KEY,
    participant_id INTEGER NOT NULL,
    job_id INTEGER,
    session_id VARCHAR(255),
    document_name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    document_type VARCHAR(50) DEFAULT 'additional',
    uploaded_by INTEGER NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'uploaded',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_signer_documents_participant_id ON signer_documents(participant_id);
CREATE INDEX IF NOT EXISTS idx_signer_documents_job_id ON signer_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_signer_documents_session_id ON signer_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_signer_documents_uploaded_by ON signer_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_signer_documents_status ON signer_documents(status);
CREATE INDEX IF NOT EXISTS idx_signer_documents_uploaded_at ON signer_documents(uploaded_at);

-- Add foreign key constraints
ALTER TABLE signer_documents 
ADD CONSTRAINT fk_signer_documents_participant_id 
FOREIGN KEY (participant_id) REFERENCES session_participants(id) ON DELETE CASCADE;

ALTER TABLE signer_documents 
ADD CONSTRAINT fk_signer_documents_job_id 
FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

ALTER TABLE signer_documents 
ADD CONSTRAINT fk_signer_documents_uploaded_by 
FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE;

-- Add comments for documentation
COMMENT ON TABLE signer_documents IS 'Stores documents uploaded by signers/participants during notarization sessions';
COMMENT ON COLUMN signer_documents.participant_id IS 'Reference to the session participant who uploaded the document';
COMMENT ON COLUMN signer_documents.job_id IS 'Reference to the job this document belongs to (optional)';
COMMENT ON COLUMN signer_documents.session_id IS 'Reference to the session this document belongs to (optional)';
COMMENT ON COLUMN signer_documents.document_name IS 'User-friendly name for the document';
COMMENT ON COLUMN signer_documents.original_filename IS 'Original filename as uploaded by user';
COMMENT ON COLUMN signer_documents.file_path IS 'Path/key to the file in cloud storage';
COMMENT ON COLUMN signer_documents.file_size IS 'Size of the file in bytes';
COMMENT ON COLUMN signer_documents.mime_type IS 'MIME type of the uploaded file';
COMMENT ON COLUMN signer_documents.document_type IS 'Type of document (additional, identification, etc.)';
COMMENT ON COLUMN signer_documents.uploaded_by IS 'User ID of who uploaded the document';
COMMENT ON COLUMN signer_documents.status IS 'Status of the document (uploaded, verified, rejected, etc.)'; 