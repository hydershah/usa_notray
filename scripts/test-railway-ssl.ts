import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

// Set the SSL environment variable programmatically
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function testRailwaySSL() {
  console.log('🧪 Testing Railway SSL connection...');
  console.log('Environment variables:');
  console.log('  NODE_TLS_REJECT_UNAUTHORIZED:', process.env.NODE_TLS_REJECT_UNAUTHORIZED);
  console.log('  Database URL contains railway:', process.env.DATABASE_URL?.includes('rlwy.net'));
  
  try {
    console.log('📡 Testing basic connection...');
    const result = await db.execute(sql`SELECT current_database(), version();`);
    console.log('✅ Basic connection successful!');
    
    // Test table creation (this was failing in CertificateService)
    console.log('📋 Testing table creation...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS test_ssl_table (
        id SERIAL PRIMARY KEY,
        test_data TEXT
      );
    `);
    console.log('✅ Table creation successful!');
    
    // Clean up
    await db.execute(sql`DROP TABLE IF EXISTS test_ssl_table;`);
    console.log('✅ Cleanup successful!');
    
    console.log('🎉 Railway SSL connection fully working!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Railway SSL test failed:', error);
    process.exit(1);
  }
}

testRailwaySSL();
