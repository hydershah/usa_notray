const fs = require('fs');
const path = require('path');

// Check if this is a Supabase environment
const isSupabase = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase');

async function runKBAMigration() {
  console.log('🧠 Running KBA (Knowledge-Based Authentication) Migration...');
  console.log('═'.repeat(60));
  
  try {
    if (isSupabase) {
      console.log('🌐 Detected Supabase environment');
      await runSupabaseKBAMigration();
    } else {
      console.log('🐘 Detected local PostgreSQL environment');
      await runLocalKBAMigration();
    }
  } catch (error) {
    console.error('💥 KBA migration failed:', error.message);
    process.exit(1);
  }
}

async function runLocalKBAMigration() {
  const { Client } = require('pg');
  
  // Read database configuration
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/notary_platform';
  
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    console.log('📡 Connecting to local PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migration-kba-system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing KBA migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ KBA migration completed successfully!');
    
    // Verify the migration by checking if tables exist
    const verifyQuery = `
      SELECT 
        CASE WHEN EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'kba_verified'
        ) THEN 'users_updated' ELSE 'users_not_updated' END as users_status,
        CASE WHEN EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'kba_sessions'
        ) THEN 'table_created' ELSE 'table_not_created' END as kba_sessions_status;
    `;
    
    const verifyResult = await client.query(verifyQuery);
    const status = verifyResult.rows[0];
    
    console.log('🔍 Verification Results:');
    console.log(`   Users table KBA fields: ${status.users_status === 'users_updated' ? '✅' : '❌'}`);
    console.log(`   KBA sessions table: ${status.kba_sessions_status === 'table_created' ? '✅' : '❌'}`);
    
    if (status.users_status === 'users_updated' && status.kba_sessions_status === 'table_created') {
      console.log('🎉 All KBA components successfully installed!');
    } else {
      console.log('⚠️  Some KBA components may not have been installed correctly');
    }

  } catch (error) {
    console.error('❌ Local PostgreSQL migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

async function runSupabaseKBAMigration() {
  const { createClient } = require('@supabase/supabase-js');
  
  // Get Supabase configuration from DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found for Supabase connection');
  }

  // Extract Supabase URL and key
  const urlMatch = databaseUrl.match(/postgresql:\/\/postgres:([^@]+)@([^:]+)/);
  if (!urlMatch) {
    throw new Error('Could not parse Supabase DATABASE_URL');
  }

  const [, password, host] = urlMatch;
  const projectId = host.split('.')[0];
  const supabaseUrl = `https://${projectId}.supabase.co`;
  
  // For migrations, we need the service role key (not the anon key)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY not found, using direct SQL execution');
    await runSupabaseDirectSQL();
    return;
  }

  try {
    console.log('🌐 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migration-kba-system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing KBA migration on Supabase...');
    
    // Execute the migration using RPC (if available) or direct SQL
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    });

    if (error) {
      console.log('💡 RPC method failed, trying direct SQL execution...');
      await runSupabaseDirectSQL();
      return;
    }

    console.log('✅ Supabase KBA migration completed successfully!');
    
    // Verify the migration
    const { data: verifyData, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'users')
      .eq('column_name', 'kba_verified');

    if (verifyData && verifyData.length > 0) {
      console.log('🔍 Verification: ✅ KBA fields added to users table');
    } else {
      console.log('🔍 Verification: ⚠️  Could not verify KBA fields');
    }

  } catch (error) {
    console.error('❌ Supabase migration failed:', error.message);
    console.log('🔄 Falling back to direct SQL execution...');
    await runSupabaseDirectSQL();
  }
}

async function runSupabaseDirectSQL() {
  const { Client } = require('pg');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('📡 Connecting to Supabase via direct PostgreSQL connection...');
    await client.connect();
    console.log('✅ Connected to Supabase database');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migration-kba-system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Executing KBA migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Supabase KBA migration completed successfully!');

  } catch (error) {
    console.error('❌ Supabase direct SQL migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
runKBAMigration()
  .then(() => {
    console.log('\n🚀 KBA system is ready!');
    console.log('📋 Next steps:');
    console.log('   1. Restart your application');
    console.log('   2. KBA verification will be available for signers and witnesses');
    console.log('   3. Configure KBA provider settings in your .env file:');
    console.log('      - KBA_PROVIDER (evs, lexisnexis, transunion)');
    console.log('      - KBA_API_KEY (your provider API key)');
    console.log('      - KBA_ENVIRONMENT (sandbox, production)');
    console.log('   4. Test KBA functionality in the admin panel');
    console.log('\n🧠 KBA Features Available:');
    console.log('   ✅ EVS AssureID integration');
    console.log('   ✅ LexisNexis InstantID support (mock)');
    console.log('   ✅ Real-time question delivery');
    console.log('   ✅ Session timeout management');
    console.log('   ✅ Score-based verification');
    console.log('   ✅ Admin KBA status monitoring');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 KBA migration failed with error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check database connection settings');
    console.log('   2. Ensure database user has CREATE TABLE permissions');
    console.log('   3. Verify migration-kba-system.sql file exists');
    console.log('   4. Check for any syntax errors in the migration file');
    console.log('   5. For Supabase: Ensure SUPABASE_SERVICE_ROLE_KEY is set');
    process.exit(1);
  }); 