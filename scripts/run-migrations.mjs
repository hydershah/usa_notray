import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/notary_platform',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

async function runMigration(migrationFile) {
  const client = new Client(dbConfig);
  
  try {
    console.log(`🔄 Connecting to database...`);
    await client.connect();
    
    console.log(`📋 Running migration: ${migrationFile}`);
    
    // Read migration file
    const migrationPath = path.join(process.cwd(), migrationFile);
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`⚠️ Migration file not found: ${migrationFile}`);
      return false;
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration
    console.log(`⚡ Executing SQL migration...`);
    await client.query(migrationSQL);
    
    console.log(`✅ Migration completed successfully: ${migrationFile}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Migration failed: ${migrationFile}`);
    console.error('Error details:', error.message);
    
    // Log the specific SQL error if available
    if (error.position) {
      console.error(`SQL Error at position ${error.position}`);
    }
    
    return false;
  } finally {
    await client.end();
  }
}

async function runAllMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  const migrations = [
    'migration-complete-evs-data-storage.sql',
    'migration-id-verification-requirements.sql'
  ];
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
    console.log(''); // Add spacing between migrations
  }
  
  // Summary
  console.log('📊 Migration Summary:');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📝 Total: ${migrations.length}`);
  
  if (failureCount === 0) {
    console.log('\n🎉 All migrations completed successfully!');
  } else {
    console.log('\n⚠️ Some migrations failed. Please check the errors above.');
    process.exit(1);
  }
}

// Test database connection
async function testConnection() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔍 Testing database connection...');
    await client.connect();
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log(`✅ Database connected successfully!`);
    console.log(`⏰ Current database time: ${result.rows[0].current_time}`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    console.error('\n💡 Please check your DATABASE_URL environment variable');
    console.error('Current DATABASE_URL:', dbConfig.connectionString.replace(/:\/\/.*@/, '://***:***@'));
    
    return false;
  } finally {
    await client.end();
  }
}

// Main execution
async function main() {
  const command = process.argv[2];
  
  if (command === 'test') {
    await testConnection();
  } else if (command === 'migrate') {
    const connected = await testConnection();
    if (connected) {
      console.log(''); // Add spacing
      await runAllMigrations();
    }
  } else if (command === 'single' && process.argv[3]) {
    const connected = await testConnection();
    if (connected) {
      console.log(''); // Add spacing
      await runMigration(process.argv[3]);
    }
  } else {
    console.log('📚 Usage:');
    console.log('  node scripts/run-migrations.mjs test     - Test database connection');
    console.log('  node scripts/run-migrations.mjs migrate  - Run all migrations');
    console.log('  node scripts/run-migrations.mjs single <file.sql> - Run single migration');
    console.log('');
    console.log('🔧 Example:');
    console.log('  node scripts/run-migrations.mjs migrate');
    console.log('  node scripts/run-migrations.mjs single migration-complete-evs-data-storage.sql');
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 