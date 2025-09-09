#!/usr/bin/env ts-node

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function runDualRoleMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');
    
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', 'add-job-specific-roles.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running dual role migration...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Dual role migration completed successfully!');
    console.log('');
    console.log('🎉 The following features are now available:');
    console.log('  - Job-specific role assignments');
    console.log('  - Dual role support (e.g., notary as signer)');
    console.log('  - Role-based verification requirements');
    console.log('  - Enhanced participant management');
    console.log('');
    console.log('📋 Next steps:');
    console.log('  1. Update your job creation UI to use EnhancedJobSignersManager');
    console.log('  2. Register the enhanced participant routes');
    console.log('  3. Test dual role scenarios');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runDualRoleMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default runDualRoleMigration;
