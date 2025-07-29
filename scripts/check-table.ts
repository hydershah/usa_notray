import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function checkTable() {
  try {
    console.log('🔍 Checking job_requests table...');
    
    // Check if table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'job_requests'
      );
    `);
    
    console.log('Raw result:', JSON.stringify(tableExists, null, 2));
    
    const exists = tableExists.rows[0]?.exists;
    console.log('Table exists:', exists);
    console.log('Type of exists:', typeof exists);
    
    if (exists === true) {
      // Get column information
      const columns = await db.execute(sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'job_requests'
        ORDER BY ordinal_position;
      `);
      
      console.log('Columns:', columns);
    } else {
      console.log('❌ Table does not exist');
    }
    
  } catch (error) {
    console.error('❌ Error checking table:', error);
  }
}

checkTable()
  .then(() => {
    console.log('✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  }); 