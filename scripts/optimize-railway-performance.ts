#!/usr/bin/env npx tsx

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function optimizeRailwayPerformance() {
  try {
    console.log('🚀 Optimizing Railway PostgreSQL Performance...\n');
    
    // Critical indexes for better performance
    const indexes = [
      {
        name: 'users_email_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS users_email_idx ON users(email);`,
        description: 'Index on users.email for faster login queries'
      },
      {
        name: 'users_username_idx', 
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS users_username_idx ON users(username);`,
        description: 'Index on users.username for faster user lookups'
      },
      {
        name: 'users_active_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS users_active_idx ON users(is_active) WHERE is_active = true;`,
        description: 'Partial index on active users only'
      },
      {
        name: 'jobs_status_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_status_idx ON jobs(status);`,
        description: 'Index on job status for filtering'
      },
      {
        name: 'jobs_user_id_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_user_id_idx ON jobs(user_id);`,
        description: 'Index on jobs.user_id for user job lookups'
      },
      {
        name: 'jobs_notary_id_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS jobs_notary_id_idx ON jobs(notary_id);`,
        description: 'Index on jobs.notary_id for notary job lookups'
      },
      {
        name: 'closing_types_active_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS closing_types_active_idx ON closing_types(is_active) WHERE is_active = true;`,
        description: 'Partial index on active closing types'
      },
      {
        name: 'participant_roles_active_idx',
        sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS participant_roles_active_idx ON participant_roles(is_active) WHERE is_active = true;`,
        description: 'Partial index on active participant roles'
      }
    ];

    console.log('📊 Creating performance indexes...\n');

    for (const index of indexes) {
      try {
        const start = Date.now();
        await db.execute(sql.raw(index.sql));
        const duration = Date.now() - start;
        console.log(`✅ ${index.name}: ${duration}ms - ${index.description}`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${index.name}: Already exists - ${index.description}`);
        } else {
          console.log(`❌ ${index.name}: Error - ${error.message}`);
        }
      }
    }

    console.log('\n⚡ Setting PostgreSQL performance optimizations...\n');

    // Railway-specific optimizations
    const optimizations = [
      {
        name: 'Set work_mem for faster sorting',
        sql: `SET work_mem = '16MB';`,
        description: 'Increase memory for sorting operations'
      },
      {
        name: 'Set shared_buffers',
        sql: `SET shared_buffers = '128MB';`,
        description: 'Increase buffer cache (if allowed)'
      },
      {
        name: 'Set effective_cache_size',
        sql: `SET effective_cache_size = '256MB';`,
        description: 'Hint about available OS cache'
      },
      {
        name: 'Set random_page_cost',
        sql: `SET random_page_cost = 1.1;`,
        description: 'Optimize for SSD storage'
      }
    ];

    for (const opt of optimizations) {
      try {
        await db.execute(sql.raw(opt.sql));
        console.log(`✅ ${opt.description}`);
      } catch (error) {
        console.log(`⚠️  ${opt.description}: ${error.message}`);
      }
    }

    console.log('\n🔧 Running ANALYZE to update statistics...');
    try {
      await db.execute(sql`ANALYZE;`);
      console.log('✅ Database statistics updated');
    } catch (error) {
      console.log(`⚠️  ANALYZE failed: ${error.message}`);
    }

    console.log('\n📈 Performance optimization completed!');
    console.log('\n💡 Additional Railway Performance Tips:');
    console.log('1. Railway databases are geographically distributed - latency is normal');
    console.log('2. Use connection pooling (now optimized for Railway)');
    console.log('3. Implement application-level caching with Redis');
    console.log('4. Use LIMIT clauses on large queries');
    console.log('5. Consider upgrading Railway plan for better performance');
    console.log('6. Monitor Railway metrics dashboard for database insights');

  } catch (error) {
    console.error('❌ Error optimizing Railway performance:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

optimizeRailwayPerformance();
