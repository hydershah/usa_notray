const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';

async function runMigration() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: false // Supabase handles SSL automatically
  });

  try {
    console.log('🚀 Starting system activity logs migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migration-system-activity-logs.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const client = await pool.connect();
    
    try {
      console.log('📋 Executing migration SQL...');
      const result = await client.query(migrationSQL);
      
      console.log('✅ System activity logs table created successfully!');
      console.log('📊 Migration completed with the following result:', result[result.length - 1]?.rows?.[0] || 'Success');
      
      // Verify the table exists
      const tableCheck = await client.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'system_activity_logs' 
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Table structure verification:');
      console.log('Columns created:', tableCheck.rows.length);
      tableCheck.rows.forEach((col, index) => {
        console.log(`  ${index + 1}. ${col.column_name} (${col.data_type})`);
      });
      
      // Check indexes
      const indexCheck = await client.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'system_activity_logs'
        ORDER BY indexname
      `);
      
      console.log('\n🔍 Indexes created:', indexCheck.rows.length);
      indexCheck.rows.forEach((idx, index) => {
        console.log(`  ${index + 1}. ${idx.indexname}`);
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    console.log('✨ The audit logging system is now ready to use.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }); 