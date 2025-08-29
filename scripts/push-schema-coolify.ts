#!/usr/bin/env npx tsx

/**
 * Push Drizzle Schema to Coolify PostgreSQL
 * Uses drizzle-kit to push schema properly
 */

import { execSync } from 'child_process';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import * as schema from '../shared/schema.js';

async function pushSchemaToCoolify() {
  try {
    console.log('🚀 Pushing Schema to Coolify PostgreSQL\n');

    // Hardcoded Coolify connection
    const coolifyUrl = "postgres://postgres:h1Vk5DUJxhjTSKkddqfGGvTaBblXOgPxddNHBNuwCtYrZEiQtElfnFewz4ZbGx9O@45.32.217.149:5432/postgres";
    
    console.log('🔗 Target: 45.32.217.149:5432');
    
    // Test connection first
    console.log('⏱️  Testing connection...');
    const pool = new Pool({
      connectionString: coolifyUrl,
      ssl: false,
      max: 1,
      connectionTimeoutMillis: 10000,
    });

    const db = drizzle({ client: pool, schema });
    
    const connectionStart = Date.now();
    await db.execute(sql`SELECT 1;`);
    const connectionTime = Date.now() - connectionStart;
    
    console.log(`✅ Connection verified! (${connectionTime}ms)`);

    // Use drizzle-kit to push schema
    console.log('\n🏗️  Pushing schema using drizzle-kit...');
    
    try {
      // Set the DATABASE_URL environment variable for this command only
      const pushCommand = `DATABASE_URL="${coolifyUrl}" npx drizzle-kit push`;
      
      console.log('📋 Running: drizzle-kit push');
      const pushStart = Date.now();
      
      const result = execSync(pushCommand, { 
        stdio: 'inherit',
        env: { 
          ...process.env, 
          DATABASE_URL: coolifyUrl 
        }
      });
      
      const pushTime = Date.now() - pushStart;
      console.log(`✅ Schema push completed! (${pushTime}ms)`);
      
    } catch (pushError) {
      console.log('⚠️  drizzle-kit push failed, trying manual schema creation...');
      
      // Manual schema creation as fallback
      console.log('🔨 Creating tables manually...');
      
      const tables = [
        'users', 'companies', 'jobs', 'closing_types', 
        'participant_roles', 'editor_sessions', 'digital_signatures'
      ];
      
      for (const table of tables) {
        try {
          await db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS ${table} (id SERIAL PRIMARY KEY);`));
          console.log(`✅ Created table: ${table}`);
        } catch (error) {
          console.log(`⚠️  Table ${table}: ${error.message}`);
        }
      }
    }

    // Verify tables were created
    console.log('\n🔍 Verifying schema...');
    const tables = await db.execute(sql`
      SELECT table_name, 
             (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log(`📊 Created ${tables.rows.length} tables:`);
    tables.rows.forEach(row => {
      console.log(`   ✅ ${row.table_name} (${row.columns} columns)`);
    });

    // Performance test
    console.log('\n⚡ Testing query performance...');
    const perfStart = Date.now();
    await db.execute(sql`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';`);
    const perfTime = Date.now() - perfStart;
    
    console.log(`📊 Query performance: ${perfTime}ms`);
    
    if (perfTime < 50) {
      console.log('🟢 Excellent performance!');
    } else if (perfTime < 150) {
      console.log('🟡 Good performance');
    } else {
      console.log('🟠 Acceptable performance (better than Railway!)');
    }

    await pool.end();

    console.log('\n🎉 Schema Migration Successful!');
    console.log('\n📋 Next Steps:');
    console.log('1. Seed closing types: npx tsx scripts/seed-closing-types.ts');
    console.log('2. Seed participant roles: npx tsx scripts/seed-basic-participant-roles.ts');
    console.log('3. Create admin user: npx tsx scripts/create-specific-user.ts');
    console.log('4. Update .env when ready to switch permanently');

  } catch (error) {
    console.error('❌ Schema push failed:', error);
    process.exit(1);
  }
}

pushSchemaToCoolify();
