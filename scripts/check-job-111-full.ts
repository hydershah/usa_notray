import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkJob111Full() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Full check of Job #111...\n');
    
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
      WHERE j.id = 111
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
    
    // Get all signers
    console.log('=== SIGNERS ===');
    const signersResult = await client.query(`
      SELECT 
        s.signer_name,
        s.signer_email,
        u.role as user_role
      FROM signers s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.job_id = 111
    `);
    
    signersResult.rows.forEach(row => {
      console.log(`- ${row.signer_name} (${row.signer_email}) - Role: ${row.user_role || 'N/A'}`);
    });
    console.log('\n');
    
    // Get all job participants
    console.log('=== JOB PARTICIPANTS ===');
    const participantsResult = await client.query(`
      SELECT 
        u.first_name,
        u.last_name,
        u.email,
        u.role as user_role,
        jp.job_specific_role,
        jp.primary_role
      FROM job_participants jp
      LEFT JOIN users u ON jp.user_id = u.id
      WHERE jp.job_id = 111
    `);
    
    if (participantsResult.rows.length === 0) {
      console.log('None');
    } else {
      participantsResult.rows.forEach(row => {
        console.log(`- ${row.first_name} ${row.last_name} (${row.email})`);
        console.log(`  User Role: ${row.user_role}`);
        console.log(`  Primary Role: ${row.primary_role || 'N/A'}`);
        console.log(`  Job Specific Role: ${row.job_specific_role || 'N/A'}`);
        console.log('');
      });
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkJob111Full();
