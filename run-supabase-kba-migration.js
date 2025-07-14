import { pool } from './server/db.ts';
import fs from 'fs';

async function runSupabaseKBAMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🧠 Running KBA Migration on Supabase...');
    console.log('Adding KBA (Knowledge-Based Authentication) system to Supabase database...\n');
    
    // Step 1: Read and execute the base KBA migration
    console.log('📖 Reading base KBA migration file...');
    const baseMigrationSQL = fs.readFileSync('./migration-kba-system.sql', 'utf8');
    
    console.log('📝 Executing base KBA migration SQL on Supabase...');
    await client.query(baseMigrationSQL);
    console.log('✅ Base KBA migration executed successfully on Supabase!\n');

    // Step 2: Read and execute the legal compliance migration
    console.log('📖 Reading legal compliance migration file...');
    const legalMigrationSQL = fs.readFileSync('./migration-kba-legal-compliance.sql', 'utf8');
    
    console.log('📝 Executing legal compliance migration SQL on Supabase...');
    await client.query(legalMigrationSQL);
    console.log('✅ Legal compliance migration executed successfully on Supabase!\n');

    // Step 3: Verify the KBA system was set up correctly
    console.log('🔍 Verifying KBA system setup in Supabase...');
    
    // Check if KBA columns were added to users table
    const userColumnsQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND table_schema = 'public'
      AND column_name LIKE 'kba%'
      ORDER BY column_name;
    `;
    
    const userColumns = await client.query(userColumnsQuery);
    console.log('📋 KBA columns in users table:');
    userColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Check if kba_sessions table was created
    const kbaSessionsQuery = `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kba_sessions' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    const kbaSessionsColumns = await client.query(kbaSessionsQuery);
    console.log('\n📋 KBA sessions table columns:');
    kbaSessionsColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Check if kba_lockout_log table was created
    const lockoutLogQuery = `
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'kba_lockout_log' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    const lockoutLogColumns = await client.query(lockoutLogQuery);
    console.log('\n📋 KBA lockout log table columns:');
    lockoutLogColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    // Check if KBA functions were created
    const functionsQuery = `
      SELECT routine_name, routine_type
      FROM information_schema.routines 
      WHERE routine_schema = 'public'
      AND routine_name LIKE '%kba%'
      ORDER BY routine_name;
    `;
    
    const functions = await client.query(functionsQuery);
    console.log('\n📋 KBA functions created:');
    functions.rows.forEach(func => {
      console.log(`   - ${func.routine_name} (${func.routine_type})`);
    });
    
    // Check system settings
    const settingsQuery = `
      SELECT key, value, description 
      FROM system_settings 
      WHERE key LIKE 'kba%'
      ORDER BY key;
    `;
    
    const settings = await client.query(settingsQuery);
    console.log('\n📋 KBA system settings:');
    settings.rows.forEach(setting => {
      console.log(`   - ${setting.key}: ${setting.value} (${setting.description})`);
    });
    
    console.log('\n🎉 KBA System Migration Completed Successfully!');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('✅ Base KBA system installed');
    console.log('✅ Legal compliance features added');
    console.log('✅ Database tables created:');
    console.log('   - Enhanced users table with KBA fields');
    console.log('   - kba_sessions table for session tracking');
    console.log('   - kba_lockout_log table for audit compliance');
    console.log('✅ Legal compliance functions created:');
    console.log('   - is_user_kba_locked() - Check lockout status');
    console.log('   - apply_kba_lockout() - Apply 24-hour lockout');
    console.log('   - increment_kba_attempts() - Track attempts');
    console.log('   - unlock_kba_user() - Admin unlock function');
    console.log('✅ System settings configured for legal compliance');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('🔗 Next Steps:');
    console.log('   1. Update KBA service to use legal compliance functions');
    console.log('   2. Test KBA verification flow');
    console.log('   3. Verify 24-hour lockout works correctly');
    console.log('   4. Test admin unlock functionality');
    console.log('');
    
  } catch (error) {
    console.error('❌ KBA Migration failed:', error.message);
    console.error('💡 Common issues:');
    console.error('   - Database connection problems');
    console.error('   - Missing migration files');
    console.error('   - Conflicting table structures');
    console.error('   - Permission issues');
    console.error('');
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
runSupabaseKBAMigration()
  .then(() => {
    console.log('🏁 Migration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }); 