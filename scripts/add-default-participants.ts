import { Client } from 'pg';
import crypto from 'crypto';

// Helper function to check if email exists
async function emailExists(client: Client, email: string): Promise<boolean> {
  const result = await client.query(`
    SELECT COUNT(*) as count FROM users WHERE email = $1
  `, [email]);
  return parseInt(result.rows[0].count) > 0;
}

// Helper function to generate unique email address
async function generateUniqueEmail(client: Client, baseEmail: string): Promise<string> {
  const [localPart, domain] = baseEmail.split('@');
  let counter = 1;
  let uniqueEmail = baseEmail;
  
  while (await emailExists(client, uniqueEmail)) {
    uniqueEmail = `${localPart}+${counter}@${domain}`;
    counter++;
    
    // Safety check to prevent infinite loop
    if (counter > 1000) {
      uniqueEmail = `${localPart}+${Date.now()}@${domain}`;
      break;
    }
  }
  
  return uniqueEmail;
}

// Helper function to find existing user by email with any role
async function findExistingUser(client: Client, email: string): Promise<{ id: number; role: string } | null> {
  const result = await client.query(`
    SELECT id, role FROM users WHERE email = $1 LIMIT 1
  `, [email]);
  
  return result.rows[0] || null;
}

async function addDefaultParticipants() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');
    console.log('👥 STARTING DEFAULT PARTICIPANT ADDITION...');
    console.log('');

    // Find jobs without participants
    const jobsWithoutParticipants = await client.query(`
      SELECT 
        j.id,
        j.title_company,
        j.closing_type,
        j.job_status,
        j.created_at,
        j.user_id,
        u.email as creator_email,
        u.first_name as creator_first_name,
        u.last_name as creator_last_name,
        COALESCE(signer_stats.signer_count, 0) as signer_count,
        COALESCE(participant_stats.participant_count, 0) as participant_count
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN (
        SELECT job_id, COUNT(*) as signer_count 
        FROM signers 
        GROUP BY job_id
      ) signer_stats ON j.id = signer_stats.job_id
      LEFT JOIN (
        SELECT job_id, COUNT(*) as participant_count 
        FROM job_participants 
        WHERE role IN ('signer', 'witness')
        GROUP BY job_id
      ) participant_stats ON j.id = participant_stats.job_id
      WHERE j.job_status IN ('open', 'pending')
      AND COALESCE(signer_stats.signer_count, 0) = 0
      AND COALESCE(participant_stats.participant_count, 0) = 0
      ORDER BY j.created_at DESC
    `);

    if (jobsWithoutParticipants.rows.length === 0) {
      console.log('✅ No jobs found without participants!');
      console.log('🎉 All active jobs already have participants assigned.');
      return;
    }

    console.log(`📊 Found ${jobsWithoutParticipants.rows.length} jobs without participants:`);
    jobsWithoutParticipants.rows.slice(0, 10).forEach(job => {
      console.log(`   Job #${job.id} - ${job.title_company} (${job.closing_type})`);
    });
    if (jobsWithoutParticipants.rows.length > 10) {
      console.log(`   ... and ${jobsWithoutParticipants.rows.length - 10} more`);
    }
    console.log('');

    let successCount = 0;
    let failureCount = 0;
    const results: Array<{ jobId: number; status: string; participantsAdded?: number; error?: string }> = [];

    console.log('🔄 Processing jobs...');
    console.log('');

    for (const job of jobsWithoutParticipants.rows) {
      try {
        let participantsAdded = 0;

        // Strategy 1: Add the job creator as a default signer (if they have contact info)
        if (job.creator_email && job.creator_first_name && job.creator_last_name) {
          
          // Check if user already exists with any role
          const existingUser = await findExistingUser(client, job.creator_email);
          
          // CRITICAL FIX: Skip adding title companies and notaries as signers
          // They should only act in their primary role unless explicitly invited
          if (existingUser && (existingUser.role === 'title_company' || existingUser.role === 'notary')) {
            console.log(`   ⏭️ Skipping job creator ${job.creator_email} - they are a ${existingUser.role} and should not be auto-added as signer`);
            participantsAdded = 0; // Reset to trigger placeholder creation if needed
            // Skip to next strategy
            if (participantsAdded === 0) {
              // Continue to Strategy 2
            }
          } else {
            // Proceed with adding as signer
            let signerUserId = existingUser?.id;

          // If no user exists, create one with unique email
          if (!signerUserId) {
            const uniqueEmail = await generateUniqueEmail(client, job.creator_email);
            const hashedPassword = await import('bcrypt').then(bcrypt => 
              bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
            );

            const newSignerResult = await client.query(`
              INSERT INTO users (
                username, email, password, role, first_name, last_name, 
                phone_number, is_verified, verification_status, 
                account_setup_complete, approval_status, is_active, created_at
              ) VALUES ($1, $2, $3, 'signer', $4, $5, '', false, 'pending', false, 'approved', true, NOW())
              RETURNING id
            `, [
              uniqueEmail,
              uniqueEmail, 
              hashedPassword,
              job.creator_first_name,
              job.creator_last_name
            ]);

            signerUserId = newSignerResult.rows[0].id;
            
            // Log if we had to use a different email
            if (uniqueEmail !== job.creator_email) {
              console.log(`   📧 Using unique email: ${uniqueEmail} (original: ${job.creator_email})`);
            }
          }

          // Add to signers table (use the actual email from the created user)
          const userEmailQuery = await client.query(`
            SELECT email FROM users WHERE id = $1
          `, [signerUserId]);
          const actualEmail = userEmailQuery.rows[0].email;
          
          try {
            await client.query(`
              INSERT INTO signers (
                job_id, user_id, signer_name, signer_email, signer_phone_number,
                signer_role, invitation_token, access_type, guest_verification_status,
                signing_status, created_at
              ) VALUES ($1, $2, $3, $4, '', 'borrower', $5, 'registered', 'pending', 'pending', NOW())
            `, [
              job.id,
              signerUserId,
              `${job.creator_first_name} ${job.creator_last_name}`,
              actualEmail,
              crypto.randomUUID()
            ]);
          } catch (signerError) {
            // If signer already exists for this job, that's okay
            if (signerError.code === '23505') { // unique constraint violation
              console.log(`   ℹ️ Signer already exists for job ${job.id}`);
            } else {
              throw signerError;
            }
          }

          participantsAdded++;
          } // Close else block for non-title-company/notary users
        }

        // Strategy 2: Add a generic placeholder signer if no creator info
        if (participantsAdded === 0) {
          // Create a placeholder signer account with unique email
          const basePlaceholderEmail = `placeholder-signer-job${job.id}@temp.example.com`;
          const placeholderEmail = await generateUniqueEmail(client, basePlaceholderEmail);
          const hashedPassword = await import('bcrypt').then(bcrypt => 
            bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
          );

          const placeholderUserResult = await client.query(`
            INSERT INTO users (
              username, email, password, role, first_name, last_name, 
              phone_number, is_verified, verification_status, 
              account_setup_complete, approval_status, is_active, created_at
            ) VALUES ($1, $2, $3, 'signer', 'Placeholder', 'Signer', '', false, 'pending', false, 'approved', true, NOW())
            RETURNING id
          `, [
            placeholderEmail,
            placeholderEmail,
            hashedPassword
          ]);

          const placeholderUserId = placeholderUserResult.rows[0].id;
          
          // Log if we had to use a different email
          if (placeholderEmail !== basePlaceholderEmail) {
            console.log(`   📧 Using unique placeholder email: ${placeholderEmail}`);
          }

          // Add to signers table
          try {
            await client.query(`
              INSERT INTO signers (
                job_id, user_id, signer_name, signer_email, signer_phone_number,
                signer_role, invitation_token, access_type, guest_verification_status,
                signing_status, created_at
              ) VALUES ($1, $2, 'Placeholder Signer', $3, '', 'borrower', $4, 'registered', 'pending', 'pending', NOW())
            `, [
              job.id,
              placeholderUserId,
              placeholderEmail,
              crypto.randomUUID()
            ]);
          } catch (signerError) {
            // If signer already exists for this job, that's okay
            if (signerError.code === '23505') { // unique constraint violation
              console.log(`   ℹ️ Placeholder signer already exists for job ${job.id}`);
            } else {
              throw signerError;
            }
          }

          participantsAdded++;
        }

        // Strategy 3: Add to job_participants table as well for compatibility
        // Get the actual email used for the participant (either from creator or placeholder)
        let participantEmail = job.creator_email;
        if (participantsAdded === 0) {
          // If no participants were added above, we need to determine the email
          participantEmail = `placeholder-signer-job${job.id}@temp.example.com`;
        }
        
        // Get the actual email from the signers table we just created
        const signerEmailQuery = await client.query(`
          SELECT signer_email FROM signers WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1
        `, [job.id]);
        
        const actualSignerEmail = signerEmailQuery.rows[0]?.signer_email || participantEmail;
        
        try {
          await client.query(`
            INSERT INTO job_participants (
              job_id, email, role, invite_status, invite_token, created_at
            ) VALUES ($1, $2, 'signer', 'pending', $3, NOW())
          `, [
            job.id,
            actualSignerEmail,
            crypto.randomUUID()
          ]);
        } catch (participantError) {
          // If participant already exists for this job, that's okay
          if (participantError.code === '23505') { // unique constraint violation
            console.log(`   ℹ️ Participant already exists for job ${job.id}`);
          } else {
            throw participantError;
          }
        }

        results.push({
          jobId: job.id,
          status: 'success',
          participantsAdded
        });

        console.log(`✅ Job #${job.id}: Added ${participantsAdded} participant(s)`);
        
        // Show which email was used
        if (participantsAdded > 0) {
          const finalEmailQuery = await client.query(`
            SELECT signer_email FROM signers WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1
          `, [job.id]);
          const finalEmail = finalEmailQuery.rows[0]?.signer_email;
          if (finalEmail) {
            console.log(`   📧 Using email: ${finalEmail}`);
          }
        }
        
        successCount++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          jobId: job.id,
          status: 'failed',
          error: errorMessage
        });

        console.log(`❌ Job #${job.id}: Failed - ${errorMessage}`);
        failureCount++;
      }
    }

    console.log('');
    console.log('📊 PARTICIPANT ADDITION SUMMARY:');
    console.log('================================');
    console.log(`✅ Successfully processed: ${successCount} jobs`);
    console.log(`❌ Failed processing: ${failureCount} jobs`);
    console.log(`📈 Success rate: ${Math.round((successCount / jobsWithoutParticipants.rows.length) * 100)}%`);
    console.log('');

    // Show detailed results
    if (successCount > 0) {
      console.log('✅ SUCCESSFUL ADDITIONS:');
      console.log('========================');
      const successfulResults = results.filter(r => r.status === 'success');
      successfulResults.forEach(result => {
        console.log(`   Job #${result.jobId}: ${result.participantsAdded} participants added`);
      });
      console.log('');
    }

    if (failureCount > 0) {
      console.log('❌ FAILED ADDITIONS:');
      console.log('====================');
      const failedResults = results.filter(r => r.status === 'failed');
      failedResults.forEach(result => {
        console.log(`   Job #${result.jobId}: ${result.error}`);
      });
      console.log('');
    }

    // Post-addition validation
    console.log('🔍 POST-ADDITION VALIDATION:');
    console.log('============================');
    
    const validationResult = await client.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN signer_count > 0 OR participant_count > 0 THEN 1 END) as jobs_with_participants
      FROM (
        SELECT 
          j.id,
          COALESCE(signer_stats.signer_count, 0) as signer_count,
          COALESCE(participant_stats.participant_count, 0) as participant_count
        FROM jobs j
        LEFT JOIN (
          SELECT job_id, COUNT(*) as signer_count 
          FROM signers 
          GROUP BY job_id
        ) signer_stats ON j.id = signer_stats.job_id
        LEFT JOIN (
          SELECT job_id, COUNT(*) as participant_count 
          FROM job_participants 
          WHERE role IN ('signer', 'witness')
          GROUP BY job_id
        ) participant_stats ON j.id = participant_stats.job_id
        WHERE j.job_status IN ('open', 'pending')
      ) combined_stats
    `);

    const validation = validationResult.rows[0];
    const currentParticipantRate = validation.total_jobs > 0 ? 
      Math.round((validation.jobs_with_participants / validation.total_jobs) * 100) : 0;

    console.log(`📊 Current participant rate: ${currentParticipantRate}% (${validation.jobs_with_participants}/${validation.total_jobs})`);

    // Important notices
    console.log('\n⚠️ IMPORTANT NOTICES:');
    console.log('=====================');
    console.log('🔸 Placeholder participants were added for jobs without proper signer information');
    console.log('🔸 These should be replaced with real participants before job completion');
    console.log('🔸 Placeholder email addresses use @temp.example.com domain');
    console.log('🔸 All added participants need proper setup and verification');

    // Recommendations
    console.log('\n💡 NEXT STEPS:');
    console.log('==============');
    
    if (currentParticipantRate === 100) {
      console.log('🎉 Perfect! All active jobs now have participants.');
      console.log('⚠️ Remember to replace placeholder participants with real ones');
      console.log('👀 Monitor with: npm run job:validate');
    } else if (currentParticipantRate >= 90) {
      console.log('👍 Excellent participant rate!');
      console.log('🔄 Re-run this script if needed: npm run participants:add');
    } else {
      console.log('⚠️ Some jobs still missing participants:');
      console.log('   1. Check for additional issues: npm run job:validate');
      console.log('   2. Review failed additions above');
      console.log('   3. Manually add participants via job details UI');
    }

    console.log('\n🔧 Related Commands:');
    console.log('   npm run job:validate    - Check overall job health');
    console.log('   npm run job:stats       - View detailed statistics');
    console.log('   npm run job:fix         - Comprehensive job fix');

    console.log('\n📝 MANUAL CLEANUP NEEDED:');
    console.log('=========================');
    console.log('1. Review jobs with placeholder participants');
    console.log('2. Replace placeholder signers with real contact information');
    console.log('3. Send proper invitations to real participants');
    console.log('4. Remove/update placeholder user accounts as needed');

  } catch (error) {
    console.error('❌ Participant addition failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run participant addition
addDefaultParticipants()
  .then(() => {
    console.log('\n🎯 Participant addition process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Participant addition error:', error);
    process.exit(1);
  }); 