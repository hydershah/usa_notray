const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function debugJob94Documents() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔍 Checking documents for Job 94...\n');

    // Get job details
    const jobResult = await pool.query(`
      SELECT id, title_company, closing_type, created_at 
      FROM jobs 
      WHERE id = 94
    `);

    if (jobResult.rows.length === 0) {
      console.log('❌ Job 94 not found');
      return;
    }

    const job = jobResult.rows[0];
    console.log('📋 Job 94 Details:');
    console.log(`   Title Company: ${job.title_company}`);
    console.log(`   Closing Type: ${job.closing_type}`);
    console.log(`   Created: ${job.created_at}\n`);

    // Get documents for job 94
    const docsResult = await pool.query(`
      SELECT id, file_name, original_name, file_path, file_size, mime_type, 
             document_type, uploaded_by, created_at
      FROM job_documents 
      WHERE job_id = 94
      ORDER BY created_at
    `);

    console.log(`📄 Found ${docsResult.rows.length} document(s) for Job 94:\n`);

    docsResult.rows.forEach((doc, index) => {
      console.log(`Document ${index + 1}:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   File Name: ${doc.file_name}`);
      console.log(`   Original Name: ${doc.original_name}`);
      console.log(`   File Path: ${doc.file_path}`);
      console.log(`   File Size: ${doc.file_size} bytes`);
      console.log(`   MIME Type: ${doc.mime_type}`);
      console.log(`   Document Type: ${doc.document_type}`);
      console.log(`   Uploaded By: ${doc.uploaded_by}`);
      console.log(`   Created: ${doc.created_at}`);
      console.log('');
    });

    // Check if the specific file path from the error exists
    const specificFile = 'development/document/2025/07/notarizations/job-94/20250718_doc_ifvg4d_job94_RON_seller_doc_pkg.pdf';
    const specificResult = await pool.query(`
      SELECT id, file_name, original_name, file_path
      FROM job_documents 
      WHERE file_path = $1
    `, [specificFile]);

    console.log(`🔍 Checking for specific file path: ${specificFile}`);
    if (specificResult.rows.length > 0) {
      console.log('✅ Found matching document in database');
      console.log(`   Document ID: ${specificResult.rows[0].id}`);
      console.log(`   File Name: ${specificResult.rows[0].file_name}`);
      console.log(`   Original Name: ${specificResult.rows[0].original_name}`);
    } else {
      console.log('❌ No document found with this exact file path');
      
      // Look for similar paths
      const similarResult = await pool.query(`
        SELECT id, file_name, original_name, file_path
        FROM job_documents 
        WHERE file_path LIKE '%RON_seller_doc_pkg.pdf%'
        OR file_path LIKE '%job-94%'
        OR file_path LIKE '%job94%'
      `);
      
      if (similarResult.rows.length > 0) {
        console.log('\n🔍 Found similar file paths:');
        similarResult.rows.forEach(row => {
          console.log(`   ID ${row.id}: ${row.file_path}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

debugJob94Documents(); 