import { pool } from './server/db.ts';
import fs from 'fs';

async function runSupabaseAdminVerificationMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running Admin Verification Bypass Migration on Supabase...');
    console.log('Adding admin bypass fields and audit functionality to Supabase database...\n');
    
    // Read the admin verification bypass migration
    console.log('📖 Reading migration file...');
    const migrationSQL = fs.readFileSync('./migration-admin-verification-bypass.sql', 'utf8');
    
    console.log('📝 Executing migration SQL on Supabase...');
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully on Supabase!\n');

    // Verify the new columns were added
    console.log('🔍 Verifying admin bypass columns in Supabase...');
    
    const verificationQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND table_schema = 'public'
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
      console.log('📊 Verified admin bypass columns in Supabase:');
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'none'}`);
      });
    } else {
      console.log('⚠️  Could not verify columns - they may already exist');
    }

    // Verify the bypass log table was created
    console.log('\n🔍 Verifying verification_bypass_log table in Supabase...');
    
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'verification_bypass_log'
      AND table_schema = 'public';
    `;
    
    const tableResult = await client.query(tableQuery);
    
    if (tableResult.rows.length > 0) {
      console.log('📊 ✅ verification_bypass_log table created successfully in Supabase');
    } else {
      console.log('⚠️  verification_bypass_log table was not created');
    }

    // Test the admin verification dashboard view
    console.log('\n🔍 Testing admin verification dashboard view in Supabase...');
    
    const viewQuery = `
      SELECT viewname 
      FROM pg_views 
      WHERE viewname = 'admin_verification_dashboard'
      AND schemaname = 'public';
    `;
    
    const viewResult = await client.query(viewQuery);
    
    if (viewResult.rows.length > 0) {
      console.log('📊 ✅ admin_verification_dashboard view created successfully in Supabase');
      
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
    console.log('\n🔍 Testing bypass functions in Supabase...');
    
    const functionsQuery = `
      SELECT proname 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      AND proname IN ('bypass_user_verification', 'remove_verification_bypass');
    `;
    
    const functionsResult = await client.query(functionsQuery);
    
    if (functionsResult.rows.length > 0) {
      console.log('📊 ✅ Bypass functions created successfully in Supabase:');
      functionsResult.rows.forEach(row => {
        console.log(`  ✅ ${row.proname}()`);
      });
    } else {
      console.log('⚠️  Bypass functions were not created');
    }

    // Test a comprehensive query
    console.log('\n🧪 Testing verification system in Supabase...');
    
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
    console.log('📈 Supabase verification system status:');
    console.log(`  Total users: ${testResult.rows[0].total_users}`);
    console.log(`  Require verification: ${testResult.rows[0].requires_verification}`);
    console.log(`  Verified users: ${testResult.rows[0].verified_users}`);
    console.log(`  Admin bypassed: ${testResult.rows[0].bypassed_users}`);
    console.log(`  Pending verification: ${testResult.rows[0].pending_verification}`);

    // Test Supabase RLS policies (if any)
    console.log('\n🔒 Checking Supabase Row Level Security policies...');
    
    const rlsQuery = `
      SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies 
      WHERE schemaname = 'public'
      AND tablename IN ('users', 'verification_bypass_log')
      ORDER BY tablename, policyname;
    `;
    
    const rlsResult = await client.query(rlsQuery);
    
    if (rlsResult.rows.length > 0) {
      console.log('📊 Found RLS policies:');
      rlsResult.rows.forEach(row => {
        console.log(`  🔒 ${row.tablename}.${row.policyname} (${row.cmd})`);
      });
    } else {
      console.log('📊 No RLS policies found for verification tables');
    }

    console.log('\n🎉 Supabase Admin Verification Bypass Migration completed successfully!');
    console.log('✅ Admin bypass fields added to Supabase');
    console.log('✅ Audit logging table created in Supabase');
    console.log('✅ Dashboard view created in Supabase');
    console.log('✅ Bypass functions created in Supabase');
    console.log('✅ Supabase system ready for admin verification management');
    
  } catch (error) {
    console.error('❌ Supabase admin verification migration failed:', error);
    
    // Provide specific error context for common Supabase issues
    if (error.message.includes('permission denied')) {
      console.error('🔒 Permission Error: Make sure your Supabase user has proper database permissions');
    } else if (error.message.includes('already exists')) {
      console.log('ℹ️  Some components may already exist in Supabase - this is usually safe to ignore');
    } else if (error.message.includes('connection')) {
      console.error('🌐 Connection Error: Check your Supabase connection settings and network');
    }
    
    throw error;
  } finally {
    client.release();
  }
}

runSupabaseAdminVerificationMigration()
  .then(() => {
    console.log('\n🚀 Supabase Admin verification system is ready!');
    console.log('📋 Next steps:');
    console.log('   1. Restart the application');
    console.log('   2. Login as admin to access KYC/KBA management');
    console.log('   3. Review users requiring verification in Supabase');
    console.log('   4. Use bypass functionality as needed');
    console.log('   5. Monitor verification_bypass_log table in Supabase dashboard');
    console.log('\n🌐 Supabase Dashboard: https://ueoqbwsigpowzbdlqezz.supabase.co');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Supabase migration failed with error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check Supabase connection in server/db.ts');
    console.log('   2. Verify database permissions in Supabase dashboard');
    console.log('   3. Ensure migration file exists: migration-admin-verification-bypass.sql');
    console.log('   4. Check network connectivity to Supabase');
    process.exit(1);
  }); 