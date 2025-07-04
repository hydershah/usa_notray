const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/notary_db',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running participant roles migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migration-participant-roles-system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Participant roles migration completed successfully!');
    console.log('📋 Default roles created:');
    console.log('   - Borrower (Signs documents)');
    console.log('   - Co-Borrower (Signs documents)');
    console.log('   - Seller (Signs documents)');
    console.log('   - Buyer (Signs documents)');
    console.log('   - Witness (Observes signing)');
    console.log('   - Observer (Observes only)');
    console.log('   - Guardian (Signs for minor)');
    console.log('   - Attorney (Power of Attorney)');
    console.log('   - Trustee (Trust representative)');
    console.log('   - Corporate Officer');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration(); 