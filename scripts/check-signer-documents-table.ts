import { Client } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkSignerDocumentsTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔍 Testing database connection...');
    await client.connect();
    console.log('✅ Database connected successfully!');

    // Check if the table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'signer_documents'
      );
    `);

    if (tableCheck.rows[0].exists) {
      console.log('✅ signer_documents table exists in database');
      
      // Get table structure
      const tableStructure = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'signer_documents'
        ORDER BY ordinal_position;
      `);

      console.log('\n📋 Table structure:');
      tableStructure.rows.forEach((col, index) => {
        console.log(`${index + 1}. ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `default: ${col.column_default}` : ''}`);
      });

      // Check constraints
      const constraints = await client.query(`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
        AND table_name = 'signer_documents';
      `);

      console.log('\n🔒 Table constraints:');
      constraints.rows.forEach((constraint, index) => {
        console.log(`${index + 1}. ${constraint.constraint_name}: ${constraint.constraint_type}`);
      });

      // Check indexes
      const indexes = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'signer_documents';
      `);

      console.log('\n📊 Table indexes:');
      indexes.rows.forEach((index, indexNum) => {
        console.log(`${indexNum + 1}. ${index.indexname}: ${index.indexdef}`);
      });

      // Check if there's any data
      const rowCount = await client.query(`
        SELECT COUNT(*) as count FROM signer_documents;
      `);

      console.log(`\n📊 Row count: ${rowCount.rows[0].count}`);

    } else {
      console.log('❌ signer_documents table does not exist in database');
    }

  } catch (error) {
    console.error('❌ Check failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the check
checkSignerDocumentsTable()
  .then(() => {
    console.log('\n🎉 Table check completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Table check failed:', error);
    process.exit(1);
  });
