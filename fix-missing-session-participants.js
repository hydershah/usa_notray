#!/usr/bin/env node

import { config } from 'dotenv';
import { Pool } from 'pg';

config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase.co') || DATABASE_URL.includes('supabase.com') ? {
    rejectUnauthorized: false
  } : false
});

async function fixMissingSessionParticipants() {
  console.log('🔧 Fixing Missing Session Participants Data...\n');

  try {
    // Step 1: Check current state
    console.log('📊 Current session_participants_status state:');
    const currentCount = await pool.query(`
      SELECT COUNT(*) as count FROM session_participants_status
    `);
    console.log(`   Current participants: ${currentCount.rows[0].count}`);

    // Step 2: Find active sessions without participants
    const missingSessions = await pool.query(`
      SELECT es.id as session_id, es.session_id as session_name, es.job_id, es.notary_id
      FROM editor_sessions es
      LEFT JOIN session_participants_status sps ON es.id = sps.session_id
      WHERE es.is_live_session = true 
        AND es.status = 'active'
        AND sps.session_id IS NULL
      ORDER BY es.updated_at DESC
      LIMIT 10
    `);

    console.log(`\n🔍 Found ${missingSessions.rows.length} sessions missing participants:`);
    missingSessions.rows.forEach(session => {
      console.log(`   • ${session.session_name} (job ${session.job_id})`);
    });

    if (missingSessions.rows.length === 0) {
      console.log('\n✅ No missing participants found - all sessions have participants!');
      return;
    }

    // Step 3: For each missing session, add participants
    for (const session of missingSessions.rows) {
      console.log(`\n🔧 Adding participants for session ${session.session_name}:`);

      // Add notary as participant
      if (session.notary_id) {
        try {
          await pool.query(`
            INSERT INTO session_participants_status (
              session_id, user_id, is_active, can_interact, joined_at
            ) VALUES ($1, $2, true, true, NOW())
            ON CONFLICT (session_id, user_id) DO UPDATE SET
              is_active = true,
              can_interact = true,
              joined_at = COALESCE(session_participants_status.joined_at, NOW())
          `, [session.session_id, session.notary_id]);
          
          console.log(`   ✅ Added notary (user ${session.notary_id})`);
        } catch (error) {
          console.log(`   ⚠️  Error adding notary: ${error.message}`);
        }
      }

      // Add signers from the signers table
      const signers = await pool.query(`
        SELECT DISTINCT u.id as user_id, u.username, u.email
        FROM signers s
        INNER JOIN users u ON s.signer_email = u.email
        WHERE s.job_id = $1
      `, [session.job_id]);

      for (const signer of signers.rows) {
        try {
          await pool.query(`
            INSERT INTO session_participants_status (
              session_id, user_id, is_active, can_interact, joined_at
            ) VALUES ($1, $2, true, true, NOW())
            ON CONFLICT (session_id, user_id) DO UPDATE SET
              is_active = true,
              can_interact = true,
              joined_at = COALESCE(session_participants_status.joined_at, NOW())
          `, [session.session_id, signer.user_id]);
          
          console.log(`   ✅ Added signer: ${signer.username} (${signer.email})`);
        } catch (error) {
          console.log(`   ⚠️  Error adding signer ${signer.username}: ${error.message}`);
        }
      }
    }

    // Step 4: Verify the fix
    console.log('\n📊 After fix:');
    const newCount = await pool.query(`
      SELECT COUNT(*) as count FROM session_participants_status
    `);
    console.log(`   Total participants: ${newCount.rows[0].count}`);
    
    // Test a specific session
    const testSession = missingSessions.rows[0];
    if (testSession) {
      const testParticipants = await pool.query(`
        SELECT sps.user_id, u.username, u.role
        FROM session_participants_status sps
        INNER JOIN users u ON sps.user_id = u.id
        WHERE sps.session_id = $1
      `, [testSession.session_id]);

      console.log(`\n🧪 Test session ${testSession.session_name} now has ${testParticipants.rows.length} participants:`);
      testParticipants.rows.forEach(p => {
        console.log(`   • ${p.username} (${p.role})`);
      });
    }

    console.log('\n🎉 Session Participants Fix Complete!');
    console.log('Expected improvements:');
    console.log('   • Session state API should now find participants');
    console.log('   • Faster queries with proper participant data');
    console.log('   • Reduced fallback to slow code paths');
    
  } catch (error) {
    console.error('💥 Fix failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixMissingSessionParticipants().catch(console.error); 