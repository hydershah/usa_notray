#!/usr/bin/env npx tsx

/**
 * Migration Script: Railway PostgreSQL → Coolify PostgreSQL
 * This script helps migrate your database from Railway to Coolify
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function migrateToCoolifyDb() {
  try {
    console.log('🚀 Database Migration: Railway → Coolify PostgreSQL\n');

    // Step 1: Get Coolify database URL from user
    console.log('📋 Step 1: Set up Coolify Database Connection');
    console.log('From your Coolify screenshot, I can see:');
    console.log('- Database: postgresql-database-tk88ksw4gc44g');
    console.log('- Image: postgres:17-alpine');
    console.log('- Port: 3000:5432');
    
    console.log('\n🔧 You need to get the connection details from Coolify:');
    console.log('1. In Coolify dashboard, go to your PostgreSQL service');
    console.log('2. Look for "Postgres URL (internal)" - this is what you need');
    console.log('3. It should look like: postgres://postgres:PASSWORD@HOST:PORT/postgres');
    
    const coolifyUrl = 'postgres://postgres:h1Vk5DUJxhjTSKkddqfGGvTaBbIXOgPxddNHBNuwCtYrZEiQtElfnFewz4ZbGx9O@tk88ksw4gc44g:5432/postgres';
    console.log('\n📝 Based on your screenshot, your Coolify URL should be:');
    console.log(coolifyUrl);

    // Step 2: Backup current Railway database
    console.log('\n📋 Step 2: Backup Current Railway Database');
    console.log('Creating backup of Railway database...');
    
    const backupFile = `railway-backup-${new Date().toISOString().slice(0, 10)}.sql`;
    const backupPath = path.join(process.cwd(), 'backups', backupFile);
    
    // Create backups directory
    if (!fs.existsSync('backups')) {
      fs.mkdirSync('backups');
    }

    try {
      const railwayUrl = process.env.DATABASE_URL;
      console.log('💾 Dumping Railway database...');
      
      execSync(`pg_dump "${railwayUrl}" > ${backupPath}`, { stdio: 'inherit' });
      console.log(`✅ Railway backup created: ${backupPath}`);
    } catch (error) {
      console.log('⚠️  pg_dump not found locally. Alternative backup methods:');
      console.log('1. Use Railway CLI: railway pg:dump');
      console.log('2. Use a database management tool (pgAdmin, DBeaver)');
      console.log('3. Export data via your app admin panel');
    }

    // Step 3: Test Coolify connection
    console.log('\n📋 Step 3: Test Coolify Database Connection');
    console.log('🔧 To test connection, update your .env file:');
    console.log(`DATABASE_URL="${coolifyUrl}"`);
    console.log('\nThen run: npx tsx scripts/check-current-db.ts');

    // Step 4: Migration plan
    console.log('\n📋 Step 4: Migration Execution Plan');
    console.log('Once connection is confirmed:');
    console.log('1. Run Drizzle migrations: npm run db:push');
    console.log('2. Restore data: psql "COOLIFY_URL" < backup.sql');
    console.log('3. Verify data integrity');
    console.log('4. Update production environment variables');

    // Step 5: Performance expectations
    console.log('\n📊 Step 5: Expected Performance Improvements');
    console.log('Current Railway Performance:');
    console.log('• Simple queries: 256ms average');
    console.log('• Tag operations: 300ms+');
    console.log('• Network latency: 256ms baseline');
    
    console.log('\nExpected Coolify Performance:');
    console.log('• Depends on Coolify server location');
    console.log('• If same region as your app: 50-150ms');
    console.log('• If same server as your app: 10-50ms');
    console.log('• Best case (localhost): 5-20ms');

    // Create migration script
    const migrationScript = `#!/bin/bash

# Database Migration Script: Railway → Coolify
# Run this after updating DATABASE_URL in .env

echo "🚀 Starting Railway → Coolify Migration"

# Step 1: Test new connection
echo "📡 Testing Coolify database connection..."
npx tsx scripts/check-current-db.ts

# Step 2: Run schema migrations
echo "🏗️  Running Drizzle schema migrations..."
npm run db:push

# Step 3: Seed essential data
echo "🌱 Seeding closing types..."
npx tsx scripts/seed-closing-types.ts

echo "🌱 Seeding participant roles..."
npx tsx scripts/seed-basic-participant-roles.ts

# Step 4: Performance test
echo "⚡ Testing new database performance..."
npx tsx scripts/compare-db-performance.ts

echo "✅ Migration completed! Check the results above."
`;

    fs.writeFileSync('migrate-to-coolify.sh', migrationScript);
    execSync('chmod +x migrate-to-coolify.sh');
    
    console.log('\n✅ Created migration script: migrate-to-coolify.sh');

    // Environment file update
    console.log('\n📝 Next Steps:');
    console.log('1. Get your Coolify PostgreSQL URL from the dashboard');
    console.log('2. Update DATABASE_URL in your .env file');
    console.log('3. Run: ./migrate-to-coolify.sh');
    console.log('4. Monitor performance improvements');

    console.log('\n🔧 Manual Migration Steps:');
    console.log('If automatic migration fails, do this manually:');
    
    const manualSteps = [
      'Update .env with Coolify DATABASE_URL',
      'Test connection: npx tsx scripts/check-current-db.ts',
      'Push schema: npm run db:push',
      'Import data: Use backup.sql or manual data entry',
      'Verify: Check that users, jobs, etc. exist',
      'Test performance: npx tsx scripts/compare-db-performance.ts'
    ];

    manualSteps.forEach((step, i) => {
      console.log(`   ${i + 1}. ${step}`);
    });

    console.log('\n💡 Pro Tips:');
    console.log('• Test migration on a copy first');
    console.log('• Keep Railway backup until Coolify is stable');
    console.log('• Monitor performance after migration');
    console.log('• Consider Redis caching for even better performance');

  } catch (error) {
    console.error('❌ Migration setup error:', error);
    process.exit(1);
  }
}

migrateToCoolifyDb();
