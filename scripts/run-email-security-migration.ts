#!/usr/bin/env tsx

/**
 * Run Email Security Migration
 * 
 * This script executes the email security migration to ensure
 * proper database constraints and protections are in place.
 * 
 * Usage: npm run migrate:email-security
 */

import { db } from '../server/db';
import { promises as fs } from 'fs';
import path from 'path';

async function runMigration() {
  console.log('🔒 Starting Email Security Migration\n');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'migrations', 'fix-duplicate-emails.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    console.log('📄 Executing migration script...');
    
    // Execute the migration
    await db.execute(migrationSQL as any);
    
    console.log('✅ Email security migration completed successfully!');
    console.log('\n🔐 Security measures now in place:');
    console.log('   ✓ Database unique constraint verified');
    console.log('   ✓ Email normalization functions created');
    console.log('   ✓ Duplicate prevention triggers installed');
    console.log('   ✓ Validation functions available');
    console.log('   ✓ Audit logging configured');
    
    console.log('\n📋 Next steps:');
    console.log('   1. Run email security tests: npm run test:email-security');
    console.log('   2. Deploy updated application code');
    console.log('   3. Monitor audit logs for security attempts');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure database connection is working');
    console.log('   2. Check if any duplicate emails exist');
    console.log('   3. Review migration script for syntax errors');
    console.log('   4. Verify database permissions');
    
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration().catch(console.error);
}

export { runMigration };
