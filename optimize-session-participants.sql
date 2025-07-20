-- Ultra-fast session participants optimization
-- Target: sessionParticipantsStatus table queries

-- Critical index for session participants lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_participants_session_id_minimal 
ON session_participants_status (session_id)
INCLUDE (user_id, is_active, can_interact);

-- Index for bulk user lookups by ID array
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_bulk_lookup 
ON users (id)
INCLUDE (first_name, last_name, username, role);

-- Update table statistics for optimal query planning
ANALYZE session_participants_status;
ANALYZE users;

-- Test query performance (should be <10ms)
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT user_id, is_active, can_interact
-- FROM session_participants_status 
-- WHERE session_id = 123; 