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

async function optimizeSessionParticipants() {
  console.log('🚀 Optimizing Session Participants Query Performance...\n');

  try {
    // Read and execute the optimization SQL
    const sqlContent = readFileSync('./optimize-session-participants.sql', 'utf-8');
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
          const tableName = statement.match(/ANALYZE (\w+)/)?.[1] || 'unknown';
          console.log(`📊 Analyzed table: ${tableName} (${duration}ms)`);
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
    console.log('\n🧪 Testing session participants query performance...');
    const testStart = Date.now();
    
    const testResult = await pool.query(`
      SELECT user_id, is_active, can_interact
      FROM session_participants_status 
      WHERE session_id = 123
      LIMIT 5
    `);
    
    const testDuration = Date.now() - testStart;
    console.log(`⚡ Participants query test: ${testDuration}ms`);
    
    console.log('\n🎉 Session Participants Optimization Complete!');
    console.log('Expected improvements:');
    console.log('   • Participants query: <10ms');
    console.log('   • Overall session state: <100ms for fresh queries');
    console.log('   • Cache hits: <5ms');
    
  } catch (error) {
    console.error('💥 Optimization failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

optimizeSessionParticipants().catch(console.error); 