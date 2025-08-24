#!/usr/bin/env npx tsx

import { Pool } from 'pg';

async function addCreatedAtIndex() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔨 Adding missing created_at index...');
    const start = Date.now();
    
    await pool.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users (created_at DESC);');
    
    console.log(`✅ Created idx_users_created_at (${Date.now() - start}ms)`);
    console.log('🎉 Missing index added successfully!');
    
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  Index already exists - skipping');
    } else {
      console.error('❌ Failed to create index:', error);
    }
  } finally {
    await pool.end();
  }
}

addCreatedAtIndex().catch(console.error); 