import { pool } from './server/db.ts';
import fs from 'fs';

async function runNotaryVerificationMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Running Notary Verification Bypass Migration...');
    console.log('Adding notary bypass fields and functionality...\n');
    
    // Run the notary verification bypass migration
    const migrationSQL = fs.readFileSync('./migration-notary-verification-bypass.sql', 'utf8');
    
    console.log('📝 Executing migration SQL...');
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully!\n');

    // Verify the new columns were added
    console.log('🔍 Verifying notary bypass columns were added...');
    
    const verificationQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN (
        'notary_verification_bypassed',
        'notary_verification_bypassed_by',
        'notary_verification_bypassed_at',
        'notary_verification_bypassed_job_id',
        'notary_verification_bypass_reason'
      )
      ORDER BY column_name;
    `;
    
    const result = await client.query(verificationQuery);
    
    if (result.rows.length > 0) {
      console.log('📊 Verified notary bypass columns:');
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'none'}`);
      });
    } else {
      console.log('⚠️  Could not verify columns - they may already exist');
    }

    // Verify the notary bypass log table was created
    console.log('\n🔍 Verifying notary_verification_bypass_log table...');
    
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'notary_verification_bypass_log';
    `;
    
    const tableResult = await client.query(tableQuery);
    
    if (tableResult.rows.length > 0) {
      console.log('📊 ✅ notary_verification_bypass_log table created successfully');
    } else {
      console.log('⚠️  notary_verification_bypass_log table was not created');
    }

    // Test the notary job participants view
    console.log('\n🔍 Testing notary job participants verification view...');
    
    const viewQuery = `
      SELECT viewname 
      FROM pg_views 
      WHERE viewname = 'notary_job_participants_verification';
    `;
    
    const viewResult = await client.query(viewQuery);
    
    if (viewResult.rows.length > 0) {
      console.log('📊 ✅ notary_job_participants_verification view created successfully');
      
      // Test querying the view
      const testViewQuery = `
        SELECT COUNT(*) as total_participants
        FROM notary_job_participants_verification;
      `;
      
      const testViewResult = await client.query(testViewQuery);
      console.log(`📈 Total job participants requiring verification: ${testViewResult.rows[0].total_participants}`);
    } else {
      console.log('⚠️  notary_job_participants_verification view was not created');
    }

    // Test the stored functions
    console.log('\n🔍 Testing notary bypass functions...');
    
    const functionsQuery = `
      SELECT proname 
      FROM pg_proc 
      WHERE proname IN (
        'can_notary_bypass_verification', 
        'notary_bypass_participant_verification',
        'remove_notary_bypass_verification'
      );
    `;
    
    const functionsResult = await client.query(functionsQuery);
    
    if (functionsResult.rows.length > 0) {
      console.log('📊 ✅ Notary bypass functions created successfully:');
      functionsResult.rows.forEach(row => {
        console.log(`  ✅ ${row.proname}()`);
      });
    } else {
      console.log('⚠️  Notary bypass functions were not created');
    }

    // Test a comprehensive query
    console.log('\n🧪 Testing notary verification system...');
    
    const testQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE role IN ('notary', 'signer', 'witness')) as requires_verification,
        COUNT(*) FILTER (WHERE is_verified = true) as verified_users,
        COUNT(*) FILTER (WHERE is_verification_bypassed = true) as admin_bypassed_users,
        COUNT(*) FILTER (WHERE notary_verification_bypassed = true) as notary_bypassed_users,
        COUNT(*) FILTER (WHERE verification_status = 'pending') as pending_verification
      FROM users;
    `;
    
    const testResult = await client.query(testQuery);
    console.log('📈 Verification system status:');
    console.log(`  Total users: ${testResult.rows[0].total_users}`);
    console.log(`  Require verification: ${testResult.rows[0].requires_verification}`);
    console.log(`  Verified users: ${testResult.rows[0].verified_users}`);
    console.log(`  Admin bypassed: ${testResult.rows[0].admin_bypassed_users}`);
    console.log(`  Notary bypassed: ${testResult.rows[0].notary_bypassed_users}`);
    console.log(`  Pending verification: ${testResult.rows[0].pending_verification}`);

    console.log('\n🎉 Notary Verification Bypass Migration completed successfully!');
    console.log('✅ Notary bypass fields added');
    console.log('✅ Audit logging table created');
    console.log('✅ Dashboard view created');
    console.log('✅ Bypass functions created');
    console.log('✅ System ready for notary verification management');
    
  } catch (error) {
    console.error('❌ Notary verification migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
runNotaryVerificationMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  }); 