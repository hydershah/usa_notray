import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function addMissingColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if columns already exist
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND column_name IN ('completed_at', 'completed_by');
    `;
    
    const result = await client.query(checkQuery);
    const existingColumns = result.rows.map(row => row.column_name);
    
    // Add completed_at column if it doesn't exist
    if (!existingColumns.includes('completed_at')) {
      console.log('Adding completed_at column...');
      await client.query(`
        ALTER TABLE jobs 
        ADD COLUMN completed_at TIMESTAMP;
      `);
      console.log('✓ Added completed_at column');
    } else {
      console.log('✓ completed_at column already exists');
    }

    // Add completed_by column if it doesn't exist
    if (!existingColumns.includes('completed_by')) {
      console.log('Adding completed_by column...');
      await client.query(`
        ALTER TABLE jobs 
        ADD COLUMN completed_by INTEGER REFERENCES users(id);
      `);
      console.log('✓ Added completed_by column');
    } else {
      console.log('✓ completed_by column already exists');
    }

    console.log('\nMigration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
addMissingColumns(); 