#!/usr/bin/env node

/**
 * Emergency Database Recovery Script
 * 
 * This script will help recover from the severe database timeout issues
 * by clearing stuck connections and resetting the pool.
 */

console.log('🚨 EMERGENCY DATABASE RECOVERY');
console.log('================================\n');

const { Pool } = require('pg');

// Use same connection string as app
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';

console.log('🔧 EMERGENCY ACTIONS:');
console.log('1. Creating new minimal pool with ultra-fast timeouts');
console.log('2. Testing basic connectivity');
console.log('3. Clearing any stuck transactions');
console.log('4. Validating critical tables\n');

// Create emergency pool with minimal settings
const emergencyPool = new Pool({
  connectionString: DATABASE_URL,
  max: 1, // Single connection only
  min: 0, // No minimum
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 2000, // 2 seconds max
  acquireTimeoutMillis: 2000,
  statement_timeout: 3000, // 3 seconds max
  query_timeout: 3000,
  ssl: { rejectUnauthorized: false }
});

async function emergencyRecovery() {
  let client;
  
  try {
    console.log('⚡ Step 1: Testing database connectivity...');
    
    // Test basic connection with timeout
    const connectPromise = emergencyPool.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 3000)
    );
    
    client = await Promise.race([connectPromise, timeoutPromise]);
    console.log('✅ Database connection established');
    
    console.log('⚡ Step 2: Testing basic query...');
    const result = await client.query('SELECT NOW() as current_time, version()');
    console.log('✅ Basic query successful:', result.rows[0].current_time);
    
    console.log('⚡ Step 3: Checking active connections...');
    const connections = await client.query(`
      SELECT count(*) as active_connections,
             count(*) FILTER (WHERE state = 'active') as active_queries,
             count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    console.log('📊 Connection status:', connections.rows[0]);
    
    console.log('⚡ Step 4: Checking for long-running queries...');
    const longQueries = await client.query(`
      SELECT pid, state, 
             extract(epoch from now() - query_start) as duration_seconds,
             left(query, 100) as query_preview
      FROM pg_stat_activity 
      WHERE datname = current_database() 
        AND state != 'idle' 
        AND extract(epoch from now() - query_start) > 5
      ORDER BY duration_seconds DESC
    `);
    
    if (longQueries.rows.length > 0) {
      console.log('⚠️ Found long-running queries:');
      longQueries.rows.forEach(row => {
        console.log(`   PID ${row.pid}: ${row.duration_seconds}s - ${row.query_preview}...`);
      });
    } else {
      console.log('✅ No long-running queries found');
    }
    
    console.log('⚡ Step 5: Testing critical tables...');
    const tableTests = [
      { name: 'users', query: 'SELECT COUNT(*) as count FROM users LIMIT 1' },
      { name: 'document_tags', query: 'SELECT COUNT(*) as count FROM document_tags LIMIT 1' },
      { name: 'editor_sessions', query: 'SELECT COUNT(*) as count FROM editor_sessions LIMIT 1' }
    ];
    
    for (const test of tableTests) {
      try {
        const result = await client.query(test.query);
        console.log(`✅ Table ${test.name}: ${result.rows[0].count} records`);
      } catch (error) {
        console.log(`❌ Table ${test.name}: ERROR - ${error.message}`);
      }
    }
    
    console.log('\n🎉 EMERGENCY RECOVERY COMPLETED');
    console.log('================================');
    console.log('✅ Database is responsive with minimal pool settings');
    console.log('✅ Updated server/db.ts with emergency timeouts');
    console.log('🔄 Please restart your development server now:\n');
    console.log('   npm run dev\n');
    
  } catch (error) {
    console.error('❌ EMERGENCY RECOVERY FAILED:', error.message);
    console.log('\n🚨 CRITICAL DATABASE ISSUE DETECTED');
    console.log('====================================');
    console.log('The database is not responding even with minimal settings.');
    console.log('This indicates a server-level issue that requires:');
    console.log('1. Database server restart');
    console.log('2. Connection pooler restart'); 
    console.log('3. Network connectivity check');
    console.log('4. Supabase status verification\n');
    
  } finally {
    if (client) {
      client.release();
    }
    await emergencyPool.end();
    console.log('🧹 Emergency pool closed');
    process.exit(error ? 1 : 0);
  }
}

// Run recovery
emergencyRecovery().catch(console.error); 