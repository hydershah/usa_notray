/*
  One-time cleanup: normalize user_signatures.image_url
  - If a row stores a full Vultr URL (pre-signed), convert it to the stable object key (path)
  - Leaves data URIs (data:image/...) untouched
  Usage: node scripts/cleanup-signatures.cjs
*/

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const usesSupabase = /supabase\.(co|com)|pooler\.supabase\.(co|com)/.test(databaseUrl);
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: usesSupabase ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    console.log('Starting signatures cleanup...');
    const before = await client.query("SELECT COUNT(*) AS cnt FROM user_signatures WHERE image_url ~ '^https?://'");

    // Convert https://<host>/<path>[?query] -> <path>
    const update = await client.query(`
      UPDATE user_signatures
      SET image_url = split_part(regexp_replace(image_url, '^https?://[^/]+/', ''), '?', 1)
      WHERE image_url ~ '^https?://'
    `);

    const remaining = await client.query("SELECT COUNT(*) AS cnt FROM user_signatures WHERE image_url ~ '^https?://'");

    console.log(JSON.stringify({
      matchedBefore: Number(before.rows[0]?.cnt || 0),
      updated: update.rowCount || 0,
      remainingUrls: Number(remaining.rows[0]?.cnt || 0),
    }, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});


