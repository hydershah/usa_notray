-- Fix for slow session state lookups
-- Target: editor_sessions table queries by session_id

-- Critical index for session_id lookups (the main bottleneck)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_session_id_fast
ON editor_sessions (session_id, id, job_id, signing_state, active_user_id, is_live_session);

-- Index for the job_id fallback lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_job_id_active
ON editor_sessions (job_id, status, updated_at DESC)
WHERE is_live_session = true;

-- Analyze for immediate performance improvement
ANALYZE editor_sessions;

-- Test the optimized query (should be <10ms)
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT id, session_id, job_id, signing_state, active_user_id, is_live_session
-- FROM editor_sessions 
-- WHERE session_id = 'live_99_1753002725659' 
-- LIMIT 1; 