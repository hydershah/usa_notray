-- Migration: Add Critical Performance Indexes
-- Date: 2025-01-24
-- Purpose: Fix slow queries for job creation and API endpoints

-- Jobs table indexes (critical for job-invitations endpoint)
CREATE INDEX IF NOT EXISTS idx_jobs_notary_id ON jobs(notary_id);
CREATE INDEX IF NOT EXISTS idx_jobs_notary_approval_status ON jobs(notary_approval_status);
CREATE INDEX IF NOT EXISTS idx_jobs_job_status ON jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_notary_combined ON jobs(notary_id, notary_approval_status, job_status);

-- Users table indexes (critical for users endpoint)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);

-- Job participants indexes (for session access)
CREATE INDEX IF NOT EXISTS idx_job_participants_job_id ON job_participants(job_id);
CREATE INDEX IF NOT EXISTS idx_job_participants_user_id ON job_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_job_participants_role ON job_participants(role);
CREATE INDEX IF NOT EXISTS idx_job_participants_invite_status ON job_participants(invite_status);

-- Signers table indexes (for job creation)
CREATE INDEX IF NOT EXISTS idx_signers_job_id ON signers(job_id);
CREATE INDEX IF NOT EXISTS idx_signers_user_id ON signers(user_id);
CREATE INDEX IF NOT EXISTS idx_signers_email ON signers(signer_email);
CREATE INDEX IF NOT EXISTS idx_signers_invitation_token ON signers(invitation_token);

-- Job documents indexes (for document queries)
CREATE INDEX IF NOT EXISTS idx_job_documents_job_id ON job_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_job_documents_uploaded_by ON job_documents(uploaded_by);

-- Session participants indexes (for live sessions)
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants_status(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants_status(user_id);

-- Editor sessions indexes
CREATE INDEX IF NOT EXISTS idx_editor_sessions_session_id ON editor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_editor_sessions_job_id ON editor_sessions(job_id);

-- Audit trail indexes (for performance monitoring)
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_session_id ON audit_trail(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at);

-- PARTIAL INDEXES for common filtered queries
CREATE INDEX IF NOT EXISTS idx_jobs_active_with_notary ON jobs(notary_id, created_at) 
WHERE job_status IN ('open', 'pending') AND notary_approval_status = 'assigned_pending_approval';

CREATE INDEX IF NOT EXISTS idx_users_active_notaries ON users(id, created_at) 
WHERE role = 'notary' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_users_active_signers ON users(id, email) 
WHERE role IN ('signer', 'witness') AND is_active = true;

COMMENT ON INDEX idx_jobs_notary_combined IS 'Composite index for notary job invitations query optimization';
COMMENT ON INDEX idx_jobs_active_with_notary IS 'Partial index for active jobs with notary assignments';
COMMENT ON INDEX idx_users_active_notaries IS 'Partial index for active notary users'; 