/* CommonJS version for ESM projects */
const { Client } = require('pg');

const isDryRun = process.argv.includes('--dry');
function log(...args) { console.log('[dedupe-users]', ...args); }

async function ensureUniqueIndex(client, dry) {
  log('Ensuring unique index on LOWER(email)...');
  if (dry) { log('DRY: would create users_email_lower_unique'); return; }
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name='users' AND constraint_type='UNIQUE' AND constraint_name ILIKE '%email%'
      ) THEN
        EXECUTE (
          SELECT 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(tc.constraint_name)
          FROM information_schema.table_constraints tc
          WHERE tc.table_name='users' AND tc.constraint_type='UNIQUE' AND tc.constraint_name ILIKE '%email%'
          LIMIT 1
        );
      END IF;
    END$$;
  `);
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename='users' AND indexname='users_email_lower_unique'
      ) THEN
        CREATE UNIQUE INDEX users_email_lower_unique ON users ((LOWER(email)));
      END IF;
    END$$;
  `);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // 0) Drop case-sensitive unique constraints first to allow normalization when duplicates exist
    if (!isDryRun) {
      await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;`);
      await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique;`);
    }

    if (!isDryRun) {
      await client.query(`UPDATE users SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL;`);
      await client.query(`UPDATE users SET username = LOWER(TRIM(username)) WHERE username IS NOT NULL;`);
    }

    const dupRes = await client.query(`
      SELECT LOWER(email) AS normalized_email,
             COUNT(*) AS count,
             ARRAY_AGG(id ORDER BY COALESCE(last_login_at, updated_at, created_at) DESC NULLS LAST, id ASC) AS user_ids
      FROM users
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `);

    if (dupRes.rows.length === 0) {
      log('No duplicate groups.');
      await ensureUniqueIndex(client, isDryRun);
      return;
    }

    if (isDryRun) {
      dupRes.rows.forEach(r => log(`DRY: ${r.normalized_email} -> ${r.user_ids.length} users`, r.user_ids));
      await ensureUniqueIndex(client, true);
      return;
    }

    for (const row of dupRes.rows) {
      const winnerId = row.user_ids[0];
      const losers = row.user_ids.slice(1);
      await client.query('BEGIN');
      try {
        const reassignSpecs = [
          { table: 'jobs', column: 'user_id' },
          { table: 'jobs', column: 'notary_id' },
          { table: 'jobs', column: 'completed_by' },
          { table: 'job_documents', column: 'uploaded_by' },
          { table: 'job_participants', column: 'user_id' },
          { table: 'signers', column: 'user_id' },
          { table: 'audit_trail', column: 'user_id' },
          { table: 'account_transactions', column: 'user_id' },
          { table: 'contractor_payments', column: 'contractor_id' },
          { table: 'password_reset_tokens', column: 'user_id' },
          { table: 'kba_sessions', column: 'user_id' },
          { table: 'stripe_webhook_events', column: 'user_id' },
          { table: 'calendar_events', column: 'notary_id' },
          { table: 'notary_stamps', column: 'notary_id' },
          { table: 'notary_availability', column: 'notary_id' },
          { table: 'notary_time_slots', column: 'notary_id' },
          { table: 'notary_working_hours', column: 'notary_id' },
          { table: 'notary_assignment_log', column: 'notary_id' },
          { table: 'notary_approval_queue', column: 'notary_id' },
          { table: 'title_company_notary_assignments', column: 'notary_id' },
          { table: 'title_companies', column: 'preferred_notary_id' },
          { table: 'companies', column: 'preferred_notary_id' },
          { table: 'companies', column: 'company_manager_id' },
          { table: 'companies', column: 'approved_by' },
          { table: 'companies', column: 'created_by' },
          { table: 'companies', column: 'last_modified_by' },
          { table: 'users', column: 'approved_by' },
          // Editor-related: document_tags may reference assigned_user_id
          { table: 'document_tags', column: 'assigned_user_id' },
          { table: 'document_tags', column: 'completed_by' },
          { table: 'document_tags', column: 'created_by' },
        ];
        for (const spec of reassignSpecs) {
          await client.query(`UPDATE ${spec.table} SET ${spec.column} = $1 WHERE ${spec.column} = ANY($2::int[])`, [winnerId, losers]);
        }
        await client.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [losers]);
        await client.query('COMMIT');
        log(`Merged group for winner ${winnerId}, deleted ${losers.length} duplicates.`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }

    await ensureUniqueIndex(client, false);
    log('Deduplication complete.');
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error('[dedupe-users] FAILED:', e); process.exit(1); });


