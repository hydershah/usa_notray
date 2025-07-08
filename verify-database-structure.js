#!/usr/bin/env node

/**
 * Database Structure Verification Script
 * 
 * This script verifies the database connection and checks the current
 * structure of the jobs table before running the recording migration.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Use the same DATABASE_URL as the main application (from server/db.ts)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function verifyDatabaseStructure() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Database Structure Verification');
    console.log('==================================\n');

    // Test basic connection
    console.log('📡 Testing database connection...');
    const timeResult = await client.query('SELECT NOW() as current_time, current_database() as database_name');
    console.log(`✅ Connected to database: ${timeResult.rows[0].database_name}`);
    console.log(`⏰ Current time: ${timeResult.rows[0].current_time}\n`);

    // Check if jobs table exists
    console.log('📋 Checking if jobs table exists...');
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
      ) as table_exists;
    `;
    
    const tableResult = await client.query(tableExistsQuery);
    const tableExists = tableResult.rows[0].table_exists;
    
    if (!tableExists) {
      console.log('❌ Jobs table does not exist!');
      console.log('Please ensure the main schema migrations have been run first.');
      return false;
    }
    
    console.log('✅ Jobs table exists\n');

    // Get current jobs table structure
    console.log('📊 Current jobs table structure:');
    const columnsQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;
    
    const columnsResult = await client.query(columnsQuery);
    
    console.log('┌─────────────────────────────────┬─────────────────┬─────────────┬──────────────────┐');
    console.log('│ Column Name                     │ Data Type       │ Nullable    │ Default          │');
    console.log('├─────────────────────────────────┼─────────────────┼─────────────┼──────────────────┤');
    
    columnsResult.rows.forEach(row => {
      const columnName = (row.column_name || '').padEnd(31);
      const dataType = (row.data_type || '').padEnd(15);
      const nullable = (row.is_nullable || '').padEnd(11);
      const defaultVal = (row.column_default || 'null').substring(0, 16).padEnd(16);
      console.log(`│ ${columnName} │ ${dataType} │ ${nullable} │ ${defaultVal} │`);
    });
    
    console.log('└─────────────────────────────────┴─────────────────┴─────────────┴──────────────────┘\n');

    // Check for existing recording-related columns
    console.log('🎥 Checking for existing recording fields...');
    const recordingColumns = columnsResult.rows.filter(row => 
      row.column_name.includes('recording')
    );

    if (recordingColumns.length > 0) {
      console.log('⚠️  Found existing recording columns:');
      recordingColumns.forEach(col => {
        console.log(`   • ${col.column_name} (${col.data_type})`);
      });
      console.log('\nMigration may need to be modified to avoid conflicts.');
    } else {
      console.log('✅ No existing recording columns found - migration can proceed safely');
    }

    // Get table size info
    console.log('\n📈 Table statistics:');
    const statsQuery = `
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        most_common_vals
      FROM pg_stats 
      WHERE tablename = 'jobs' 
      AND schemaname = 'public'
      LIMIT 5;
    `;
    
    try {
      const statsResult = await client.query(statsQuery);
      if (statsResult.rows.length > 0) {
        console.log('✅ Table statistics available');
      }
    } catch (error) {
      console.log('ℹ️  Table statistics not available (this is normal)');
    }

    // Count existing records
    const countQuery = 'SELECT COUNT(*) as record_count FROM jobs;';
    const countResult = await client.query(countQuery);
    console.log(`📊 Current records in jobs table: ${countResult.rows[0].record_count}`);

    // Check indexes
    console.log('\n🔍 Current indexes on jobs table:');
    const indexQuery = `
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'jobs' 
      AND schemaname = 'public'
      ORDER BY indexname;
    `;
    
    const indexResult = await client.query(indexQuery);
    if (indexResult.rows.length > 0) {
      indexResult.rows.forEach(row => {
        console.log(`   • ${row.indexname}`);
      });
    } else {
      console.log('   • No custom indexes found (only primary key)');
    }

    console.log('\n🎯 Migration Readiness Check:');
    console.log('✅ Database connection: OK');
    console.log('✅ Jobs table exists: OK');
    console.log(`${recordingColumns.length === 0 ? '✅' : '⚠️ '} Recording fields: ${recordingColumns.length === 0 ? 'Ready for migration' : 'Some already exist'}`);
    
    return true;

  } catch (error) {
    console.error('❌ Database verification failed:', error);
    console.error('\n💡 Troubleshooting tips:');
    console.error('   • Check your DATABASE_URL environment variable');
    console.error('   • Ensure your database is running and accessible');
    console.error('   • Verify your database credentials');
    
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

// Confirmation function
async function confirmProceed() {
  return new Promise(async (resolve) => {
    const { createInterface } = await import('readline');
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('\nDo you want to proceed with the recording migration? (y/N): ', (answer) => {
      readline.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('🎥 Recording Migration - Database Verification');
  console.log('==============================================\n');
  
  const isValid = await verifyDatabaseStructure();
  
  if (!isValid) {
    console.log('\n❌ Database verification failed. Please fix issues before running migration.');
    process.exit(1);
  }
  
  console.log('\n✅ Database verification completed successfully!');
  
  const shouldProceed = await confirmProceed();
  
  if (shouldProceed) {
    console.log('\n🚀 Ready to run migration! Use: node run-recording-migration.js');
  } else {
    console.log('\n⏸️  Migration cancelled by user');
  }
}

// Run the verification
main().catch(console.error); 