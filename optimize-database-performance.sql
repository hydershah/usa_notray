-- Ultra-fast session state endpoint optimization indexes
-- These indexes will make /api/session/:sessionId/state super fast

-- Critical indexes for editor_sessions table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_session_id_optimized 
ON editor_sessions (session_id) 
WHERE status = 'active' AND is_live_session = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_job_id_live_signing 
ON editor_sessions (job_id, updated_at DESC) 
WHERE is_live_session = true;

-- Composite index for session participants status (most critical)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_participants_session_user_optimized 
ON session_participants_status (session_id, user_id, is_active);

-- Covering index for participant data to avoid table lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_participants_full_data 
ON session_participants_status (session_id) 
INCLUDE (user_id, is_active, can_interact, joined_at, left_at, last_activity);

-- User data index for fast JOINs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_essential_data 
ON users (id) 
INCLUDE (first_name, last_name, username, role);

-- Performance monitoring queries
-- These will help track the optimization impact

ANALYZE editor_sessions;
ANALYZE session_participants_status;
ANALYZE users;

-- Performance test query (should be sub-10ms after optimization)
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT es.id, es.session_id, es.signing_state, es.active_user_id, es.is_live_session
-- FROM editor_sessions es 
-- WHERE es.session_id = 'live_99_1753002725659' 
-- LIMIT 1;

-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT sps.user_id, sps.is_active, sps.can_interact, u.first_name, u.username, u.role
-- FROM session_participants_status sps
-- INNER JOIN users u ON sps.user_id = u.id
-- WHERE sps.session_id = 123;

-- Add maintenance for optimal performance
-- Run these periodically to keep performance optimal

-- Vacuum and reindex for optimal performance (run weekly)
-- VACUUM ANALYZE editor_sessions;
-- VACUUM ANALYZE session_participants_status;  
-- VACUUM ANALYZE users;

-- Check index usage stats (run monthly)
-- SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE indexname LIKE '%session%' OR indexname LIKE '%user%'
-- ORDER BY idx_tup_read DESC; 