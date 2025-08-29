#!/usr/bin/env npx tsx

import { db } from '../server/db.js';
import { users, jobs, closingTypes, participantRoles } from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

async function compareDbPerformance() {
  try {
    console.log('🔍 Railway Database Performance Analysis\n');
    
    const tests = [
      {
        name: 'Simple COUNT query (users)',
        query: () => db.select({ count: sql<number>`count(*)` }).from(users)
      },
      {
        name: 'Simple SELECT with LIMIT (users)',
        query: () => db.select().from(users).limit(10)
      },
      {
        name: 'SELECT with WHERE clause (active users)',
        query: () => db.select().from(users).where(eq(users.isActive, true)).limit(10)
      },
      {
        name: 'JOIN query (jobs with users)',
        query: () => db.select({
          jobId: jobs.id,
          jobStatus: jobs.status,
          userName: users.username
        }).from(jobs)
          .leftJoin(users, eq(jobs.userId, users.id))
          .limit(10)
      },
      {
        name: 'SELECT closing types',
        query: () => db.select().from(closingTypes).limit(10)
      },
      {
        name: 'SELECT participant roles',
        query: () => db.select().from(participantRoles).limit(10)
      }
    ];

    console.log('⏱️  Running performance tests...\n');

    for (const test of tests) {
      const start = Date.now();
      try {
        const result = await test.query();
        const duration = Date.now() - start;
        
        const resultCount = Array.isArray(result) ? result.length : 1;
        const performance = duration < 50 ? '🟢 Excellent' : 
                          duration < 100 ? '🟡 Good' : 
                          duration < 200 ? '🟠 Acceptable' : '🔴 Slow';
        
        console.log(`${performance} ${test.name}: ${duration}ms (${resultCount} rows)`);
      } catch (error) {
        console.log(`❌ ${test.name}: ERROR - ${error.message}`);
      }
    }

    console.log('\n📊 Performance Analysis:');
    console.log('🟢 Excellent: < 50ms (Local-like performance)');
    console.log('🟡 Good: 50-100ms (Acceptable for cloud)');
    console.log('🟠 Acceptable: 100-200ms (Cloud database normal)');
    console.log('🔴 Slow: > 200ms (Needs optimization)');

    // Test connection pool efficiency
    console.log('\n🔗 Connection Pool Test:');
    const poolStart = Date.now();
    const promises = Array.from({ length: 5 }, () => 
      db.select({ count: sql<number>`count(*)` }).from(users)
    );
    
    await Promise.all(promises);
    const poolDuration = Date.now() - poolStart;
    console.log(`Concurrent queries (5x): ${poolDuration}ms`);

    // Database info
    console.log('\n🏗️  Database Information:');
    try {
      const versionResult = await db.execute(sql`SELECT version();`);
      console.log(`PostgreSQL Version: ${versionResult.rows[0]?.version || 'Unknown'}`);
      
      const sizeResult = await db.execute(sql`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          current_database() as db_name;
      `);
      console.log(`Database: ${sizeResult.rows[0]?.db_name || 'Unknown'}`);
      console.log(`Size: ${sizeResult.rows[0]?.db_size || 'Unknown'}`);
      
      // Check if we're using Railway
      const isRailway = process.env.DATABASE_URL?.includes('railway.app') || 
                       process.env.DATABASE_URL?.includes('rlwy.net');
      console.log(`Environment: ${isRailway ? '🚂 Railway (Cloud)' : '💻 Local'}`);
      
    } catch (error) {
      console.log('Database info not available');
    }

    console.log('\n💡 Performance Tips:');
    console.log('1. Railway databases typically have 20-100ms latency vs <5ms local');
    console.log('2. Use connection pooling (already configured)');
    console.log('3. Add database indexes for frequently queried columns');
    console.log('4. Use LIMIT on large result sets');
    console.log('5. Consider caching for frequently accessed data');
    console.log('6. Batch database operations when possible');

  } catch (error) {
    console.error('❌ Error running performance tests:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

compareDbPerformance();
