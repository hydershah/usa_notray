import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function testConnection() {
  console.log('🧪 Testing Railway database connection...');
  
  try {
    console.log('📡 Attempting to connect...');
    const result = await db.execute(sql`SELECT current_database(), version();`);
    console.log('✅ Connection successful!');
    console.log('Database info:', result[0]);
    
    // Test a simple query
    const userCount = await db.execute(sql`SELECT COUNT(*) FROM users;`);
    console.log('👥 Users in database:', userCount[0]?.count || 0);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

testConnection();
