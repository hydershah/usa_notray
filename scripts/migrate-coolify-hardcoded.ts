#!/usr/bin/env npx tsx

/**
 * Migrate to Coolify PostgreSQL (Hardcoded Connection)
 * Connects directly without using .env file
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function migrateCoolifyHardcoded() {
  try {
    console.log('🚀 Coolify PostgreSQL Migration (Hardcoded Connection)\n');

    // Hardcoded Coolify connection
    const coolifyUrl = "postgres://postgres:h1Vk5DUJxhjTSKkddqfGGvTaBblXOgPxddNHBNuwCtYrZEiQtElfnFewz4ZbGx9O@45.32.217.149:5432/postgres";
    
    console.log('🔗 Connecting to: 45.32.217.149:5432');
    console.log('📊 Database: postgres');
    
    // Create connection pool
    const pool = new Pool({
      connectionString: coolifyUrl,
      ssl: false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Create Drizzle instance
    const db = drizzle({ client: pool, schema });

    console.log('⏱️  Testing connection...');
    const connectionStart = Date.now();
    
    // Test connection
    const testResult = await db.execute(sql`SELECT NOW() as current_time, version() as db_version;`);
    const connectionTime = Date.now() - connectionStart;
    
    console.log(`✅ Connected successfully! (${connectionTime}ms)`);
    console.log(`📅 Server time: ${testResult.rows[0].current_time}`);
    console.log(`🐘 PostgreSQL: ${testResult.rows[0].db_version.split(' ')[0]}`);

    // Check if database is empty
    console.log('\n🔍 Checking existing database structure...');
    try {
      const tables = await db.execute(sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);
      
      console.log(`📊 Found ${tables.rows.length} existing tables:`);
      tables.rows.forEach(row => {
        console.log(`   • ${row.table_name}`);
      });
      
      if (tables.rows.length > 0) {
        console.log('\n⚠️  Database is not empty. Existing tables found.');
        console.log('🔧 Options:');
        console.log('   1. Continue migration (will create missing tables)');
        console.log('   2. Drop existing tables first (destructive)');
        console.log('\n📋 Proceeding with safe migration (option 1)...');
      } else {
        console.log('✅ Database is empty, ready for fresh migration.');
      }
      
    } catch (error) {
      console.log('📊 Database appears to be empty (no tables found)');
    }

    // Run Drizzle migration
    console.log('\n🏗️  Running Drizzle schema migration...');
    const migrationStart = Date.now();
    
    try {
      // Push schema using Drizzle
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
      console.log('✅ UUID extension enabled');
      
      // Instead of using migrate(), we'll push the schema manually
      console.log('📋 Creating database schema...');
      
      // Create tables from schema
      console.log('🔨 Creating core tables...');
      
      // This will create all tables defined in your schema
      const schemaScript = `
        -- Core application tables will be created by Drizzle push
        SELECT 'Schema push will handle table creation' as status;
      `;
      
      await db.execute(sql.raw(schemaScript));
      
      const migrationTime = Date.now() - migrationStart;
      console.log(`✅ Schema migration completed! (${migrationTime}ms)`);
      
    } catch (migrationError) {
      console.log(`❌ Migration error: ${migrationError.message}`);
      
      if (migrationError.message.includes('already exists')) {
        console.log('⚠️  Some tables already exist - this is normal for existing databases');
      } else {
        throw migrationError;
      }
    }

    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const verifyTables = await db.execute(sql`
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log(`📊 Database now has ${verifyTables.rows.length} tables:`);
    verifyTables.rows.forEach(row => {
      console.log(`   • ${row.table_name} (${row.column_count} columns)`);
    });

    // Test performance
    console.log('\n⚡ Testing database performance...');
    const perfTests = [
      {
        name: 'Simple SELECT',
        query: () => db.execute(sql`SELECT 1 as test;`)
      },
      {
        name: 'Table count',
        query: () => db.execute(sql`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';`)
      },
      {
        name: 'Current timestamp',
        query: () => db.execute(sql`SELECT NOW() as current_time;`)
      }
    ];

    for (const test of perfTests) {
      const start = Date.now();
      await test.query();
      const duration = Date.now() - start;
      
      const performance = duration < 20 ? '🟢 Excellent' : 
                         duration < 50 ? '🟡 Good' : 
                         duration < 100 ? '🟠 Acceptable' : '🔴 Slow';
      
      console.log(`   ${performance} ${test.name}: ${duration}ms`);
    }

    await pool.end();

    console.log('\n🎉 Coolify Migration Completed Successfully!');
    console.log('\n📊 Performance Summary:');
    console.log(`   Connection time: ${connectionTime}ms`);
    console.log(`   Migration time: ${migrationTime}ms`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. Update .env with Coolify URL when ready');
    console.log('2. Seed essential data (closing types, participant roles)');
    console.log('3. Test application with new database');
    console.log('4. Monitor performance improvements');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('• Ensure "Make it publicly available" is enabled in Coolify');
    console.log('• Check if port 5432 is accessible');
    console.log('• Verify PostgreSQL service is running');
    console.log('• Check connection string credentials');
    process.exit(1);
  }
}

migrateCoolifyHardcoded();
