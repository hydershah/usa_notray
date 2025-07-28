#!/usr/bin/env npx tsx

import { Pool } from 'pg';

async function testQueryPerformance() {
  const DATABASE_URL = 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('🧪 Testing optimized query performance...\n');

  const testQueries = [
    {
      name: 'Users query (optimized - ORDER BY id LIMIT 1000)',
      sql: 'SELECT * FROM users ORDER BY id ASC LIMIT 1000'
    },
    {
      name: 'Users query (old - ORDER BY created_at, no limit)',
      sql: 'SELECT * FROM users ORDER BY created_at ASC'
    },
    {
      name: 'Notaries available (with indexes)',
      sql: 'SELECT * FROM users WHERE role = $1 AND is_active = $2 ORDER BY first_name, last_name LIMIT 100',
      params: ['notary', true]
    },
    {
      name: 'Active closing types (with indexes)',
      sql: 'SELECT * FROM closing_types WHERE is_active = $1 ORDER BY name LIMIT 500',
      params: [true]
    },
    {
      name: 'Active participant roles (with indexes)',
      sql: 'SELECT * FROM participant_roles WHERE is_active = $1 ORDER BY name LIMIT 200',
      params: [true]
    }
  ];

  for (const test of testQueries) {
    try {
      const startTime = Date.now();
      const result = await pool.query(test.sql, test.params || []);
      const queryTime = Date.now() - startTime;
      
      console.log(`🧪 ${test.name}:`);
      console.log(`   ⏱️  ${queryTime}ms (${result.rows.length} rows)`);
      
      if (queryTime < 50) {
        console.log('   ✅ EXCELLENT performance (<50ms)');
      } else if (queryTime < 200) {
        console.log('   ✅ GOOD performance (<200ms)');
      } else if (queryTime < 500) {
        console.log('   ⚠️  ACCEPTABLE performance (<500ms)');
      } else {
        console.log('   ❌ SLOW performance (>500ms) - needs optimization');
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ Test failed: ${error.message}\n`);
    }
  }

  await pool.end();
}

testQueryPerformance().catch(console.error); 