#!/usr/bin/env node

/**
 * Database Performance Optimization Script
 * 
 * This script helps diagnose and fix database connection timeout issues
 * that are causing slow tag loading and 500 errors.
 */

const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');

// Database configuration
const dbConfig = {
  host: process.env.DATABASE_HOST || process.env.PGHOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || process.env.PGPORT || '5432'),
  database: process.env.DATABASE_NAME || process.env.PGDATABASE || 'usanotary',
  user: process.env.DATABASE_USER || process.env.PGUSER || 'postgres',
  password: process.env.DATABASE_PASSWORD || process.env.PGPASSWORD || '',
  
  // Connection pool optimization
  max: 10, // Maximum number of connections
  min: 2,  // Minimum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 15000, // Timeout after 15s instead of default 60s
  acquireTimeoutMillis: 15000, // Wait max 15s for connection
  createTimeoutMillis: 15000, // Max 15s to create connection
  destroyTimeoutMillis: 5000, // Max 5s to destroy connection
  reapIntervalMillis: 1000, // Check for idle connections every 1s
  createRetryIntervalMillis: 200, // Retry connection creation every 200ms
  
  // Enable keep-alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  
  // Enable statement timeout
  statement_timeout: 30000, // 30 second statement timeout
  query_timeout: 30000, // 30 second query timeout
};

console.log('🔧 Database Performance Optimization');
console.log('===================================');

