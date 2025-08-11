/*
  Deduplicate users by email (case-insensitive) and enforce uniqueness.
  - Normalizes all user emails/usernames to lowercase
  - Reassigns foreign key references from duplicates to the canonical user
  - Deletes duplicate rows
  - Creates a unique index on LOWER(email)

  Usage:
    DRY-RUN:   node scripts/dedupe-users.js --dry
    EXECUTE:   node scripts/dedupe-users.js
*/
const { Client } = require('pg');

const isDryRun = process.argv.includes('--dry');

function log(...args) {
  console.log('[dedupe-users]', ...args);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL env var is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    log('Starting duplicate scan...');

    // 1) Normalize email/username to lowercase globally first
    if (!isDryRun) {
      await client.query(`UPDATE users SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL;`);
      await client.query(`UPDATE users SET username = LOWER(TRIM(username)) WHERE username IS NOT NULL;`);
    }

    // 2) Find duplicate groups by normalized email
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
      log('No duplicates found. Enforcing unique index...');
      await ensureUniqueIndex(client, isDryRun);
      log('Done.');
      return;
    }

    log(`Found ${dupRes.rows.length} duplicate email group(s).`);

    if (isDryRun) {
      dupRes.rows.forEach((r) => {
        log(`DRY: ${r.normalized_email} → ${r.user_ids.length} users`, r.user_ids);
      });
      await ensureUniqueIndex(client, true);
      return;
    }

    // 3) Process each duplicate group in a transaction
    for (const row of dupRes.rows) {
      const normalized = row.normalized_email;
      const ids = row.user_ids; // winner first (by last activity), others to merge into winner
      const winnerId = ids[0];
      const losers = ids.slice(1);

      await client.query('BEGIN');
      try {
        log(`Merging ${ids.length} accounts for ${normalized}. Winner: ${winnerId}, deleting: ${losers.join(', ')}`);

        // Reassign FKs from losers to winner across known tables
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
        ];

        for (const spec of reassignSpecs) {
          await client.query(
            `UPDATE ${spec.table} SET ${spec.column} = $1 WHERE ${spec.column} = ANY($2::int[])`,
            [winnerId, losers]
          );
        }

        // For any string columns storing username/email in foreign tables, normalize where feasible
        // Example: job_participants.email and signers.signer_email likely match; keep as-is to avoid changing audit text.

        // Finally, delete the loser accounts
        await client.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [losers]);

        await client.query('COMMIT');
        log(`Merged group ${normalized}.`);
      } catch (e) {
        await client.query('ROLLBACK');
        log(`ERROR merging ${normalized}:`, e.message);
        throw e;
      }
    }

    // 4) Enforce unique index on LOWER(email)
    await ensureUniqueIndex(client, false);

    log('Deduplication complete.');
  } finally {
    await client.end();
  }
}

async function ensureUniqueIndex(client, dry) {
  log('Ensuring unique index on LOWER(email)...');
  if (dry) {
    log('DRY: would normalize and create unique index users_email_lower_unique');
    return;
  }
  // Drop existing email unique constraint if present (best-effort)
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

main().catch((err) => {
  console.error('[dedupe-users] FAILED:', err);
  process.exit(1);
});


