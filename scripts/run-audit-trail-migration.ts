import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function runAuditTrailMigration() {
  console.log('🚀 Starting audit trail schema enhancement migration...');

  try {
    // Add new columns to audit_trail table
    console.log('📝 Adding new columns to audit_trail table...');
    
    await db.execute(sql`
      ALTER TABLE audit_trail 
      ADD COLUMN IF NOT EXISTS user_role TEXT NOT NULL DEFAULT 'unknown',
      ADD COLUMN IF NOT EXISTS ip_address TEXT,
      ADD COLUMN IF NOT EXISTS device_fingerprint TEXT,
      ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'unknown_event',
      ADD COLUMN IF NOT EXISTS event_details TEXT,
      ADD COLUMN IF NOT EXISTS coordinates_page_reference TEXT,
      ADD COLUMN IF NOT EXISTS previous_state JSONB,
      ADD COLUMN IF NOT EXISTS new_state JSONB,
      ADD COLUMN IF NOT EXISTS authentication_method TEXT,
      ADD COLUMN IF NOT EXISTS verification_result TEXT,
      ADD COLUMN IF NOT EXISTS credential_reference TEXT,
      ADD COLUMN IF NOT EXISTS seal_applied JSONB,
      ADD COLUMN IF NOT EXISTS notary_certificate_reference TEXT,
      ADD COLUMN IF NOT EXISTS digital_signature_hash TEXT,
      ADD COLUMN IF NOT EXISTS system_source TEXT DEFAULT 'RON_PLATFORM',
      ADD COLUMN IF NOT EXISTS audit_log_integrity_hash TEXT,
      ADD COLUMN IF NOT EXISTS retention_metadata JSONB DEFAULT '{"retentionYears": 10, "policy": "WORM"}',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    `);

    console.log('✅ Audit trail columns added successfully');

    // Add audit trail report fields to jobs table
    console.log('📝 Adding audit trail report fields to jobs table...');
    
    await db.execute(sql`
      ALTER TABLE jobs 
      ADD COLUMN IF NOT EXISTS audit_trail_report_path TEXT,
      ADD COLUMN IF NOT EXISTS audit_trail_generated_at TIMESTAMP;
    `);

    console.log('✅ Jobs table audit trail fields added successfully');

    // Update existing audit trail entries
    console.log('📝 Updating existing audit trail entries...');
    
    await db.execute(sql`
      UPDATE audit_trail 
      SET 
        user_role = COALESCE(
          (SELECT role FROM users WHERE users.id = audit_trail.user_id), 
          'unknown'
        ),
        event_type = COALESCE(action, 'legacy_action'),
        system_source = 'RON_PLATFORM',
        retention_metadata = '{"retentionYears": 10, "policy": "WORM"}'::jsonb,
        created_at = COALESCE(timestamp, NOW()),
        updated_at = COALESCE(timestamp, NOW())
      WHERE user_role IS NULL OR user_role = 'unknown' OR event_type IS NULL OR event_type = 'unknown_event';
    `);

    console.log('✅ Existing audit trail entries updated successfully');

    // Create indexes for better performance
    console.log('📝 Creating performance indexes...');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_audit_trail_session_id ON audit_trail(session_id);',
      'CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_audit_trail_event_type ON audit_trail(event_type);',
      'CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON audit_trail(timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_audit_trail_document_id ON audit_trail(document_id) WHERE document_id IS NOT NULL;',
      'CREATE INDEX IF NOT EXISTS idx_audit_trail_user_role ON audit_trail(user_role);',
      'CREATE INDEX IF NOT EXISTS idx_audit_trail_system_source ON audit_trail(system_source);',
      'CREATE INDEX IF NOT EXISTS idx_jobs_audit_trail_report_path ON jobs(audit_trail_report_path) WHERE audit_trail_report_path IS NOT NULL;'
    ];

    for (const indexSql of indexes) {
      await db.execute(sql.raw(indexSql));
    }

    console.log('✅ Performance indexes created successfully');

    // Create integrity hash function
    console.log('📝 Creating audit integrity hash function...');
    
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION generate_audit_integrity_hash()
      RETURNS TRIGGER AS $$
      BEGIN
          -- Generate a simple integrity hash based on key fields
          NEW.audit_log_integrity_hash := encode(
              digest(
                  COALESCE(NEW.session_id::text, '') || '-' ||
                  COALESCE(NEW.user_id::text, '') || '-' ||
                  COALESCE(NEW.event_type, '') || '-' ||
                  COALESCE(extract(epoch from NEW.timestamp)::text, ''),
                  'sha256'
              ),
              'hex'
          );
          
          -- Set updated_at timestamp
          NEW.updated_at := NOW();
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✅ Audit integrity hash function created successfully');

    // Create or replace trigger
    console.log('📝 Creating audit integrity trigger...');
    
    await db.execute(sql`
      DROP TRIGGER IF EXISTS audit_trail_integrity_trigger ON audit_trail;
    `);
    
    await db.execute(sql`
      CREATE TRIGGER audit_trail_integrity_trigger
          BEFORE INSERT OR UPDATE ON audit_trail
          FOR EACH ROW
          EXECUTE FUNCTION generate_audit_integrity_hash();
    `);

    console.log('✅ Audit integrity trigger created successfully');

    // Create detailed audit trail view
    console.log('📝 Creating detailed audit trail view...');
    
    await db.execute(sql`
      CREATE OR REPLACE VIEW audit_trail_detailed AS
      SELECT 
          at.*,
          u.first_name || ' ' || u.last_name AS user_full_name,
          u.email AS user_email,
          jd.original_name AS document_name,
          es.session_type,
          j.id AS job_id,
          j.title_company,
          j.closing_type
      FROM audit_trail at
      LEFT JOIN users u ON at.user_id = u.id
      LEFT JOIN job_documents jd ON at.document_id = jd.id
      LEFT JOIN editor_sessions es ON at.session_id = es.id
      LEFT JOIN jobs j ON es.job_id = j.id;
    `);

    console.log('✅ Detailed audit trail view created successfully');

    // Insert a system audit entry to mark the schema enhancement
    console.log('📝 Creating system audit entry...');
    
    const sessionExists = await db.execute(sql`SELECT 1 FROM editor_sessions LIMIT 1;`);
    const adminUserExists = await db.execute(sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1;`);

    if (sessionExists.length > 0 && adminUserExists.length > 0) {
      const firstSession = await db.execute(sql`SELECT id FROM editor_sessions LIMIT 1;`);
      const firstAdmin = adminUserExists[0] as any;

      await db.execute(sql`
        INSERT INTO audit_trail (
            session_id,
            user_id,
            user_role,
            event_type,
            event_details,
            system_source,
            timestamp
        ) VALUES (
            ${(firstSession[0] as any).id},
            ${firstAdmin.id},
            'system',
            'schema_enhancement',
            'Enhanced audit trail schema for comprehensive RON platform audit requirements',
            'DATABASE_MIGRATION',
            NOW()
        );
      `);

      console.log('✅ System audit entry created successfully');
    } else {
      console.log('ℹ️ Skipped system audit entry - no sessions or admin users found');
    }

    console.log('🎉 Audit trail schema enhancement migration completed successfully!');
    console.log('');
    console.log('📋 Migration Summary:');
    console.log('   ✅ Enhanced audit_trail table with RON platform fields');
    console.log('   ✅ Added audit trail report fields to jobs table');
    console.log('   ✅ Updated existing audit trail entries');
    console.log('   ✅ Created performance indexes');
    console.log('   ✅ Set up automatic integrity hash generation');
    console.log('   ✅ Created detailed audit trail view');
    console.log('   ✅ Added system audit entry');
    console.log('');
    console.log('🚀 The audit trail system is now ready for comprehensive RON compliance!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runAuditTrailMigration().then(() => {
  console.log('Migration completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
