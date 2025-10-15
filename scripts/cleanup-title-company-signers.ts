import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Cleanup Script: Remove Title Companies and Notaries from Signers Table
 * 
 * This script identifies and removes title company and notary users who were
 * incorrectly auto-added as signers by the add-default-participants script.
 * 
 * These users should only appear as signers if they have an explicit 
 * jobParticipants entry with jobSpecificRole = 'signer' or 'witness'.
 */

interface SignerToClean {
  signerId: number;
  jobId: number;
  userId: number;
  signerEmail: string;
  userRole: string;
  hasExplicitParticipant: boolean;
}

async function cleanupTitleCompanySigners() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');
    console.log('🧹 STARTING TITLE COMPANY/NOTARY SIGNER CLEANUP...');
    console.log('');

    // Find all signers who are title companies or notaries
    const query = `
      SELECT 
        s.id as signer_id,
        s.job_id,
        s.user_id,
        s.signer_email,
        u.role as user_role,
        u.first_name,
        u.last_name,
        CASE 
          WHEN jp.id IS NOT NULL THEN true 
          ELSE false 
        END as has_explicit_participant
      FROM signers s
      INNER JOIN users u ON s.user_id = u.id
      LEFT JOIN job_participants jp ON (
        jp.job_id = s.job_id 
        AND jp.user_id = s.user_id 
        AND jp.job_specific_role IN ('signer', 'witness')
      )
      WHERE u.role IN ('title_company', 'notary')
      ORDER BY s.job_id, s.id
    `;

    const result = await client.query(query);
    const signersToReview: SignerToClean[] = result.rows.map(row => ({
      signerId: row.signer_id,
      jobId: row.job_id,
      userId: row.user_id,
      signerEmail: row.signer_email,
      userRole: row.user_role,
      hasExplicitParticipant: row.has_explicit_participant
    }));

    if (signersToReview.length === 0) {
      console.log('✅ No title companies or notaries found in signers table!');
      console.log('🎉 Database is clean.');
      return;
    }

    console.log(`📊 Found ${signersToReview.length} title company/notary signer entries:`);
    console.log('');

    // Separate into those with and without explicit participant entries
    const toDelete = signersToReview.filter(s => !s.hasExplicitParticipant);
    const toKeep = signersToReview.filter(s => s.hasExplicitParticipant);

    console.log(`❌ ${toDelete.length} entries to DELETE (no explicit jobParticipants entry):`);
    toDelete.forEach(s => {
      console.log(`   Job #${s.jobId} - ${s.signerEmail} (${s.userRole}) - Signer ID: ${s.signerId}`);
    });
    console.log('');

    console.log(`✅ ${toKeep.length} entries to KEEP (have explicit jobParticipants entry):`);
    toKeep.forEach(s => {
      console.log(`   Job #${s.jobId} - ${s.signerEmail} (${s.userRole}) - Signer ID: ${s.signerId}`);
    });
    console.log('');

    if (toDelete.length === 0) {
      console.log('🎉 No entries need to be deleted. All title companies/notaries were explicitly invited.');
      return;
    }

    // Perform deletion
    console.log('🗑️ Deleting incorrect signer entries...');
    
    let deletedCount = 0;
    let failedCount = 0;

    for (const signer of toDelete) {
      try {
        // Delete from signers table
        await client.query(
          'DELETE FROM signers WHERE id = $1',
          [signer.signerId]
        );

        // Also delete from job_participants if it exists WITHOUT explicit role
        await client.query(`
          DELETE FROM job_participants 
          WHERE job_id = $1 
            AND user_id = $2 
            AND (job_specific_role IS NULL OR job_specific_role = '')
        `, [signer.jobId, signer.userId]);

        deletedCount++;
        console.log(`   ✅ Deleted: Job #${signer.jobId} - ${signer.signerEmail} (${signer.userRole})`);
      } catch (error) {
        failedCount++;
        console.error(`   ❌ Failed to delete signer ${signer.signerId}:`, error);
      }
    }

    console.log('');
    console.log('📊 CLEANUP SUMMARY:');
    console.log(`   ✅ Successfully deleted: ${deletedCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);
    console.log(`   ℹ️ Kept (explicitly invited): ${toKeep.length}`);
    console.log('');
    console.log('🎉 Cleanup complete!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the cleanup
cleanupTitleCompanySigners()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });

