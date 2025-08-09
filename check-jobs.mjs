import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax%40123@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
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