-- Critical Database Indexes for Performance Optimization
-- This migration adds indexes to improve query performance at scale

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active ON users(role, is_active) WHERE is_active = true;

-- Jobs table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_notary_id ON jobs(notary_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status ON jobs(job_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_scheduled_at ON jobs(scheduled_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_title_company ON jobs(title_company);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_closing_type ON jobs(closing_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_created ON jobs(job_status, created_at);

-- Signers table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_job_id ON signers(job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_user_id ON signers(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_email ON signers(signer_email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_invitation_token ON signers(invitation_token);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_signing_status ON signers(signing_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_created_at ON signers(created_at);

-- Job Documents table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_documents_job_id ON job_documents(job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_documents_uploaded_by ON job_documents(uploaded_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_documents_document_type ON job_documents(document_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_documents_status ON job_documents(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_documents_created_at ON job_documents(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_documents_job_type ON job_documents(job_id, document_type);

-- Companies table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_status ON companies(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_email ON companies(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_company_name ON companies(company_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_manager_id ON companies(company_manager_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_preferred_notary ON companies(preferred_notary_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_created_at ON companies(created_at);

-- Job Participants table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_participants_job_id ON job_participants(job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_participants_user_id ON job_participants(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_participants_email ON job_participants(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_participants_invite_token ON job_participants(invite_token);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_participants_invite_status ON job_participants(invite_status);

-- Payments table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_job_id ON payments(job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_payer_id ON payments(payer_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_payee_id ON payments(payee_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

-- Account Transactions table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_transactions_user_id ON account_transactions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_transactions_job_id ON account_transactions(job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_transactions_type ON account_transactions(transaction_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_transactions_status ON account_transactions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_transactions_created_at ON account_transactions(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_account_transactions_stripe_id ON account_transactions(stripe_transaction_id);

-- Contractor Payments table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contractor_payments_contractor_id ON contractor_payments(contractor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contractor_payments_job_id ON contractor_payments(job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contractor_payments_status ON contractor_payments(payment_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contractor_payments_created_at ON contractor_payments(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contractor_payments_client_payment_date ON contractor_payments(client_payment_date);

-- Notary Assignment Log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notary_assignment_log_job_id ON notary_assignment_log(job_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notary_assignment_log_notary_id ON notary_assignment_log(notary_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notary_assignment_log_status ON notary_assignment_log(assignment_status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notary_assignment_log_assigned_at ON notary_assignment_log(assigned_at);

-- Password Reset Tokens indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used);

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active_approval ON users(role, is_active, approval_status) 
WHERE is_active = true AND approval_status = 'approved';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_notary_scheduled ON jobs(job_status, notary_id, scheduled_at)
WHERE job_status IN ('open', 'pending', 'scheduled');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_job_status ON signers(job_id, signing_status)
WHERE signing_status IN ('pending', 'in_progress');

-- Text search indexes for common search patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_fullname_gin ON users USING gin(to_tsvector('english', coalesce(full_name, '')));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_name_gin ON companies USING gin(to_tsvector('english', company_name));

-- Statistics update to help query planner
ANALYZE users;
ANALYZE jobs;
ANALYZE signers;
ANALYZE job_documents;
ANALYZE companies;
ANALYZE payments;
ANALYZE account_transactions;

-- Create a function to monitor index usage
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE(
    schemaname TEXT,
    tablename TEXT,
    indexname TEXT,
    idx_scan BIGINT,
    idx_tup_read BIGINT,
    idx_tup_fetch BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname::TEXT,
        tablename::TEXT,
        indexname::TEXT,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_index_usage_stats() IS 'Monitor index usage to identify which indexes are being used effectively';

-- Add comments to explain the indexing strategy
COMMENT ON INDEX idx_users_role_active_approval IS 'Optimizes notary assignment queries by role and approval status';
COMMENT ON INDEX idx_jobs_status_notary_scheduled IS 'Optimizes job dashboard and scheduling queries';
COMMENT ON INDEX idx_signers_job_status IS 'Optimizes signer status tracking and job completion queries';
COMMENT ON INDEX idx_users_fullname_gin IS 'Enables full-text search on user names';
COMMENT ON INDEX idx_companies_name_gin IS 'Enables full-text search on company names'; 