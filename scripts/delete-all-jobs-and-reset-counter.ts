import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function deleteAllJobsAndResetCounter() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database successfully');

    // First, let's check the current state
    const countQuery = 'SELECT COUNT(*) as job_count FROM jobs';
    const countResult = await client.query(countQuery);
    const currentJobCount = parseInt(countResult.rows[0].job_count);
    
    console.log(`📊 Current job count: ${currentJobCount}`);

    if (currentJobCount === 0) {
      console.log('ℹ️  No jobs to delete. Database is already empty.');
    } else {
      console.log('🗑️  Safely removing job references from related tables...');
      
      // Find all tables that reference jobs
      const findRelatedTablesQuery = `
        SELECT DISTINCT tc.table_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND ccu.table_name = 'jobs'
          AND tc.table_name != 'jobs'
      `;
      
      const relatedTablesResult = await client.query(findRelatedTablesQuery);
      const relatedTables = relatedTablesResult.rows.map(row => row.table_name);
      
      console.log(`🔍 Found ${relatedTables.length} related tables: ${relatedTables.join(', ')}`);

      // Tables that have NOT NULL constraints on job_id - we need to delete these records
      const tablesToDelete = [
        'digital_signatures',
        'editor_sessions', 
        'notary_verification_bypass_log'
      ];

      // Tables that allow NULL job_id - we can set job_id to NULL
      const tablesToUpdate = relatedTables.filter(table => !tablesToDelete.includes(table));

      // First, delete records from tables with NOT NULL constraints
      for (const table of tablesToDelete) {
        if (relatedTables.includes(table)) {
          try {
            const deleteQuery = `DELETE FROM ${table} WHERE job_id IS NOT NULL`;
            const result = await client.query(deleteQuery);
            console.log(`🗑️  Deleted ${result.rowCount} records from ${table}`);
          } catch (error: any) {
            console.log(`⚠️  Could not delete from ${table}: ${error.message}`);
          }
        }
      }

      // Then, set job_id to NULL for tables that allow it
      for (const table of tablesToUpdate) {
        try {
          const updateQuery = `UPDATE ${table} SET job_id = NULL WHERE job_id IS NOT NULL`;
          const result = await client.query(updateQuery);
          console.log(`✅ Updated ${result.rowCount} records in ${table} (set job_id to NULL)`);
        } catch (error: any) {
          console.log(`⚠️  Could not update ${table}: ${error.message}`);
        }
      }

      // Now delete all jobs
      console.log(`🗑️  Deleting all ${currentJobCount} jobs...`);
      const deleteQuery = 'DELETE FROM jobs';
      await client.query(deleteQuery);
      console.log('✅ All jobs deleted successfully');

      // Reset the sequence counter for the jobs table
      console.log('🔄 Resetting sequence counter...');
      const resetSequenceQuery = 'ALTER SEQUENCE jobs_id_seq RESTART WITH 1';
      await client.query(resetSequenceQuery);
      console.log('✅ Sequence counter reset to 1');
    }

    // Verify the deletion and reset
    const verifyCountQuery = 'SELECT COUNT(*) as job_count FROM jobs';
    const verifyCountResult = await client.query(verifyCountQuery);
    const newJobCount = parseInt(verifyCountResult.rows[0].job_count);
    
    console.log(`📊 New job count: ${newJobCount}`);

    // Check the current sequence value
    const sequenceQuery = "SELECT last_value FROM jobs_id_seq";
    const sequenceResult = await client.query(sequenceQuery);
    const currentSequenceValue = parseInt(sequenceResult.rows[0].last_value);
    
    console.log(`🔄 Current sequence value: ${currentSequenceValue}`);

    if (newJobCount === 0 && currentSequenceValue === 1) {
      console.log('✅ SUCCESS: All jobs deleted and counter reset!');
      console.log('🎯 Next job will be Job #1');
    } else {
      console.log('⚠️  WARNING: Something may not have worked as expected');
    }

  } catch (error) {
    console.error('❌ Error during deletion and reset:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
deleteAllJobsAndResetCounter(); 