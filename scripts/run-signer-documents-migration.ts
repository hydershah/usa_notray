import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runSignerDocumentsMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔍 Testing database connection...');
    await client.connect();
    console.log('✅ Database connected successfully!');

    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', 'add-signer-documents-table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Running signer documents table migration...');
    console.log('📄 Migration file:', migrationPath);

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Signer documents table migration completed successfully!');

    // Verify the table was created
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'signer_documents'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ signer_documents table exists in database');
    } else {
      console.log('❌ signer_documents table was not created');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the migration
runSignerDocumentsMigration()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
