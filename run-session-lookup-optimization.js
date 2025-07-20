#!/usr/bin/env node

import { config } from 'dotenv';
import { Pool } from 'pg';
import { readFileSync } from 'fs';

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

async function optimizeSessionLookups() {
  console.log('⚡ Optimizing Session Lookup Performance...\n');

  try {
    // Read and execute the optimization SQL
    const sqlContent = readFileSync('./optimize-session-lookup.sql', 'utf-8');
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (!statement) continue;
      
      try {
        const startTime = Date.now();
        await pool.query(statement);
        const duration = Date.now() - startTime;
        
        if (statement.includes('CREATE INDEX')) {
          const indexName = statement.match(/idx_[\w_]+/)?.[0] || 'unknown';
          console.log(`✅ Created index: ${indexName} (${duration}ms)`);
        } else if (statement.includes('ANALYZE')) {
          console.log(`📊 Analyzed editor_sessions table (${duration}ms)`);
        }
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Index already exists (skipping)`);
        } else {
          console.error(`❌ Failed:`, error.message);
        }
      }
    }

    // Test query performance
    console.log('\n🧪 Testing session lookup performance...');
    const testStart = Date.now();
    
    const testResult = await pool.query(`
      SELECT id, session_id, job_id, signing_state, active_user_id, is_live_session
      FROM editor_sessions 
      WHERE session_id = 'live_99_1753002725659' 
      LIMIT 1
    `);
    
    const testDuration = Date.now() - testStart;
    console.log(`⚡ Session lookup test: ${testDuration}ms`);
    
    if (testResult.rows.length > 0) {
      console.log(`📊 Found session: ${testResult.rows[0].session_id}`);
    }
    
    console.log('\n🎉 Session Lookup Optimization Complete!');
    console.log('Expected improvements:');
    console.log('   • Session lookups: <10ms (was 2900ms)');
    console.log('   • Overall session state: <50ms for fresh queries');
    console.log('   • Cache hits: still ~1-3ms');
    
  } catch (error) {
    console.error('💥 Optimization failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

optimizeSessionLookups().catch(console.error); 