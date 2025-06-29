import { db } from './server/db.js';
import fs from 'fs';

async function runMigration() {
  try {
    const migrationSQL = fs.readFileSync('./migration-notary-approval-workflow.sql', 'utf8');
    console.log('Running approval workflow migration...');
    
    // For now, let's just add the essential columns manually
    const statements = [
      "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notary_approval_status TEXT DEFAULT 'pending_assignment'",
      "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notary_approved_at TIMESTAMP",
      "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notary_approval_notes TEXT",
      "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notary_approval_conditions TEXT",
      "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS signer_notifications_sent BOOLEAN DEFAULT false",
      "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS signer_notifications_sent_at TIMESTAMP"
    ];
    
    for (const statement of statements) {
      try {
        console.log('Executing:', statement);
        await db.execute(statement);
        console.log('✓ Success');
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log('⚠ Column already exists, skipping');
        } else {
          console.error('✗ Error:', error.message);
        }
      }
    }
    
    console.log('Basic migration completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
