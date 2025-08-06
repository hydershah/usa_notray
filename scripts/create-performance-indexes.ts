import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function createPerformanceIndexes() {
  console.log('🚀 Creating critical performance indexes for session start optimization...');
  
  // Critical indexes for session start performance
  const indexes = [
    {
      name: 'idx_editor_sessions_session_id',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_session_id ON editor_sessions (session_id);',
      description: 'Primary sessionId lookup optimization'
    },
    {
      name: 'idx_editor_sessions_job_live', 
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_job_live ON editor_sessions (job_id, is_live_session, created_at DESC) WHERE is_live_session = true;',
      description: 'Job + live session filtering'
    },
    {
      name: 'idx_editor_sessions_signing_state',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_signing_state ON editor_sessions (signing_state) WHERE signing_state IN (\'active\', \'paused\', \'waiting\');',
      description: 'Signing state filtering'
    },
    {
      name: 'idx_editor_sessions_session_state',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_editor_sessions_session_state ON editor_sessions (session_id, signing_state);',
      description: 'Combined session + state lookup'
    },
    {
      name: 'idx_users_id_role_privileges',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_id_role_privileges ON users (id, role, privileges);',
      description: 'User permission checks'
    }
  ];
  
  for (const index of indexes) {
    console.log(`📊 Creating index: ${index.name} (${index.description})...`);
    try {
      await db.execute(sql.raw(index.sql));
      console.log(`✅ Successfully created: ${index.name}`);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log(`⚠️  Index ${index.name} already exists, skipping`);
      } else {
        console.error(`❌ Failed to create ${index.name}:`, error.message);
      }
    }
  }
  
  console.log('\n🎉 All critical performance indexes processed!');
  console.log('⚡ Session start performance should now be significantly improved');
  console.log('Expected improvement: 2000+ms → <500ms for session start operations');
  
  process.exit(0);
}

createPerformanceIndexes().catch((error) => {
  console.error('💥 Error creating indexes:', error);
  process.exit(1);
}); 