import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkJob42() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Checking Job #42...\n');
    
    const result = await client.query(`
      SELECT 
        s.id as signer_id,
        s.job_id,
        s.signer_name,
        s.signer_email,
        u.role as user_role,
        u.first_name,
        u.last_name,
        jp.job_specific_role,
        CASE 
          WHEN jp.id IS NOT NULL THEN 'Has explicit jobParticipants entry'
          ELSE 'No explicit entry (incorrectly added)'
        END as status
      FROM signers s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN job_participants jp ON (
        jp.job_id = s.job_id 
        AND jp.user_id = s.user_id 
        AND jp.job_specific_role IN ('signer', 'witness')
      )
      WHERE s.job_id = 42
      ORDER BY s.id
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No signers found for Job #42');
    } else {
      console.log(`✅ Found ${result.rows.length} signer(s) for Job #42:\n`);
      result.rows.forEach(row => {
        console.log(`Signer ID: ${row.signer_id}`);
        console.log(`Name: ${row.signer_name}`);
        console.log(`Email: ${row.signer_email}`);
        console.log(`User Role: ${row.user_role || 'N/A'}`);
        console.log(`Job Specific Role: ${row.job_specific_role || 'N/A'}`);
        console.log(`Status: ${row.status}`);
        console.log('---');
      });
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkJob42();
