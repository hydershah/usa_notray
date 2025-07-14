#!/usr/bin/env node

/**
 * Supabase Migration Runner - Self-Signed Certificates Table
 * 
 * This script creates the self_signed_certificates table in your Supabase database.
 * Run this script to enable automatic certificate generation for verified signers and witnesses.
 * 
 * Usage:
 *   node run-supabase-certificates-migration.js
 * 
 * Requirements:
 *   - DATABASE_URL environment variable set to your Supabase database URL
 *   - Node.js with pg package installed
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🚀 Starting Supabase Self-Signed Certificates Migration...\n');

  // Get database URL from environment
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is not set');
    console.error('   Please set your Supabase database URL:');
    console.error('   export DATABASE_URL="postgresql://user:password@host:port/database"');
    process.exit(1);
  }

  console.log('📡 Connecting to Supabase database...');
  
  // Create PostgreSQL client
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false // Required for Supabase
    }
  });

  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to Supabase database successfully\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migration-self-signed-certificates.sql');
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('📄 Loaded migration file: migration-self-signed-certificates.sql');

    // Check if table already exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'self_signed_certificates'
      );
    `;
    
    const existsResult = await client.query(tableExistsQuery);
    const tableExists = existsResult.rows[0].exists;

    if (tableExists) {
      console.log('⚠️  Table self_signed_certificates already exists');
      console.log('   The migration will update the existing table if needed\n');
    } else {
      console.log('🆕 Table self_signed_certificates does not exist');
      console.log('   Creating new table...\n');
    }

    // Execute migration
    console.log('🔄 Executing migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully!\n');

    // Verify the table structure
    console.log('🔍 Verifying table structure...');
    const verifyQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'self_signed_certificates'
      ORDER BY ordinal_position;
    `;

    const verifyResult = await client.query(verifyQuery);
    console.log(`📋 Table structure (${verifyResult.rows.length} columns):`);
    verifyResult.rows.forEach(row => {
      console.log(`   • ${row.column_name}: ${row.data_type}${row.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });

    // Check indexes
    const indexQuery = `
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'self_signed_certificates'
      AND schemaname = 'public';
    `;

    const indexResult = await client.query(indexQuery);
    console.log(`\n📊 Indexes (${indexResult.rows.length} total):`);
    indexResult.rows.forEach(row => {
      console.log(`   • ${row.indexname}`);
    });

    // Test insert/select permissions
    console.log('\n🧪 Testing table operations...');
    try {
      const testQuery = 'SELECT COUNT(*) as count FROM self_signed_certificates;';
      const testResult = await client.query(testQuery);
      console.log(`   ✅ SELECT operation successful (${testResult.rows[0].count} records found)`);
    } catch (testError) {
      console.log('   ❌ SELECT operation failed:', testError.message);
    }

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Verify the table appears in your Supabase dashboard');
    console.log('   2. Configure Row Level Security (RLS) policies if needed');
    console.log('   3. Test the certificate generation by having a signer complete ID verification');
    console.log('   4. Check the admin dashboard for certificate management features');
    console.log('\n💡 Features enabled:');
    console.log('   • Automatic certificate generation after ID verification');
    console.log('   • Certificate download for users and admins');
    console.log('   • Certificate revocation capabilities');
    console.log('   • Audit trail for certificate lifecycle');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Check your DATABASE_URL is correct');
    console.error('   2. Ensure your Supabase user has CREATE TABLE permissions');
    console.error('   3. Verify the users table exists (required for foreign key)');
    console.error('   4. Check Supabase dashboard for any additional error details');
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n📡 Database connection closed');
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});

export { runMigration }; 