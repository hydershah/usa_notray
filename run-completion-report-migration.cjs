const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration for Supabase
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting completion report fields migration...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migration-add-completion-report-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    await client.query('BEGIN');
    
    // Execute the entire migration as one statement to handle DO blocks
    console.log('Executing migration...');
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    
    // Verify the changes
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND column_name IN ('completion_report_path', 'completion_report_generated_at')
      ORDER BY column_name
    `);
    
    console.log('\n📋 Added columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check indexes
    const indexResult = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'jobs' 
      AND indexname = 'idx_jobs_completion_report'
    `);
    
    if (indexResult.rows.length > 0) {
      console.log('\n📊 Created index:');
      console.log(`  - ${indexResult.rows[0].indexname}`);
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
if (require.main === module) {
  runMigration().catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigration }; 