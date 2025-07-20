#!/usr/bin/env node

// 🚀 Test different Supabase connection types for performance
const { Pool } = require('pg');

const PASSWORD = 'Xymax%40123';

// Test different connection types
const connectionTypes = [
  {
    name: "🔴 CURRENT: Transaction Pooler (Wrong for your app)",
    url: `postgresql://postgres.ueoqbwsigpowzbdlqezz:${PASSWORD}@aws-0-us-east-2.pooler.supabase.com:6543/postgres`,
    description: "What you're using now - designed for serverless, not persistent apps"
  },
  {
    name: "🟢 RECOMMENDED: Direct Connection", 
    url: `postgresql://postgres:${PASSWORD}@db.ueoqbwsigpowzbdlqezz.supabase.co:5432/postgres`,
    description: "Best for persistent Node.js apps - should be much faster"
  },
  {
    name: "🟡 FALLBACK: Session Pooler (IPv4 compatible)",
    url: `postgresql://postgres.ueoqbwsigpowzbdlqezz:${PASSWORD}@aws-0-us-east-2.pooler.supabase.com:5432/postgres`, 
    description: "Use this if Direct Connection fails due to IPv4"
  }
];

async function testConnection(config) {
  console.log(`\n${config.name}`);
  console.log(`📝 ${config.description}`);
  console.log(`🔗 Testing connection...`);
  
  const pool = new Pool({
    connectionString: config.url,
    max: 3,
    min: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000
  });
  
  try {
    // Test connection time
    const startTime = Date.now();
    const client = await pool.connect();
    const connectionTime = Date.now() - startTime;
    
    // Test query time  
    const queryStart = Date.now();
    const result = await client.query('SELECT 1 as test, NOW() as timestamp');
    const queryTime = Date.now() - queryStart;
    
    const totalTime = connectionTime + queryTime;
    
    console.log(`✅ SUCCESS:`);
    console.log(`   Connection Time: ${connectionTime}ms`);
    console.log(`   Query Time: ${queryTime}ms`); 
    console.log(`   Total Time: ${totalTime}ms`);
    
    // Performance rating
    if (totalTime < 200) {
      console.log(`   🚀 EXCELLENT - Perfect for production`);
    } else if (totalTime < 500) {
      console.log(`   ✅ GOOD - Acceptable performance`);
    } else if (totalTime < 1000) {
      console.log(`   ⚠️  SLOW - May cause issues under load`);
    } else {
      console.log(`   🔴 CRITICAL - Will cause major performance problems`);
    }
    
    client.release();
    return { success: true, connectionTime, queryTime, totalTime };
    
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
    
    if (error.message.includes('ETIMEDOUT')) {
      console.log(`   🌐 Network timeout - may be IPv4 compatibility issue`);
    } else if (error.message.includes('ENOTFOUND')) {
      console.log(`   🔍 DNS resolution failed`);
    }
    
    return { success: false, error: error.message };
  } finally {
    try {
      await pool.end();
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

async function main() {
  console.log('🔧 Testing Supabase Connection Types for Performance\n');
  console.log('Current Issue: Job creation takes 26+ seconds due to 1466ms connection times');
  console.log('Goal: Find the fastest connection type for your persistent Node.js application\n');
  
  const results = [];
  
  for (const config of connectionTypes) {
    const result = await testConnection(config);
    results.push({ ...config, ...result });
    
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🏆 PERFORMANCE COMPARISON:');
  console.log('='.repeat(60));
  
  const successfulResults = results.filter(r => r.success).sort((a, b) => a.totalTime - b.totalTime);
  
  if (successfulResults.length === 0) {
    console.log('❌ No connections succeeded. Check your network and credentials.');
    return;
  }
  
  successfulResults.forEach((result, index) => {
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
    console.log(`${medal} ${result.name}: ${result.totalTime}ms`);
    
    if (index === 0) {
      console.log(`   🎯 RECOMMENDED: Use this connection for best performance`);
      console.log(`   📋 CONNECTION STRING:`);
      console.log(`   ${result.url.replace(PASSWORD, '[PASSWORD]')}`);
    }
  });
  
  console.log('\n📊 RECOMMENDATION:');
  const fastest = successfulResults[0];
  const current = results.find(r => r.name.includes('CURRENT'));
  
  if (current && current.success && fastest.totalTime < current.totalTime) {
    const improvement = Math.round(((current.totalTime - fastest.totalTime) / current.totalTime) * 100);
    console.log(`✅ Switch to ${fastest.name.replace('🟢 RECOMMENDED: ', '')}`);
    console.log(`🚀 Expected improvement: ${improvement}% faster (${current.totalTime}ms → ${fastest.totalTime}ms)`);
    console.log(`💡 This should significantly improve your job creation times!`);
  } else {
    console.log(`ℹ️  Your current connection type appears to be optimal or others failed to connect.`);
  }
}

main().catch(console.error); 