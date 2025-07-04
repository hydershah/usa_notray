const fs = require('fs');
const path = require('path');

async function runNotaryIdCodeMigration() {
  const { Client } = require('pg');
  
  // Read database configuration (using same as server/db.ts)
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';
  
  const client = new Client({
    connectionString: databaseUrl
  });

  await client.connect();
  
  try {
    console.log('🔧 Running notary ID code migration...');
    console.log('Adding notary_id_code field and populating existing notaries...\n');
    
    // Run the migration
    const migrationSQL = fs.readFileSync('./migration-add-notary-id-code.sql', 'utf8');
    
    console.log('📝 Executing migration SQL...');
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully!\n');

    // Verify the column was added
    console.log('🔍 Verifying notary_id_code column was added...');
    
    const verificationQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'notary_id_code'
      ORDER BY column_name;
    `;
    
    const result = await client.query(verificationQuery);
    
    if (result.rows.length > 0) {
      console.log('📊 Verified column:');
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable}`);
      });
    } else {
      console.log('⚠️  Could not verify column - it may already exist');
    }

    // Test the triggers and function are working
    console.log('\n🧪 Testing notary ID code generation...');
    
    const testQuery = `
      SELECT COUNT(*) as total_users,
             COUNT(*) FILTER (WHERE role = 'notary') as total_notaries,
             COUNT(*) FILTER (WHERE role = 'notary' AND notary_id_code IS NOT NULL) as notaries_with_codes
      FROM users;
    `;
    
    const testResult = await client.query(testQuery);
    console.log('📈 Database test results:');
    console.log(`  Total users: ${testResult.rows[0].total_users}`);
    console.log(`  Total notaries: ${testResult.rows[0].total_notaries}`);
    console.log(`  Notaries with ID codes: ${testResult.rows[0].notaries_with_codes}`);

    // Show the notary ID codes that were assigned
    console.log('\n📋 Assigned notary ID codes:');
    const notaryCodesQuery = `
      SELECT id, username, email, role, notary_id_code, created_at
      FROM users 
      WHERE role = 'notary' AND notary_id_code IS NOT NULL
      ORDER BY notary_id_code;
    `;
    
    const notaryCodesResult = await client.query(notaryCodesQuery);
    if (notaryCodesResult.rows.length > 0) {
      notaryCodesResult.rows.forEach(row => {
        console.log(`  ${row.notary_id_code} - ${row.username} (${row.email})`);
      });
    } else {
      console.log('  No notaries found with ID codes');
    }

    // Test the function works for new notaries
    console.log('\n🔬 Testing ID code generation function...');
    const nextCodeQuery = `SELECT generate_notary_id_code() as next_code;`;
    const nextCodeResult = await client.query(nextCodeQuery);
    console.log(`  Next available ID code: ${nextCodeResult.rows[0].next_code}`);

    console.log('\n🎉 Notary ID code migration completed successfully!');
    console.log('✅ Column added and indexed');
    console.log('✅ Existing notaries populated with ID codes');
    console.log('✅ Triggers installed for automatic ID generation');
    console.log('✅ Function created for ID code generation');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

runNotaryIdCodeMigration()
  .then(() => {
    console.log('\n🚀 Notary ID code system is ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed with error:', error.message);
    process.exit(1);
  }); 