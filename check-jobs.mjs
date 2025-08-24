import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

try {
  const result = await pool.query('SELECT id, job_status, recording_metadata, recording_session_id, completed_at FROM jobs WHERE job_status = $1 AND recording_metadata IS NOT NULL ORDER BY completed_at DESC LIMIT 5', ['completed']);
  console.log('Recent completed jobs with recording metadata:');
  result.rows.forEach(job => {
    console.log(`Job ${job.id}: ${job.recording_session_id}`);
    console.log(`  Metadata: ${job.recording_metadata}`);
    console.log(`  Completed: ${job.completed_at}`);
    console.log('---');
  });
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await pool.end();
} 