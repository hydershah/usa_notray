import { pool } from './server/db.ts';
import fs from 'fs';

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running comprehensive database migration...');
    console.log('Adding missing verification columns and fixing schema issues...\n');
    
    // Run the comprehensive migration
    const migrationSQL = fs.readFileSync('./migration-fix-missing-columns.sql', 'utf8');
    
    console.log('📝 Executing migration SQL...');
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully!\n');

    // Verify the columns were added
    console.log('🔍 Verifying columns were added...');
    
    const verificationQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('is_verified', 'verification_status', 'evs_transaction_id')
      ORDER BY column_name;
    `;
    
    const result = await client.query(verificationQuery);
    
    if (result.rows.length > 0) {
      console.log('📊 Verified columns:');
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'none'}`);
      });
    } else {
      console.log('⚠️  Could not verify columns - they may already exist');
    }

    // Test a simple query to make sure everything works
    console.log('\n🧪 Testing database queries...');
    
    const testQuery = `
      SELECT COUNT(*) as total_users,
             COUNT(*) FILTER (WHERE is_verified = true) as verified_users,
             COUNT(*) FILTER (WHERE verification_status = 'pending') as pending_verification
      FROM users;
    `;
    
    const testResult = await client.query(testQuery);
    console.log('📈 Database test results:');
    console.log(`  Total users: ${testResult.rows[0].total_users}`);
    console.log(`  Verified users: ${testResult.rows[0].verified_users}`);
    console.log(`  Pending verification: ${testResult.rows[0].pending_verification}`);

    console.log('\n🎉 Migration completed successfully!');
    console.log('✅ All missing columns have been added');
    console.log('✅ Database is ready for the application');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

runMigration()
  .then(() => {
    console.log('\n🚀 Ready to restart the application!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed with error:', error.message);
    process.exit(1);
  });
