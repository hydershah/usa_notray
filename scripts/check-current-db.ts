import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';

async function checkCurrentDatabase() {
  console.log('🔍 Checking current database connection...');
  
  try {
    const result = await db.execute(sql`SELECT 
      current_database() as database_name,
      inet_server_addr() as host,
      inet_server_port() as port,
      version() as version;
    `);
    
    console.log('✅ Database Connection Info:');
    console.log('Database:', result[0]?.database_name);
    console.log('Host:', result[0]?.host || 'Not available');
    console.log('Port:', result[0]?.port || 'Not available');
    console.log('Version:', result[0]?.version?.split(' ')[0]);
    
    // Check if it's Railway or local
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.includes('rlwy.net') || dbUrl.includes('railway')) {
      console.log('🚂 Using: Railway PostgreSQL (Cloud)');
    } else if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
      console.log('🏠 Using: Local PostgreSQL');
    } else {
      console.log('🌐 Using: Remote PostgreSQL');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    process.exit(1);
  }
}

checkCurrentDatabase();
