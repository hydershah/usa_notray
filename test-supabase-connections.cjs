#!/usr/bin/env node

// 🚀 Simple Supabase Connection Test
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax%40123@aws-0-us-east-2.pooler.supabase.com:6543/postgres";

// Test configurations
const configs = [
  {
    name: "Current Config",
    url: DATABASE_URL,
    options: { max: 15, min: 2, connectionTimeoutMillis: 15000 }
  },
  {
    name: "Fast Config", 
    url: DATABASE_URL,
    options: { max: 3, min: 1, connectionTimeoutMillis: 3000, idleTimeoutMillis: 5000 }
  },
  {
    name: "Direct Connection",
    url: DATABASE_URL.replace('.pooler.supabase.com:6543', '.supabase.co:5432'),
    options: { max: 2, min: 1, connectionTimeoutMillis: 2000 }
  }
];

async function testConnection(config) {
  console.log(`\n🔍 Testing: ${config.name}`);
  console.log('='.repeat(40));
  
  const pool = new Pool({
    connectionString: config.url,
    ...config.options
  });

  try {
    const start = Date.now();
    const client = await pool.connect();
    const connectTime = Date.now() - start;
    
    console.log(`⏱️  Connection: ${connectTime}ms`);

    const queryStart = Date.now();
    const result = await client.query('SELECT 1 as test');
    const queryTime = Date.now() - queryStart;
    
    console.log(`⚡ Query: ${queryTime}ms`);
    console.log(`🎯 Total: ${connectTime + queryTime}ms`);

    if (connectTime < 100) {
      console.log('✅ EXCELLENT');
    } else if (connectTime < 500) {
      console.log('⚠️  OK');
    } else {
      console.log('❌ SLOW');
    }

    client.release();
    await pool.end();

    return { 
      name: config.name, 
      connectionTime: connectTime, 
      queryTime: queryTime, 
      total: connectTime + queryTime 
    };

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    await pool.end();
    return { name: config.name, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Supabase Connection Speed Test');
  console.log('='.repeat(50));
  console.log(`📍 Target: aws-0-us-east-2.pooler.supabase.com`);
  
  const results = [];
  
  for (const config of configs) {
    const result = await testConnection(config);
    results.push(result);
    
    // Wait 1 second between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n📊 RESULTS SUMMARY');
  console.log('='.repeat(30));

  const successful = results.filter(r => !r.error);
  
  if (successful.length === 0) {
    console.log('❌ All tests failed!');
    return;
  }

  // Sort by total time
  successful.sort((a, b) => a.total - b.total);

  console.log('\n🏆 PERFORMANCE RANKING:');
  successful.forEach((result, i) => {
    const emoji = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
    console.log(`${emoji} ${result.name}: ${result.total}ms`);
  });

  const best = successful[0];
  const improvement = Math.round((1777 / best.total - 1) * 100);
  
  console.log(`\n🎯 WINNER: ${best.name}`);
  console.log(`⚡ Speed: ${best.total}ms (${improvement}% improvement)`);

  // Generate recommendation
  console.log('\n🔧 RECOMMENDED FIX:');
  console.log('='.repeat(25));
  
  if (best.name.includes('Direct')) {
    console.log('✅ Use direct connection (bypass pooler)');
    console.log('Add to your .env:');
    console.log(`DATABASE_URL="${DATABASE_URL.replace('.pooler.supabase.com:6543', '.supabase.co:5432')}"`);
  } else if (best.name.includes('Fast')) {
    console.log('✅ Use fast connection config');
    console.log('Update server/db.ts pool settings:');
    console.log('max: 3, min: 1, connectionTimeoutMillis: 3000');
  }

  if (best.total > 300) {
    console.log('\n⚠️  Still slow? Consider:');
    console.log('1. Upgrading Supabase plan');
    console.log('2. Moving to closer region');  
    console.log('3. Adding connection pooling service');
  }
}

if (require.main === module) {
  runTests().catch(console.error);
} 