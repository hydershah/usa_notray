#!/usr/bin/env npx tsx

/**
 * Critical Performance Indexes Migration Script
 * 
 * Purpose: Add database indexes to fix 21-second job creation performance issue
 * Expected improvement: 6-10 seconds reduction (85% faster)
 * 
 * This script adds indexes for:
 * - users table (role, isActive, email queries)
 * - closing_types table (isActive queries)
 * - participant_roles table (isActive queries)
 * - jobs, companies, signers tables (relationship queries)
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const startTime = Date.now();
  console.log('🚀 Starting critical performance indexes migration...');
  console.log(`📊 Target: Reduce job creation time from 21s to <3s`);
  console.log(`🎯 Expected improvement: 85% faster database queries\n`);

  try {
    // Read the migration SQL file
    const migrationPath = join(process.cwd(), 'migrations', 'add-critical-performance-indexes.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Split into individual statements and clean them up
    const statements = migrationSQL
      .split(';')
      .map(stmt => {
        // Remove line comments and clean up
        const lines = stmt.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('--'))
          .join(' ');
        return lines.trim();
      })
      .filter(stmt => {
        // Only keep CREATE INDEX statements
        return stmt && 
               stmt.toUpperCase().includes('CREATE INDEX') && 
               !stmt.startsWith('/*') && 
               stmt.length > 20;
      });

    console.log(`📋 Found ${statements.length} index creation statements\n`);

    // Execute each index creation statement
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Extract index name for logging
      const indexNameMatch = statement.match(/idx_\w+/);
      const indexName = indexNameMatch ? indexNameMatch[0] : `statement_${i + 1}`;
      
      console.log(`🔨 Creating index: ${indexName}...`);
      
      try {
        const queryStart = Date.now();
        await pool.query(statement);
        const queryTime = Date.now() - queryStart;
        
        console.log(`✅ Created ${indexName} (${queryTime}ms)`);
        successCount++;
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Index ${indexName} already exists - skipping`);
          skipCount++;
        } else {
          console.error(`❌ Failed to create ${indexName}: ${error.message}`);
          errorCount++;
        }
      }
    }

    const totalTime = Date.now() - startTime;
    
    console.log('\n📊 Migration Results:');
    console.log(`✅ Successfully created: ${successCount} indexes`);
    console.log(`⚠️  Skipped (already exist): ${skipCount} indexes`);
    console.log(`❌ Failed: ${errorCount} indexes`);
    console.log(`⏱️  Total time: ${totalTime}ms`);

    if (errorCount > 0) {
      console.log('\n⚠️  Some indexes failed to create. Please review the errors above.');
      console.log('   The migration will continue with the successfully created indexes.');
    }

    // Test query performance after index creation
    console.log('\n🧪 Testing query performance after index creation...');
    await testQueryPerformance();

    console.log('\n🎉 Performance indexes migration completed!');
    console.log('💡 Next steps:');
    console.log('   1. Restart the application to clear any query plan caches');
    console.log('   2. Test job creation performance');
    console.log('   3. Monitor query execution times');
    console.log('   4. Expected improvement: 21s → <3s job creation time');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

async function testQueryPerformance() {
  const testQueries = [
    {
      name: 'Users query (role filter)',
      sql: 'SELECT COUNT(*) FROM users WHERE role = $1',
      params: ['notary']
    },
    {
      name: 'Notaries available query',
      sql: 'SELECT COUNT(*) FROM users WHERE role = $1 AND is_active = $2',
      params: ['notary', true]
    },
    {
      name: 'Active closing types',
      sql: 'SELECT COUNT(*) FROM closing_types WHERE is_active = $1',
      params: [true]
    },
    {
      name: 'Active participant roles',
      sql: 'SELECT COUNT(*) FROM participant_roles WHERE is_active = $1',
      params: [true]
    }
  ];

  for (const test of testQueries) {
    try {
      const startTime = Date.now();
      const result = await pool.query(test.sql, test.params);
      const queryTime = Date.now() - startTime;
      
      console.log(`🧪 ${test.name}: ${queryTime}ms (${result.rows[0].count} rows)`);
      
      if (queryTime < 100) {
        console.log('   ✅ Excellent performance (<100ms)');
      } else if (queryTime < 500) {
        console.log('   ✅ Good performance (<500ms)');
      } else {
        console.log('   ⚠️  Slow performance (>500ms) - may need additional optimization');
      }
    } catch (error) {
      console.log(`   ❌ Test failed: ${error}`);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Migration interrupted by user');
  await pool.end();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Migration terminated');
  await pool.end();
  process.exit(1);
});

// Run the migration
runMigration().catch(console.error); 