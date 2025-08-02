import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function checkColumn() {
  console.log('🔍 Checking if is_signer_request column exists...');
  
  try {
    // Check if the column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND column_name = 'is_signer_request'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Column is_signer_request exists in jobs table');
      
      // Also check the column type
      const typeResult = await db.execute(sql`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'jobs' 
        AND column_name = 'is_signer_request'
      `);
      
      console.log(`📊 Column type: ${typeResult.rows[0]?.data_type}`);
    } else {
      console.log('❌ Column is_signer_request does NOT exist in jobs table');
    }
    
    // Check all columns in jobs table
    const allColumns = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 All columns in jobs table:');
    allColumns.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking column:', error);
  }
}

checkColumn()
  .then(() => {
    console.log('✅ Column check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Column check failed:', error);
    process.exit(1);
  }); 