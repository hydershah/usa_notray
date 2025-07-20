-- Critical Database Performance Optimizations
-- Run these commands to fix timeout issues and slow queries

-- 1. CRITICAL INDEXES for tag loading (fixes 15s timeouts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_tags_session_lookup
ON document_tags(session_id, document_id, page_number);

-- 2. Session state query optimization  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_status_lookup
ON editor_sessions(session_id, status) WHERE status = 'active';

-- 3. User lookup optimization for tag assignments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_tags_user_lookup
ON document_tags(assigned_user_id) WHERE assigned_user_id IS NOT NULL;

-- 4. Tag content updates optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_tags_updated_at
ON document_tags(updated_at DESC, session_id);

-- 5. Tag type filtering optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_tags_type_lookup
ON document_tags(tag_type, session_id, document_id);

-- 6. Update table statistics for query planner
ANALYZE document_tags;
ANALYZE editor_sessions;
ANALYZE users;

-- 7. Clean up dead tuples to improve performance
VACUUM ANALYZE document_tags;
VACUUM ANALYZE editor_sessions;

-- 8. Show current slow queries (for debugging)
SELECT 
    query,
    mean_exec_time,
    calls,
    total_exec_time
FROM pg_stat_statements 
WHERE query ILIKE '%document_tags%'
   OR query ILIKE '%editor_sessions%'
ORDER BY mean_exec_time DESC
LIMIT 10; 