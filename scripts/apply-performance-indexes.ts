#!/usr/bin/env npx tsx

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyPerformanceIndexes() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');
    console.log('⚡ APPLYING CRITICAL PERFORMANCE INDEXES');
    console.log('=====================================');
    console.log('');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/add-critical-performance-indexes.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Executing ${statements.length} index creation statements...`);

    let successCount = 0;
    let skipCount = 0;

    for (const statement of statements) {
      try {
        const start = Date.now();
        await client.query(statement + ';');
        const duration = Date.now() - start;
        
        console.log(`✅ Index created (${duration}ms): ${statement.substring(0, 80)}...`);
        successCount++;
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(`⏭️  Index already exists: ${statement.substring(0, 80)}...`);
          skipCount++;
        } else {
          console.error(`❌ Failed to create index: ${error.message}`);
          console.error(`   Statement: ${statement}`);
        }
      }
    }

    console.log('');
    console.log('📊 MIGRATION SUMMARY:');
    console.log(`   ✅ Successfully created: ${successCount} indexes`);
    console.log(`   ⏭️  Already existed: ${skipCount} indexes`);
    console.log(`   📈 Total indexes processed: ${successCount + skipCount}`);

    // Verify critical indexes exist
    console.log('');
    console.log('🔍 Verifying critical indexes...');
    
    const criticalIndexes = [
      'idx_jobs_notary_combined',
      'idx_jobs_active_with_notary', 
      'idx_users_active_notaries',
      'idx_job_participants_job_id',
      'idx_signers_job_id'
    ];

    for (const indexName of criticalIndexes) {
      const result = await client.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = '${indexName}';`
      );
      
      if (result.rows.length > 0) {
        console.log(`✅ ${indexName} - VERIFIED`);
      } else {
        console.log(`❌ ${indexName} - MISSING`);
      }
    }

    console.log('');
    console.log('🎉 Performance indexes migration completed!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Restart your application to enable Redis caching');
    console.log('   2. Test job creation - should be much faster now');
    console.log('   3. Monitor query performance in logs');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
applyPerformanceIndexes().catch(console.error); 