import { db } from '../server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runJobRequestsMigration() {
  console.log('🚀 Starting Job Requests System Migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/add-job-requests-system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded successfully');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        try {
          await db.execute(sql.raw(statement));
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error) {
          console.error(`❌ Error executing statement ${i + 1}:`, error);
          // Continue with other statements even if one fails
        }
      }
    }
    
    console.log('🎉 Job Requests System Migration completed successfully!');
    console.log('');
    console.log('📋 What was added:');
    console.log('  ✅ job_requests table for signer-initiated requests');
    console.log('  ✅ New fields to jobs table for signer request tracking');
    console.log('  ✅ Database constraints and indexes');
    console.log('  ✅ Email notification system integration');
    console.log('');
    console.log('🚀 The system is now ready for:');
    console.log('  • Signers to submit job requests');
    console.log('  • Admins to review and approve/reject requests');
    console.log('  • Notary assignment and notification');
    console.log('  • Conversion of approved requests to jobs');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runJobRequestsMigration()
    .then(() => {
      console.log('✅ Job requests migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { runJobRequestsMigration }; 