import { Client } from 'pg';

async function assignMissingNotaries() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');
    console.log('👨‍⚖️ STARTING MISSING NOTARY ASSIGNMENT...');
    console.log('');

    // Find jobs without notaries
    const jobsWithoutNotary = await client.query(`
      SELECT 
        j.id,
        j.title_company,
        j.notary_option,
        j.job_status,
        j.created_at,
        j.user_id,
        u.role as creator_role,
        tc.preferred_notary_id
      FROM jobs j
      LEFT JOIN users u ON j.user_id = u.id
      LEFT JOIN title_companies tc ON j.title_company = tc.company_name
      WHERE j.notary_id IS NULL 
      AND j.job_status IN ('open', 'pending')
      ORDER BY j.created_at DESC
    `);

    if (jobsWithoutNotary.rows.length === 0) {
      console.log('✅ No jobs found without notary assignment!');
      console.log('🎉 All active jobs already have notaries assigned.');
      return;
    }

    console.log(`📊 Found ${jobsWithoutNotary.rows.length} jobs without notary assignment:`);
    console.log('');

    // Get available notaries
    const availableNotaries = await client.query(`
      SELECT 
        id,
        first_name,
        last_name,
        notary_type,
        is_active
      FROM users 
      WHERE role = 'notary' 
      AND is_active = true
      AND notary_type = 'contractor'
      ORDER BY id
    `);

    if (availableNotaries.rows.length === 0) {
      console.log('❌ No available contractor notaries found!');
      console.log('💡 Please ensure you have active contractor notaries in the system.');
      return;
    }

    console.log(`📋 Available contractor notaries: ${availableNotaries.rows.length}`);
    availableNotaries.rows.forEach(notary => {
      console.log(`   • ${notary.first_name} ${notary.last_name} (ID: ${notary.id})`);
    });
    console.log('');

    let successCount = 0;
    let failureCount = 0;
    const results: Array<{ jobId: number; status: string; notaryName?: string; error?: string }> = [];

    console.log('🔄 Processing jobs...');
    console.log('');

    for (const job of jobsWithoutNotary.rows) {
      try {
        let assignedNotaryId: number | null = null;
        let assignmentType = 'random';

        // Step 1: Try preferred notary if available
        if (job.preferred_notary_id) {
          const preferredNotary = availableNotaries.rows.find(n => n.id === job.preferred_notary_id);
          if (preferredNotary) {
            assignedNotaryId = job.preferred_notary_id;
            assignmentType = 'preferred';
          }
        }

        // Step 2: If no preferred notary, use random assignment
        if (!assignedNotaryId) {
          const randomIndex = Math.floor(Math.random() * availableNotaries.rows.length);
          assignedNotaryId = availableNotaries.rows[randomIndex].id;
          assignmentType = 'random';
        }

        const assignedNotary = availableNotaries.rows.find(n => n.id === assignedNotaryId);
        if (!assignedNotary) {
          throw new Error('Failed to find assigned notary in available list');
        }

        // Update the job with notary assignment
        await client.query(`
          UPDATE jobs 
          SET 
            notary_id = $1,
            selected_notary = $2,
            notary_approval_status = 'assigned_pending_approval'
          WHERE id = $3
        `, [assignedNotaryId, assignedNotaryId.toString(), job.id]);

        // Log the assignment
        await client.query(`
          INSERT INTO notary_assignment_log (job_id, notary_id, assignment_type, assignment_status)
          VALUES ($1, $2, $3, 'assigned')
        `, [job.id, assignedNotaryId, assignmentType]);

        const notaryName = `${assignedNotary.first_name} ${assignedNotary.last_name}`;
        results.push({
          jobId: job.id,
          status: 'success',
          notaryName
        });

        console.log(`✅ Job #${job.id}: Assigned ${notaryName} (${assignmentType})`);
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
    console.log('📊 ASSIGNMENT SUMMARY:');
    console.log('======================');
    console.log(`✅ Successfully assigned: ${successCount} jobs`);
    console.log(`❌ Failed assignments: ${failureCount} jobs`);
    console.log(`📈 Success rate: ${Math.round((successCount / jobsWithoutNotary.rows.length) * 100)}%`);
    console.log('');

    // Show detailed results
    if (successCount > 0) {
      console.log('✅ SUCCESSFUL ASSIGNMENTS:');
      console.log('===========================');
      const successfulResults = results.filter(r => r.status === 'success');
      successfulResults.forEach(result => {
        console.log(`   Job #${result.jobId} → ${result.notaryName}`);
      });
      console.log('');
    }

    if (failureCount > 0) {
      console.log('❌ FAILED ASSIGNMENTS:');
      console.log('======================');
      const failedResults = results.filter(r => r.status === 'failed');
      failedResults.forEach(result => {
        console.log(`   Job #${result.jobId}: ${result.error}`);
      });
      console.log('');
    }

    // Post-assignment validation
    console.log('🔍 POST-ASSIGNMENT VALIDATION:');
    console.log('==============================');
    
    const validationResult = await client.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN notary_id IS NOT NULL THEN 1 END) as jobs_with_notary
      FROM jobs 
      WHERE job_status IN ('open', 'pending')
    `);

    const validation = validationResult.rows[0];
    const currentAssignmentRate = validation.total_jobs > 0 ? 
      Math.round((validation.jobs_with_notary / validation.total_jobs) * 100) : 0;

    console.log(`📊 Current assignment rate: ${currentAssignmentRate}% (${validation.jobs_with_notary}/${validation.total_jobs})`);

    // Recommendations
    console.log('\n💡 NEXT STEPS:');
    console.log('==============');
    
    if (currentAssignmentRate === 100) {
      console.log('🎉 Perfect! All active jobs now have notaries assigned.');
      console.log('👀 Monitor with: npm run job:validate');
    } else if (currentAssignmentRate >= 90) {
      console.log('👍 Excellent assignment rate!');
      console.log('🔄 Re-run this script if needed: npm run notary:assign');
    } else {
      console.log('⚠️ Some jobs still missing notaries:');
      console.log('   1. Check for additional issues: npm run job:validate');
      console.log('   2. Review failed assignments above');
      console.log('   3. Consider adding more contractor notaries');
    }

    console.log('\n🔧 Related Commands:');
    console.log('   npm run job:validate    - Check overall job health');
    console.log('   npm run job:stats       - View detailed statistics');
    console.log('   npm run job:fix         - Comprehensive job fix');

  } catch (error) {
    console.error('❌ Notary assignment failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run notary assignment
assignMissingNotaries()
  .then(() => {
    console.log('\n🎯 Notary assignment process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Assignment error:', error);
    process.exit(1);
  }); 