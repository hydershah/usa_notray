#!/usr/bin/env node

/**
 * Migration Script: Add Recording Fields to Jobs Table
 * 
 * This script adds recording-related fields to the jobs table for storing
 * screen recording information from live signing sessions.
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use the same DATABASE_URL as the main application (from server/db.ts)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runRecordingMigration() {
  console.log('🚀 Starting recording fields migration...\n');

  const client = await pool.connect();
  
  try {
    // Read migration SQL file
    const migrationPath = path.join(__dirname, 'migration-add-recording-fields.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running migration SQL...');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Recording fields migration completed successfully!');
    console.log('\n📋 Added fields to jobs table:');
    console.log('   • recording_file_key (TEXT) - Vultr storage key');
    console.log('   • recording_file_url (TEXT) - Vultr download URL');
    console.log('   • recording_file_name (TEXT) - Original filename');
    console.log('   • recording_duration (INTEGER) - Duration in seconds');
    console.log('   • recording_started_at (TIMESTAMP) - Recording start time');
    console.log('   • recording_uploaded_at (TIMESTAMP) - Upload completion time');
    console.log('   • recording_participant_count (INTEGER) - Number of participants');
    console.log('   • recording_session_id (TEXT) - Editor session ID');
    console.log('   • recording_live_session_id (TEXT) - Live session ID');
    console.log('   • recording_metadata (JSONB) - Additional metadata');
    console.log('\n🔍 Added indexes for performance optimization');
    
    // Verify the migration worked
    console.log('\n🔍 Verifying migration...');
    const verificationQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND table_schema = 'public'
      AND column_name LIKE 'recording_%'
      ORDER BY column_name;
    `;
    
    const result = await client.query(verificationQuery);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified new columns:');
      result.rows.forEach(row => {
        console.log(`   • ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('⚠️  No recording columns found after migration');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Confirmation prompt
function confirmMigration() {
  return new Promise(async (resolve) => {
    const { createInterface } = await import('readline');
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('⚠️  This will add recording fields to the jobs table.');
    console.log('Database:', process.env.DATABASE_URL ? 'Supabase (from env)' : 'Default Supabase');
    
    readline.question('\nDo you want to proceed? (y/N): ', (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('🎥 Screen Recording Migration Tool');
  console.log('=====================================');
  
  const shouldProceed = await confirmMigration();
  
  if (!shouldProceed) {
    console.log('❌ Migration cancelled by user');
    process.exit(0);
  }
  
  await runRecordingMigration();
}

// Run the migration
main().catch(console.error); 