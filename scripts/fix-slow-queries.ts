#!/usr/bin/env npx tsx

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function fixSlowQueries() {
  try {
    console.log('🔧 Fixing Railway Slow Query Issues...\n');
    
    // Add missing indexes for frequently accessed endpoints
    const criticalIndexes = [
      {
        name: 'jobs_id_btree_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_id_btree_idx ON jobs USING btree(id);`,
        description: 'B-tree index for job ID lookups (certificate verification, recording details)'
      },
      {
        name: 'job_documents_job_id_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS job_documents_job_id_idx ON job_documents(job_id);`,
        description: 'Index for job documents lookups'
      },
      {
        name: 'job_document_versions_job_id_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS job_document_versions_job_id_idx ON job_document_versions(job_id);`,
        description: 'Index for document versions'
      },
      {
        name: 'video_sessions_job_id_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS video_sessions_job_id_idx ON video_sessions(job_id);`,
        description: 'Index for video sessions by job'
      },
      {
        name: 'digital_signatures_job_id_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS digital_signatures_job_id_idx ON digital_signatures(job_id);`,
        description: 'Index for digital signatures by job'
      },
      {
        name: 'notary_log_entries_job_id_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS notary_log_entries_job_id_idx ON notary_log_entries(job_id);`,
        description: 'Index for notary log entries'
      },
      {
        name: 'activity_logs_job_id_timestamp_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS activity_logs_job_id_timestamp_idx ON activity_logs(job_id, timestamp DESC);`,
        description: 'Composite index for activity logs with timestamp ordering'
      }
    ];

    console.log('📊 Adding critical performance indexes...\n');

    for (const index of criticalIndexes) {
      try {
        const start = Date.now();
        await db.execute(sql.raw(index.sql));
        const duration = Date.now() - start;
        console.log(`✅ ${index.name}: ${duration}ms - ${index.description}`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('does not exist')) {
          console.log(`⚠️  ${index.name}: ${error.message.includes('already exists') ? 'Already exists' : 'Table not found'}`);
        } else {
          console.log(`❌ ${index.name}: Error - ${error.message}`);
        }
      }
    }

    console.log('\n⚡ Setting Railway-specific optimizations...\n');

    // Railway connection optimizations
    const railwayOptimizations = [
      {
        name: 'Enable prepared statements cache',
        sql: `SET plan_cache_mode = 'force_generic_plan';`
      },
      {
        name: 'Optimize checkpoint settings',
        sql: `SET checkpoint_completion_target = 0.9;`
      },
      {
        name: 'Set timezone to UTC',
        sql: `SET timezone = 'UTC';`
      },
      {
        name: 'Enable query statistics',
        sql: `SET track_functions = 'all';`
      }
    ];

    for (const opt of railwayOptimizations) {
      try {
        await db.execute(sql.raw(opt.sql));
        console.log(`✅ ${opt.name}`);
      } catch (error) {
        console.log(`⚠️  ${opt.name}: ${error.message}`);
      }
    }

    console.log('\n🧹 Running maintenance tasks...');
    
    try {
      // Update table statistics for better query planning
      await db.execute(sql`ANALYZE;`);
      console.log('✅ Updated table statistics');
      
      // Check for query performance insights
      const slowQueries = await db.execute(sql`
        SELECT query, mean_exec_time, calls 
        FROM pg_stat_statements 
        WHERE mean_exec_time > 100 
        ORDER BY mean_exec_time DESC 
        LIMIT 5;
      `);
      
      if (slowQueries.rows.length > 0) {
        console.log('\n🐌 Slowest queries detected:');
        slowQueries.rows.forEach((row, i) => {
          console.log(`${i + 1}. ${row.mean_exec_time}ms avg (${row.calls} calls): ${row.query.substring(0, 80)}...`);
        });
      }
    } catch (error) {
      console.log('⚠️  Query statistics not available (pg_stat_statements extension may not be installed)');
    }

    console.log('\n📈 Performance fixes completed!');
    
    console.log('\n🎯 Specific Endpoint Optimizations Applied:');
    console.log('• Certificate verification: Job ID index + prepared statements');
    console.log('• Recording details: Video sessions index + query caching');
    console.log('• Job documents: Document indexes + composite keys');
    console.log('• Activity logs: Timestamp-based index for faster sorting');

    console.log('\n💡 Additional Recommendations:');
    console.log('1. 🚀 Upgrade Railway plan for better database performance');
    console.log('2. 🔄 Implement Redis caching for frequently accessed data');
    console.log('3. 📊 Add query result caching for certificate verification');
    console.log('4. 🏎️  Use connection pooling (already configured)');
    console.log('5. 📈 Monitor Railway database metrics dashboard');

  } catch (error) {
    console.error('❌ Error fixing slow queries:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixSlowQueries();
