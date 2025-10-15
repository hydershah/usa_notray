import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkJob112() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Full check of Job #112...\n');
    
    // Get job details
    const jobResult = await client.query(`
      SELECT 
        j.id,
        j.user_id as creator_id,
        u.email as creator_email,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        u.role as creator_role,
        j.notary_id,
        j.selected_notary
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      WHERE j.id = 112
    `);
    
    if (jobResult.rows.length > 0) {
      const job = jobResult.rows[0];
      console.log('=== JOB DETAILS ===');
      console.log(`Job ID: ${job.id}`);
      console.log(`Creator: ${job.creator_first_name} ${job.creator_last_name}`);
      console.log(`Creator Email: ${job.creator_email}`);
      console.log(`Creator Role: ${job.creator_role}`);
      console.log(`Notary ID: ${job.notary_id || 'None'}`);
      console.log(`Selected Notary: ${job.selected_notary || 'None'}`);
      console.log('\n');
    }
    
    // Get all signers with detailed info
    console.log('=== SIGNERS TABLE ===');
    const signersResult = await client.query(`
      SELECT 
        s.id as signer_id,
        s.user_id,
        s.signer_name,
        s.signer_email,
        s.primary_user_role,
        u.role as actual_user_role,
        u.first_name,
        u.last_name
      FROM signers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.job_id = 112
      ORDER BY s.id
    `);
    
    if (signersResult.rows.length === 0) {
      console.log('None\n');
    } else {
      signersResult.rows.forEach(row => {
        console.log(`Signer ID: ${row.signer_id}`);
        console.log(`User ID: ${row.user_id}`);
        console.log(`Name: ${row.signer_name}`);
        console.log(`Email: ${row.signer_email}`);
        console.log(`Primary User Role (from signers): ${row.primary_user_role || 'N/A'}`);
        console.log(`Actual User Role (from users): ${row.actual_user_role || 'N/A'}`);
        console.log('---');
      });
      console.log('');
    }
    
    // Get all job participants
    console.log('=== JOB PARTICIPANTS TABLE ===');
    const participantsResult = await client.query(`
      SELECT 
        jp.id as participant_id,
        jp.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.role as actual_user_role,
        jp.job_specific_role,
        jp.primary_role
      FROM job_participants jp
      LEFT JOIN users u ON jp.user_id = u.id
      WHERE jp.job_id = 112
      ORDER BY jp.id
    `);
    
    if (participantsResult.rows.length === 0) {
      console.log('None\n');
    } else {
      participantsResult.rows.forEach(row => {
        console.log(`Participant ID: ${row.participant_id}`);
        console.log(`User ID: ${row.user_id}`);
        console.log(`Name: ${row.first_name} ${row.last_name}`);
        console.log(`Email: ${row.email}`);
        console.log(`Actual User Role: ${row.actual_user_role}`);
        console.log(`Primary Role (from jp): ${row.primary_role || 'N/A'}`);
        console.log(`Job Specific Role: ${row.job_specific_role || 'N/A'}`);
        console.log('---');
      });
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkJob112();
