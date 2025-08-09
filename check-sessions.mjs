import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax%40123@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

try {
  // Check editor sessions for job 11
  const result = await pool.query('SELECT * FROM editor_sessions WHERE job_id = $1 ORDER BY created_at DESC LIMIT 3', [11]);
  console.log('Editor sessions for job 11:');
  result.rows.forEach(session => {
    console.log(`Session ${session.id}: video_session_id=${session.video_session_id}, status=${session.status}`);
    console.log(`  Created: ${session.created_at}`);
    console.log(`  Updated: ${session.updated_at}`);
    console.log('---');
  });

  // Also check if there are any video sessions that might be related
  console.log('\nLooking for video sessions around job 11 completion time...');
  const videoSessions = await pool.query(`
    SELECT * FROM editor_sessions 
    WHERE created_at >= '2025-08-09 06:00:00' 
    AND created_at <= '2025-08-09 08:00:00'
    AND video_session_id IS NOT NULL
    ORDER BY created_at DESC
  `);
  
  videoSessions.rows.forEach(session => {
    console.log(`Job ${session.job_id} Session ${session.id}: ${session.video_session_id}`);
    console.log(`  Created: ${session.created_at}`);
  });

} catch (error) {
  console.error('Error:', error.message);
} finally {
  await pool.end();
} 