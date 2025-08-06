-- Critical Performance Indexes Migration
-- Addresses 21-second job creation performance issue
-- Expected performance improvement: 6-8 seconds reduction

-- USERS Table Indexes (Addresses /api/users, /api/notaries/available slow queries)
-- ================================================================================

-- Index for role-based queries (notaries, clients, admins)
-- Used by: /api/notaries/available, /api/users queries filtered by role
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role 
ON users (role);

-- Index for active user queries
-- Used by: Most user queries that filter by isActive
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_active 
ON users (is_active);

-- Index for approval status queries
-- Used by: Admin queries filtering by approval status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_approval_status 
ON users (approval_status);

-- Composite index for notary queries (most common query pattern)
-- Used by: /api/notaries/available query that filters by role='notary' AND isActive=true
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_notary_active 
ON users (role, is_active) 
WHERE role = 'notary';

-- Index for email lookups (exact matches)
-- Used by: Login, user lookup, email verification
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower 
ON users (LOWER(email));

-- Index for username lookups
-- Used by: Login, user lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username_lower 
ON users (LOWER(username));

-- Index for notary type queries
-- Used by: Notary assignment queries, contractor vs subscriber filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_notary_type 
ON users (notary_type) 
WHERE role = 'notary';

-- Index for company association queries
-- Used by: Company user management, title company queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company_id 
ON users (company_id) 
WHERE company_id IS NOT NULL;

-- Index for created_at ordering (commonly used for sorting)
-- Used by: Admin user lists, chronological ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at 
ON users (created_at DESC);

-- CLOSING TYPES Table Indexes (Addresses /api/closing-types/active slow queries)
-- ================================================================================

-- Index for active closing types (most frequently queried)
-- Used by: /api/closing-types/active endpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_closing_types_is_active 
ON closing_types (is_active);

-- Index for name-based ordering and searches
-- Used by: Ordering by name in dropdown lists
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_closing_types_name 
ON closing_types (name);

-- Composite index for active types ordered by name (exact query optimization)
-- Used by: /api/closing-types/active with ORDER BY name
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_closing_types_active_name 
ON closing_types (is_active, name) 
WHERE is_active = true;

-- PARTICIPANT ROLES Table Indexes (Addresses /api/participant-roles/active slow queries)
-- ================================================================================

-- Index for active participant roles (most frequently queried)
-- Used by: /api/participant-roles/active endpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participant_roles_is_active 
ON participant_roles (is_active);

-- Index for name-based ordering and searches
-- Used by: Ordering by name in dropdown lists
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participant_roles_name 
ON participant_roles (name);

-- Composite index for active roles ordered by name (exact query optimization)
-- Used by: /api/participant-roles/active with ORDER BY name
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_participant_roles_active_name 
ON participant_roles (is_active, name) 
WHERE is_active = true;

-- JOBS Table Indexes (Job creation and management optimization)
-- ================================================================================

-- Index for user's jobs
-- Used by: Job listing, user dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_user_id 
ON jobs (user_id);

-- Index for notary assignments
-- Used by: Notary dashboard, job assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_notary_id 
ON jobs (notary_id) 
WHERE notary_id IS NOT NULL;

-- Index for job status queries
-- Used by: Job filtering by status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status 
ON jobs (job_status);

-- Index for created date ordering (most common sort)
-- Used by: Job listing with date ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_created_at 
ON jobs (created_at DESC);

-- Composite index for notary job filtering
-- Used by: Notary dashboard filtering active jobs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_notary_status 
ON jobs (notary_id, job_status) 
WHERE notary_id IS NOT NULL;

-- COMPANIES Table Indexes (Company-related queries optimization)
-- ================================================================================

-- Index for company name lookups
-- Used by: Company search, auto-assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_name_lower 
ON companies (LOWER(company_name));

-- Index for active companies
-- Used by: Active company filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_is_active 
ON companies (is_active) 
WHERE is_active = true;

-- SIGNERS Table Indexes (Signer-related queries optimization)
-- ================================================================================

-- Index for job signers
-- Used by: Job detail queries, signer management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_job_id 
ON signers (job_id);

-- Index for user signers
-- Used by: User's signing history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_user_id 
ON signers (user_id) 
WHERE user_id IS NOT NULL;

-- Index for signer email lookups
-- Used by: Signer invitation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signers_email_lower 
ON signers (LOWER(signer_email));

-- Critical performance indexes for session start operations
-- This migration addresses the 2000+ms slow requests when starting sessions

-- 1. CRITICAL: Index for sessionId lookups (primary query in startLiveSigningSession)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_session_id 
ON editor_sessions (session_id);

-- 2. Compound index for job + live session lookups (secondary query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_job_live 
ON editor_sessions (job_id, is_live_session, created_at DESC)
WHERE is_live_session = true;

-- 3. Index for signing state filtering  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_signing_state
ON editor_sessions (signing_state)
WHERE signing_state IN ('active', 'paused', 'waiting');

-- 4. Compound index for session_id + signing_state (for state checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_session_state
ON editor_sessions (session_id, signing_state);

-- 5. Index for active user updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_active_user
ON editor_sessions (session_id, active_user_id);

-- 6. Optimize user permission checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_id_role_privileges
ON users (id, role, privileges);

-- Performance Analysis Comments
-- ================================================================================
/*
Expected Performance Improvements:

1. /api/users queries: 2,729ms → <200ms (93% improvement)
   - Full table scan → Index scan on role/isActive

2. /api/notaries/available: 2,463ms → <150ms (94% improvement)
   - Full table scan → Composite index on (role='notary', isActive=true)

3. /api/closing-types/active: 2,489ms → <50ms (98% improvement)
   - Full table scan → Index scan on isActive with covering index

4. /api/participant-roles/active: 2,444ms → <50ms (98% improvement)
   - Full table scan → Index scan on isActive with covering index

Total Expected Improvement: ~10 seconds reduction in job creation time

Index Strategy:
- CONCURRENTLY: Avoid table locks during index creation
- Partial indexes (WHERE clauses): Smaller indexes for filtered queries
- Composite indexes: Cover exact query patterns
- Case-insensitive indexes: Better string matching performance
*/ 