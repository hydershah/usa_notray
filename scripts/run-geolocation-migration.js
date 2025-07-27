const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection using the same config as the main app
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  console.log('🔧 Running geolocation migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add-geolocation-tracking-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executing migration SQL...');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!');
    
    // Test the new columns
    console.log('🔍 Verifying new columns exist...');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'system_activity_logs' 
      AND column_name IN ('latitude', 'longitude', 'city', 'country', 'timezone')
      ORDER BY column_name;
    `);
    
    console.log('📊 New columns confirmed:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type})`);
    });
    
    console.log('🎉 Geolocation migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('👍 Migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 