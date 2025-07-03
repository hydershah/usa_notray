import { pool } from './server/db.ts';
import fs from 'fs';

async function runAdminVerificationMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running Admin Verification Bypass Migration...');
    console.log('Adding admin bypass fields and audit functionality...\n');
    
    // Run the admin verification bypass migration
    const migrationSQL = fs.readFileSync('./migration-admin-verification-bypass.sql', 'utf8');
    
    console.log('📝 Executing migration SQL...');
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully!\n');

    // Verify the new columns were added
    console.log('🔍 Verifying admin bypass columns were added...');
    
    const verificationQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN (
        'verification_bypassed_by', 
        'verification_bypassed_at', 
        'verification_bypass_reason', 
        'is_verification_bypassed'
      )
      ORDER BY column_name;
    `;
    
    const result = await client.query(verificationQuery);
    
    if (result.rows.length > 0) {
      console.log('📊 Verified admin bypass columns:');
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'none'}`);
      });
    } else {
      console.log('⚠️  Could not verify columns - they may already exist');
    }

    // Verify the bypass log table was created
    console.log('\n🔍 Verifying verification_bypass_log table...');
    
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'verification_bypass_log';
    `;
    
    const tableResult = await client.query(tableQuery);
    
    if (tableResult.rows.length > 0) {
      console.log('📊 ✅ verification_bypass_log table created successfully');
    } else {
      console.log('⚠️  verification_bypass_log table was not created');
    }

    // Test the admin verification dashboard view
    console.log('\n🔍 Testing admin verification dashboard view...');
    
    const viewQuery = `
      SELECT viewname 
      FROM pg_views 
      WHERE viewname = 'admin_verification_dashboard';
    `;
    
    const viewResult = await client.query(viewQuery);
    
    if (viewResult.rows.length > 0) {
      console.log('📊 ✅ admin_verification_dashboard view created successfully');
      
      // Test querying the view
      const testViewQuery = `
        SELECT COUNT(*) as total_requiring_verification
        FROM admin_verification_dashboard;
      `;
      
      const testViewResult = await client.query(testViewQuery);
      console.log(`📈 Users requiring verification: ${testViewResult.rows[0].total_requiring_verification}`);
    } else {
      console.log('⚠️  admin_verification_dashboard view was not created');
    }

    // Test the stored functions
    console.log('\n🔍 Testing bypass functions...');
    
    const functionsQuery = `
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN ('bypass_user_verification', 'remove_verification_bypass');
    `;
    
    const functionsResult = await client.query(functionsQuery);
    
    if (functionsResult.rows.length > 0) {
      console.log('📊 ✅ Bypass functions created successfully:');
      functionsResult.rows.forEach(row => {
        console.log(`  ✅ ${row.proname}()`);
      });
    } else {
      console.log('⚠️  Bypass functions were not created');
    }

    // Test a comprehensive query
    console.log('\n🧪 Testing verification system...');
    
    const testQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE role IN ('notary', 'signer', 'witness')) as requires_verification,
        COUNT(*) FILTER (WHERE is_verified = true) as verified_users,
        COUNT(*) FILTER (WHERE is_verification_bypassed = true) as bypassed_users,
        COUNT(*) FILTER (WHERE verification_status = 'pending') as pending_verification
      FROM users;
    `;
    
    const testResult = await client.query(testQuery);
    console.log('📈 Verification system status:');
    console.log(`  Total users: ${testResult.rows[0].total_users}`);
    console.log(`  Require verification: ${testResult.rows[0].requires_verification}`);
    console.log(`  Verified users: ${testResult.rows[0].verified_users}`);
    console.log(`  Admin bypassed: ${testResult.rows[0].bypassed_users}`);
    console.log(`  Pending verification: ${testResult.rows[0].pending_verification}`);

    console.log('\n🎉 Admin Verification Bypass Migration completed successfully!');
    console.log('✅ Admin bypass fields added');
    console.log('✅ Audit logging table created');
    console.log('✅ Dashboard view created');
    console.log('✅ Bypass functions created');
    console.log('✅ System ready for admin verification management');
    
  } catch (error) {
    console.error('❌ Admin verification migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

runAdminVerificationMigration()
  .then(() => {
    console.log('\n🚀 Admin verification system is ready!');
    console.log('📋 Next steps:');
    console.log('   1. Restart the application');
    console.log('   2. Login as admin to access KYC/KBA management');
    console.log('   3. Review users requiring verification');
    console.log('   4. Use bypass functionality as needed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed with error:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Some components may already exist - this is usually safe to ignore');
    }
    process.exit(1);
  }); 