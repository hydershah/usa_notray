#!/usr/bin/env node

// Simple database performance test
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 5
});

async function testPerformance() {
  console.log('🔍 Testing database performance...');
  
  const tests = [
    { name: 'Simple SELECT', query: 'SELECT 1' },
    { name: 'Users count', query: 'SELECT COUNT(*) FROM users' },
    { name: 'Jobs count', query: 'SELECT COUNT(*) FROM jobs' },
    { name: 'Recent jobs', query: 'SELECT id, title_company, created_at FROM jobs ORDER BY created_at DESC LIMIT 10' }
  ];
  
  for (const test of tests) {
    const start = Date.now();
    try {
      await pool.query(test.query);
      const duration = Date.now() - start;
      
      if (duration < 100) {
        console.log(`✅ ${test.name}: ${duration}ms (FAST)`);
      } else if (duration < 500) {
        console.log(`⚠️  ${test.name}: ${duration}ms (OK)`);
      } else {
        console.log(`🐌 ${test.name}: ${duration}ms (SLOW)`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    }
  }
  
  console.log('');
  console.log('📊 Connection Pool Stats:');
  console.log(`   Total: ${pool.totalCount}`);
  console.log(`   Idle: ${pool.idleCount}`);
  console.log(`   Waiting: ${pool.waitingCount}`);
  
  await pool.end();
}

if (require.main === module) {
  testPerformance().catch(console.error);
}

module.exports = { testPerformance };