async function testDatabaseConnection() {
  console.log('\n1. Testing database connection...');
  
  const pool = new Pool(dbConfig);
  
  try {
    const startTime = Date.now();
    const client = await pool.connect();
    const connectTime = Date.now() - startTime;
    
    console.log(`✅ Connection successful in ${connectTime}ms`);
    
    // Test a simple query
    const queryStart = Date.now();
    const result = await client.query('SELECT NOW() as current_time, version() as postgres_version');
    const queryTime = Date.now() - queryStart;
    
    console.log(`✅ Query executed in ${queryTime}ms`);
    console.log(`📊 PostgreSQL version: ${result.rows[0].postgres_version.split(' ')[0]}`);
    console.log(`🕒 Current time: ${result.rows[0].current_time}`);
    
    client.release();
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

async function checkDatabasePerformance() {
  console.log('\n2. Checking database performance...');
  
  const pool = new Pool(dbConfig);
  
  try {
    const client = await pool.connect();
    
    // Check slow queries
    console.log('\n📊 Checking for slow queries...');
    const slowQueries = await client.query(`
      SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows
      FROM pg_stat_statements 
      WHERE mean_time > 1000 
      ORDER BY mean_time DESC 
      LIMIT 10
    `);
    
    if (slowQueries.rows.length > 0) {
      console.log('⚠️  Found slow queries (>1000ms average):');
      slowQueries.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. ${row.mean_time.toFixed(2)}ms avg - ${row.calls} calls`);
        console.log(`      ${row.query.substring(0, 100)}...`);
      });
    } else {
      console.log('✅ No slow queries detected');
    }
    
    // Check database size and activity
    console.log('\n📊 Database statistics...');
    const stats = await client.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as db_size,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections
    `);
    
    const dbStats = stats.rows[0];
    console.log(`📦 Database size: ${dbStats.db_size}`);
    console.log(`🔗 Active connections: ${dbStats.active_connections}`);
    console.log(`💤 Idle connections: ${dbStats.idle_connections}`);
    
    // Check for long-running queries
    const longQueries = await client.query(`
      SELECT 
        pid,
        now() - pg_stat_activity.query_start AS duration,
        query,
        state
      FROM pg_stat_activity 
      WHERE (now() - pg_stat_activity.query_start) > interval '10 seconds'
      AND state = 'active'
      ORDER BY duration DESC
    `);
    
    if (longQueries.rows.length > 0) {
      console.log('\n⚠️  Long-running queries detected:');
      longQueries.rows.forEach((row, i) => {
        console.log(`   ${i + 1}. PID ${row.pid} - Running for ${row.duration}`);
        console.log(`      ${row.query.substring(0, 100)}...`);
      });
    } else {
      console.log('✅ No long-running queries');
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Performance check failed:', error.message);
  } finally {
    await pool.end();
  }
}

async function optimizeDatabase() {
  console.log('\n3. Applying database optimizations...');
  
  const pool = new Pool(dbConfig);
  
  try {
    const client = await pool.connect();
    
    // Analyze tables for better query planning
    console.log('📊 Running ANALYZE on all tables...');
    await client.query('ANALYZE');
    console.log('✅ ANALYZE completed');
    
    // Update table statistics
    console.log('📊 Updating statistics...');
    await client.query('SELECT pg_stat_reset()');
    console.log('✅ Statistics reset');
    
    // Recommend vacuum if needed
    console.log('🧹 Checking if VACUUM is needed...');
    const vacuumCheck = await client.query(`
      SELECT 
        schemaname,
        tablename,
        n_dead_tup,
        n_live_tup,
        CASE WHEN n_live_tup > 0 
          THEN (n_dead_tup::float / n_live_tup::float * 100)::int 
          ELSE 0 
        END as dead_tuple_percent
      FROM pg_stat_user_tables 
      WHERE n_dead_tup > 1000
      ORDER BY dead_tuple_percent DESC
    `);
    
    if (vacuumCheck.rows.length > 0) {
      console.log('⚠️  Tables that might need VACUUM:');
      vacuumCheck.rows.forEach(row => {
        console.log(`   ${row.tablename}: ${row.dead_tuple_percent}% dead tuples (${row.n_dead_tup} dead, ${row.n_live_tup} live)`);
      });
      console.log('\n💡 Consider running: VACUUM ANALYZE;');
    } else {
      console.log('✅ No tables need immediate VACUUM');
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Optimization failed:', error.message);
  } finally {
    await pool.end();
  }
}

async function testTagOperations() {
  console.log('\n4. Testing critical tag operations...');
  
  const pool = new Pool(dbConfig);
  
  try {
    const client = await pool.connect();
    
    // Test tag loading query performance
    console.log('📊 Testing tag loading performance...');
    const tagLoadStart = Date.now();
    
    const tagQuery = `
      SELECT 
        dt.id, dt.tag_type, dt.assigned_user_id, dt.page_number,
        dt.x_position, dt.y_position, dt.width, dt.height,
        dt.is_completed, dt.content, dt.content_type, dt.content_data,
        u.first_name, u.last_name
      FROM document_tags dt
      LEFT JOIN users u ON dt.assigned_user_id = u.id
      WHERE dt.session_id IN (
        SELECT id FROM editor_sessions 
        WHERE session_id LIKE 'live_%' 
        AND status = 'active'
        LIMIT 1
      )
      LIMIT 10
    `;
    
    const tagResult = await client.query(tagQuery);
    const tagLoadTime = Date.now() - tagLoadStart;
    
    console.log(`✅ Tag loading test: ${tagLoadTime}ms for ${tagResult.rows.length} tags`);
    
    if (tagLoadTime > 5000) {
      console.log('⚠️  Tag loading is slow! Consider optimizing indexes.');
    }
    
    // Test session state query
    console.log('📊 Testing session state performance...');
    const sessionStart = Date.now();
    
    const sessionQuery = `
      SELECT 
        es.*,
        (SELECT count(*) FROM document_tags WHERE session_id = es.id) as tag_count
      FROM editor_sessions es
      WHERE es.session_id LIKE 'live_%'
      AND es.status = 'active'
      LIMIT 1
    `;
    
    const sessionResult = await client.query(sessionQuery);
    const sessionTime = Date.now() - sessionStart;
    
    console.log(`✅ Session state test: ${sessionTime}ms for ${sessionResult.rows.length} sessions`);
    
    if (sessionTime > 2000) {
      console.log('⚠️  Session loading is slow! Consider optimizing session queries.');
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Tag operation test failed:', error.message);
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      console.log('\n❌ Cannot proceed with optimization due to connection issues');
      process.exit(1);
    }
    
    await checkDatabasePerformance();
    await optimizeDatabase();
    await testTagOperations();
    
    console.log('\n🎉 Database optimization completed!');
    console.log('\nRecommendations:');
    console.log('1. Monitor database performance regularly');
    console.log('2. Consider connection pooling optimization');
    console.log('3. Run VACUUM ANALYZE during maintenance windows');
    console.log('4. Monitor slow query logs');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run optimization
main(); 