#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Database connection
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.DATABASE_CONNECTION_STRING,
  });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read the migration file
    const migrationPath = path.join(__dirname, 'migration-title-company-notary-assignments.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running title company notary assignment migration...');
    
    // Run the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');

    // Verify the migration
    console.log('🔍 Verifying migration...');
    
    // Check if tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('title_company_notary_assignments', 'legacy_title_company_notary_assignments')
      ORDER BY table_name;
    `);

    if (tablesResult.rows.length >= 2) {
      console.log('✅ Tables created successfully:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('❌ Expected tables not found');
    }

    // Check if data was migrated
    const assignmentsResult = await client.query(`
      SELECT COUNT(*) as count FROM title_company_notary_assignments;
    `);

    const legacyAssignmentsResult = await client.query(`
      SELECT COUNT(*) as count FROM legacy_title_company_notary_assignments;
    `);

    console.log(`📊 Migration results:`);
    console.log(`   - ${assignmentsResult.rows[0].count} assignments in main table`);
    console.log(`   - ${legacyAssignmentsResult.rows[0].count} assignments in legacy table`);

    // Show sample data if any exists
    if (parseInt(assignmentsResult.rows[0].count) > 0) {
      const sampleResult = await client.query(`
        SELECT 
          c.company_name,
          u.first_name || ' ' || u.last_name as notary_name,
          tca.is_default,
          tca.status
        FROM title_company_notary_assignments tca
        JOIN companies c ON tca.title_company_id = c.id
        JOIN users u ON tca.notary_id = u.id
        LIMIT 5;
      `);

      console.log('📋 Sample assignments:');
      sampleResult.rows.forEach(row => {
        console.log(`   - ${row.company_name} → ${row.notary_name} ${row.is_default ? '(default)' : ''}`);
      });
    }

    console.log('🎉 Title Company Notary Assignment system is ready!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
runMigration().catch(console.error); 