import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addMissingColumn() {
  console.log('🔧 Adding missing is_signer_request column...');
  
  try {
    // Add the missing column
    await db.execute(sql`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_signer_request BOOLEAN DEFAULT false
    `);
    
    console.log('✅ Column is_signer_request added successfully');
    
    // Verify the column was added
    const result = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND column_name = 'is_signer_request'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verification successful:');
      console.log(`  - Column: ${result.rows[0].column_name}`);
      console.log(`  - Type: ${result.rows[0].data_type}`);
      console.log(`  - Default: ${result.rows[0].column_default}`);
    } else {
      console.log('❌ Column was not added properly');
    }
    
  } catch (error) {
    console.error('❌ Error adding column:', error);
  }
}

addMissingColumn()
  .then(() => {
    console.log('✅ Column addition completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Column addition failed:', error);
    process.exit(1);
  }); 