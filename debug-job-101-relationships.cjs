// Debug script to check job 101 relationships and user 44 status
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/usa_notray'
});

async function debugJob101Relationships() {
  console.log('🔍 Debugging Job 101 and User 44 relationships...\n');
  
  try {
    // Check job 101 basic info
    const jobQuery = await pool.query(`
      SELECT id, title_company, closing_type, job_status, notary_id, user_id
      FROM jobs WHERE id = 101
    `);
    
    console.log('📋 Job 101 Info:');
    console.log(jobQuery.rows[0] || 'Job not found');
    console.log('');
    
    // Check user 44 info
    const userQuery = await pool.query(`
      SELECT id, email, role, first_name, last_name, is_verified, verification_status, 
             is_verification_bypassed, notary_verification_bypassed
      FROM users WHERE id = 44
    `);
    
    console.log('👤 User 44 Info:');
    console.log(userQuery.rows[0] || 'User not found');
    console.log('');
    
    // Check if user 44 is in job_participants for job 101
    const participantsQuery = await pool.query(`
      SELECT * FROM job_participants WHERE job_id = 101 AND user_id = 44
    `);
    
    console.log('👥 Job Participants (job 101, user 44):');
    console.log(participantsQuery.rows.length > 0 ? participantsQuery.rows[0] : 'Not found in job_participants');
    console.log('');
    
    // Check if user 44 is in signers for job 101 (by email lookup)
    if (userQuery.rows[0]) {
      const signerQuery = await pool.query(`
        SELECT * FROM signers WHERE job_id = 101 AND signer_email = $1
      `, [userQuery.rows[0].email]);
      
      console.log('✍️ Signers (job 101, user 44 email):');
      console.log(signerQuery.rows.length > 0 ? signerQuery.rows[0] : 'Not found in signers');
      console.log('');
    }
    
    // Check all signers for job 101
    const allSignersQuery = await pool.query(`
      SELECT id, user_id, signer_name, signer_email, signer_role
      FROM signers WHERE job_id = 101
    `);
    
    console.log('📝 All Signers for Job 101:');
    allSignersQuery.rows.forEach((signer, index) => {
      console.log(`${index + 1}. ${signer.signer_name} (${signer.signer_email}) - User ID: ${signer.user_id || 'Not linked'}`);
    });
    console.log('');
    
    // Check all job participants for job 101
    const allParticipantsQuery = await pool.query(`
      SELECT jp.*, u.email, u.role 
      FROM job_participants jp
      LEFT JOIN users u ON jp.user_id = u.id
      WHERE jp.job_id = 101
    `);
    
    console.log('👥 All Job Participants for Job 101:');
    allParticipantsQuery.rows.forEach((participant, index) => {
      console.log(`${index + 1}. User ${participant.user_id} (${participant.email}) - Role: ${participant.role}, Status: ${participant.invite_status}`);
    });
    console.log('');
    
    // Check verification documents availability for user 44
    if (userQuery.rows[0]) {
      const verificationQuery = await pool.query(`
        SELECT verification_image_front_url, verification_image_back_url, verification_image_selfie_url,
               evs_transaction_id, evs_verification_confidence
        FROM users WHERE id = 44
      `);
      
      console.log('🔍 User 44 Verification Data:');
      const user = verificationQuery.rows[0];
      console.log(`- Front ID: ${user.verification_image_front_url ? 'Available' : 'Not available'}`);
      console.log(`- Back ID: ${user.verification_image_back_url ? 'Available' : 'Not available'}`);
      console.log(`- Selfie: ${user.verification_image_selfie_url ? 'Available' : 'Not available'}`);
      console.log(`- EVS Transaction: ${user.evs_transaction_id || 'None'}`);
      console.log(`- Confidence Score: ${user.evs_verification_confidence || 'None'}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugJob101Relationships().catch(console.error); 