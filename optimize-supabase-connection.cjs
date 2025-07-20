#!/usr/bin/env node

// 🚀 Supabase Connection Optimization
// Test and optimize database connection performance

const { Pool } = require('pg');
const { performance } = require('perf_hooks');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax%40123@aws-0-us-east-2.pooler.supabase.com:6543/postgres";

// Test different connection configurations
const connectionConfigs = [
  {
    name: "Current Production Config",
    config: {
      connectionString: DATABASE_URL,
      max: 15,
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000,
      statement_timeout: 30000,
      query_timeout: 30000
    }
  },
  {
    name: "Optimized for Speed",
    config: {
      connectionString: DATABASE_URL,
      max: 5, // Lower max for better connection reuse
      min: 1, // Minimal connections
      idleTimeoutMillis: 10000, // Shorter idle timeout
      connectionTimeoutMillis: 5000, // Faster timeout
      keepAlive: true,
      keepAliveInitialDelayMillis: 1000, // Faster keepalive
      statement_timeout: 10000, // Shorter statement timeout
      query_timeout: 10000, // Shorter query timeout
      // Add connection optimization
      ssl: { rejectUnauthorized: false },
      application_name: 'usa_notary_optimized'
    }
  },
  {
    name: "Direct Connection (No Pooler)",
    config: {
      connectionString: DATABASE_URL.replace('.pooler.supabase.com:6543', '.supabase.co:5432'),
      max: 3, // Lower for direct connection
      min: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 3000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 500,
      statement_timeout: 5000,
      query_timeout: 5000,
      ssl: { rejectUnauthorized: false }
    }
  },
  {
    name: "Transaction Mode",
    config: {
      connectionString: DATABASE_URL.replace('6543/postgres', '6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10'),
      max: 3,
      min: 1,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 2000,
      keepAlive: false, // Disable for transaction mode
      statement_timeout: 3000,
      query_timeout: 3000
    }
  }
];

async function testConnectionConfig(configData: any): Promise<any> {
  console.log(`\n🔍 Testing: ${configData.name}`);
  console.log('=====================================');
  
  const pool = new Pool(configData.config);
  const results = {
    name: configData.name,
    connectionTime: 0,
    queryTime: 0,
    totalTime: 0,
    success: false,
    error: null
  };

  try {
    // Test connection time
    const connectionStart = performance.now();
    const client = await pool.connect();
    const connectionTime = performance.now() - connectionStart;
    results.connectionTime = Math.round(connectionTime);

    console.log(`⏱️  Connection Time: ${results.connectionTime}ms`);

    // Test query time
    const queryStart = performance.now();
    await client.query('SELECT 1 as test');
    const queryTime = performance.now() - queryStart;
    results.queryTime = Math.round(queryTime);

    console.log(`⚡ Query Time: ${results.queryTime}ms`);

    // Test a real query
    const realQueryStart = performance.now();
    await client.query('SELECT COUNT(*) FROM users LIMIT 1');
    const realQueryTime = performance.now() - realQueryStart;
    
    console.log(`📊 Real Query Time: ${Math.round(realQueryTime)}ms`);

    results.totalTime = results.connectionTime + results.queryTime;
    results.success = true;

    client.release();
    
    // Status evaluation
    if (results.connectionTime < 100) {
      console.log('✅ Connection: EXCELLENT');
    } else if (results.connectionTime < 500) {
      console.log('⚠️  Connection: OK'); 
    } else {
      console.log('❌ Connection: SLOW');
    }

  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    results.error = error.message;
  } finally {
    await pool.end();
  }

  return results;
}

async function findOptimalConnection() {
  console.log('🚀 Supabase Connection Optimization Test');
  console.log('=========================================');
  console.log(`📍 Testing connection to: aws-0-us-east-2`);
  console.log(`🏠 Your location: ${process.env.USER || 'Unknown'}`);

  const results = [];

  for (const config of connectionConfigs) {
    const result = await testConnectionConfig(config);
    results.push(result);
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 RESULTS SUMMARY');
  console.log('==================');
  
  const successful = results.filter(r => r.success);
  if (successful.length === 0) {
    console.log('❌ All connection tests failed');
    return;
  }

  // Sort by total time
  successful.sort((a, b) => a.totalTime - b.totalTime);

  console.log('\n🏆 PERFORMANCE RANKING:');
  successful.forEach((result, index) => {
    const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
    console.log(`${rank} ${result.name}: ${result.totalTime}ms (connect: ${result.connectionTime}ms + query: ${result.queryTime}ms)`);
  });

  const best = successful[0];
  console.log(`\n🎯 RECOMMENDED: ${best.name}`);
  console.log(`⚡ Performance: ${best.totalTime}ms (${Math.round(1777 / best.totalTime * 100 - 100)}% improvement)`);

  // Generate optimized config
  console.log('\n🔧 OPTIMIZED DATABASE CONFIG:');
  console.log('============================');
  console.log('Add this to your server/db.ts:');
  console.log('```typescript');
  
  if (best.name.includes('Direct Connection')) {
    console.log('// OPTIMIZED: Direct connection (no pooler)');
    console.log(`const DATABASE_URL = process.env.DATABASE_URL?.replace('.pooler.supabase.com:6543', '.supabase.co:5432');`);
  } else if (best.name.includes('Transaction Mode')) {
    console.log('// OPTIMIZED: Transaction mode with connection limits');
    console.log(`const DATABASE_URL = process.env.DATABASE_URL + '?pgbouncer=true&connection_limit=5&pool_timeout=10';`);
  }
  
  console.log('export const pool = new Pool({');
  console.log(`  connectionString: DATABASE_URL,`);
  console.log(`  max: ${connectionConfigs.find(c => c.name === best.name)?.config.max},`);
  console.log(`  min: ${connectionConfigs.find(c => c.name === best.name)?.config.min},`);
  console.log(`  idleTimeoutMillis: ${connectionConfigs.find(c => c.name === best.name)?.config.idleTimeoutMillis},`);
  console.log(`  connectionTimeoutMillis: ${connectionConfigs.find(c => c.name === best.name)?.config.connectionTimeoutMillis},`);
  console.log(`  keepAlive: ${connectionConfigs.find(c => c.name === best.name)?.config.keepAlive},`);
  
  if (best.name.includes('Optimized')) {
    console.log(`  ssl: { rejectUnauthorized: false },`);
    console.log(`  application_name: 'usa_notary_optimized'`);
  }
  
  console.log('});');
  console.log('```');

  // Additional recommendations
  console.log('\n💡 ADDITIONAL OPTIMIZATIONS:');
  console.log('1. Consider upgrading Supabase plan for dedicated resources');
  console.log('2. Add Redis caching for frequently accessed data'); 
  console.log('3. Use read replicas for heavy SELECT queries');
  console.log('4. Consider edge functions for user-specific queries');
  
  if (best.connectionTime > 200) {
    console.log('\n⚠️  WARNING: Connection time still high (>200ms)');
    console.log('This suggests network latency. Consider:');
    console.log('- Moving to Supabase region closer to your users');
    console.log('- Using a CDN or edge database');
    console.log('- Implementing aggressive caching');
  }
}

if (require.main === module) {
  findOptimalConnection().catch(console.error);
}

module.exports = { findOptimalConnection }; 