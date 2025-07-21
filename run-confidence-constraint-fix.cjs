const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Use the exact database URL from .env file (URL-encoded)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax%40123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';

// Database connection with Supabase SSL configuration
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connections
  },
  max: 1, // Single connection for migration
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function runConfidenceConstraintFix() {
  console.log('🔧 Running EVS Confidence Constraint Fix...\n');
  
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migration-fix-evs-confidence-constraint.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      return;
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📂 Migration file loaded successfully');
    console.log('📄 Migration content:');
    console.log('   - Drop existing evs_verification_confidence constraint (0-100%)');
    console.log('   - Add new evs_verification_confidence constraint (0-200%)');
    console.log('   - Update other confidence constraints for consistency\n');
    
    // Execute migration
    console.log('🚀 Executing migration...');
    const result = await pool.query(migrationSQL);
    
    console.log('✅ Migration executed successfully!\n');
    
    // Verify constraints
    console.log('🔍 Verifying new constraints...');
    const constraintQuery = `
      SELECT 
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'users' 
      AND tc.constraint_name LIKE '%confidence%'
      ORDER BY tc.constraint_name;
    `;
    
    const constraints = await pool.query(constraintQuery);
    
    if (constraints.rows.length > 0) {
      console.log('✅ Updated constraints:');
      constraints.rows.forEach(constraint => {
        console.log(`   - ${constraint.constraint_name}`);
        console.log(`     Check: ${constraint.check_clause}`);
      });
    } else {
      console.log('⚠️  No confidence constraints found (they may have been dropped)');
    }
    
    console.log('\n🎉 EVS confidence constraint fix completed!');
    console.log('   • EVS verification confidence now accepts values 0-200%');
    console.log('   • This resolves the 110% confidence score issue');
    console.log('   • Face match and liveness scores remain 0-100%');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    
    if (error.message.includes('constraint')) {
      console.log('\n💡 Troubleshooting:');
      console.log('   1. Check if constraints already exist');
      console.log('   2. Verify database connection');
      console.log('   3. Ensure proper database permissions');
    }
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runConfidenceConstraintFix()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script error:', error);
      process.exit(1);
    });
}

module.exports = { runConfidenceConstraintFix }; 