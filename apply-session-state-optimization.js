#!/usr/bin/env node

import { config } from 'dotenv';
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase.co') || DATABASE_URL.includes('supabase.com') ? {
    rejectUnauthorized: false
  } : false
});

async function applyOptimizations() {
  console.log('🚀 Starting Session State API Optimization...\n');
  console.log('📊 Target: /api/session/:sessionId/state endpoint');
  console.log('🎯 Goal: Sub-50ms response times with proper 304 caching\n');

  try {
    const startTime = Date.now();
    
    // Read the optimization SQL
    const sqlContent = readFileSync(join(process.cwd(), 'optimize-database-performance.sql'), 'utf-8');
    
    console.log('📝 Applying database indexes for ultra-fast session state queries...\n');
    
    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--') && stmt !== 'ANALYZE');
    
    let successCount = 0;
    
    for (const statement of statements) {
      if (!statement) continue;
      
      try {
        const stmtStartTime = Date.now();
        await pool.query(statement);
        const stmtDuration = Date.now() - stmtStartTime;
        
        if (statement.includes('CREATE INDEX')) {
          const indexName = statement.match(/idx_[\w_]+/)?.[0] || 'unknown';
          console.log(`✅ Created index: ${indexName} (${stmtDuration}ms)`);
        } else {
          console.log(`✅ Executed statement (${stmtDuration}ms)`);
        }
        successCount++;
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Index already exists (skipping)`);
        } else {
          console.error(`❌ Failed to execute statement:`, error.message);
        }
      }
    }
    
    // Run ANALYZE commands
    console.log('\n📊 Analyzing tables for query optimization...');
    const analyzeTables = ['editor_sessions', 'session_participants_status', 'users'];
    
    for (const table of analyzeTables) {
      try {
        const analyzeStart = Date.now();
        await pool.query(`ANALYZE ${table}`);
        const analyzeDuration = Date.now() - analyzeStart;
        console.log(`✅ Analyzed ${table} (${analyzeDuration}ms)`);
      } catch (error) {
        console.warn(`⚠️  Failed to analyze ${table}:`, error.message);
      }
    }
    
    const totalDuration = Date.now() - startTime;
    
    console.log('\n🎉 Session State Optimization Complete!');
    console.log(`⚡ Total time: ${totalDuration}ms`);
    console.log(`✅ Applied ${successCount} optimizations\n`);
    
    // Performance test
    console.log('🧪 Testing optimized query performance...');
    
    const testStart = Date.now();
    const testResult = await pool.query(`
      SELECT es.id, es.session_id, es.signing_state, es.active_user_id, es.is_live_session
      FROM editor_sessions es 
      WHERE es.session_id LIKE 'live_%' 
      LIMIT 5
    `);
    const testDuration = Date.now() - testStart;
    
    console.log(`⚡ Test query executed in ${testDuration}ms`);
    console.log(`📊 Found ${testResult.rows.length} test sessions\n`);
    
    console.log('🎯 Expected Performance Improvements:');
    console.log('   • 304 responses: ~5ms (was 1400ms)');
    console.log('   • Cache hits: ~50ms (was 1400ms)');
    console.log('   • Fresh queries: ~100ms (was 1400ms)');
    console.log('   • Database queries: ~10ms each');
    
    console.log('\n💡 Next Steps:');
    console.log('   1. Deploy the optimized code');
    console.log('   2. Monitor response times in production');
    console.log('   3. Test with real session IDs');
    console.log('   4. Check ETag/304 responses in browser dev tools\n');
    
  } catch (error) {
    console.error('💥 Optimization failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyOptimizations().catch(console.error); 