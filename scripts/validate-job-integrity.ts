import { Client } from 'pg';

async function validateJobIntegrity() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');
    console.log('📊 RUNNING JOB INTEGRITY VALIDATION...');
    console.log('');

    // Get current status from problematic_jobs view
    const result = await client.query(`
      SELECT 
        issue_type,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
      FROM problematic_jobs 
      GROUP BY issue_type
      ORDER BY 
        CASE issue_type 
          WHEN 'HEALTHY' THEN 1 
          ELSE 2 
        END,
        count DESC
    `);

    console.log('🏥 OVERALL HEALTH STATUS:');
    console.log('=========================');
    
    let totalJobs = 0;
    let healthyJobs = 0;
    
    result.rows.forEach(row => {
      const status = row.issue_type === 'HEALTHY' ? '✅' : '❌';
      console.log(`${status} ${row.issue_type}: ${row.count} jobs (${row.percentage}%)`);
      
      totalJobs += parseInt(row.count);
      if (row.issue_type === 'HEALTHY') {
        healthyJobs = parseInt(row.count);
      }
    });

    const successRate = totalJobs > 0 ? Math.round((healthyJobs / totalJobs) * 100) : 0;
    console.log('=========================');
    console.log(`🎯 Overall Health: ${successRate}% (${healthyJobs}/${totalJobs} jobs)`);
    console.log('');

    // Show detailed breakdown of problematic jobs
    if (healthyJobs < totalJobs) {
      console.log('🔍 DETAILED ISSUES:');
      console.log('==================');
      
      const detailedIssues = await client.query(`
        SELECT 
          id,
          title_company,
          issue_type,
          job_status,
          signer_count,
          participant_count,
          document_count,
          created_at::date as created_date
        FROM problematic_jobs 
        WHERE issue_type != 'HEALTHY'
        ORDER BY 
          CASE issue_type
            WHEN 'NO_NOTARY' THEN 1
            WHEN 'NO_PARTICIPANTS' THEN 2
            WHEN 'NO_DOCUMENTS' THEN 3
            WHEN 'INVALID_COMPLETION' THEN 4
            WHEN 'NOTARY_INCONSISTENCY' THEN 5
            ELSE 6
          END,
          created_at DESC
        LIMIT 20
      `);

      const issueGroups = detailedIssues.rows.reduce((acc, job) => {
        if (!acc[job.issue_type]) {
          acc[job.issue_type] = [];
        }
        acc[job.issue_type].push(job);
        return acc;
      }, {} as Record<string, any[]>);

      Object.entries(issueGroups).forEach(([issueType, jobs]) => {
        console.log(`\n🚨 ${issueType} (${jobs.length} jobs):`);
        jobs.slice(0, 5).forEach(job => {
          console.log(`   Job #${job.id} - ${job.title_company}`);
          console.log(`     Status: ${job.job_status}`);
          console.log(`     Signers: ${job.signer_count} | Participants: ${job.participant_count} | Docs: ${job.document_count}`);
          console.log(`     Created: ${job.created_date}`);
        });
        if (jobs.length > 5) {
          console.log(`   ... and ${jobs.length - 5} more`);
        }
      });
    }

    // Get assignment statistics
    console.log('\n📈 ASSIGNMENT STATISTICS:');
    console.log('=========================');
    
    const assignmentStats = await client.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN notary_id IS NOT NULL THEN 1 END) as jobs_with_notary,
        COUNT(CASE WHEN job_status = 'open' THEN 1 END) as pending_assignment,
        COUNT(CASE WHEN job_status = 'pending' THEN 1 END) as pending_approval,
        COUNT(CASE WHEN job_status = 'in_progress' THEN 1 END) as in_progress,
        COUNT(CASE WHEN job_status = 'completed' THEN 1 END) as completed,
        ROUND(AVG(assignment_attempts), 2) as avg_assignment_attempts
      FROM jobs 
      WHERE job_status != 'cancelled'
    `);

    const stats = assignmentStats.rows[0];
    const assignmentRate = stats.total_jobs > 0 ? Math.round((stats.jobs_with_notary / stats.total_jobs) * 100) : 0;
    
    console.log(`📊 Total Jobs: ${stats.total_jobs}`);
    console.log(`✅ With Notary: ${stats.jobs_with_notary} (${assignmentRate}%)`);
    console.log(`⏳ Open (Pending Assignment): ${stats.pending_assignment}`);
    console.log(`🔄 Pending: ${stats.pending_approval}`);
    console.log(`🔨 In Progress: ${stats.in_progress}`);
    console.log(`✓ Completed: ${stats.completed}`);
    console.log(`🎯 Avg Assignment Attempts: ${stats.avg_assignment_attempts}`);

    // Show recent assignment activity
    console.log('\n🔄 RECENT ASSIGNMENT ACTIVITY:');
    console.log('==============================');
    
    const recentAssignments = await client.query(`
      SELECT 
        nal.job_id,
        j.title_company,
        CONCAT(u.first_name, ' ', u.last_name) as notary_name,
        nal.assignment_type,
        nal.assignment_status,
        nal.assigned_at
      FROM notary_assignment_log nal
      JOIN jobs j ON nal.job_id = j.id
      JOIN users u ON nal.notary_id = u.id
      ORDER BY nal.assigned_at DESC
      LIMIT 10
    `);

    if (recentAssignments.rows.length > 0) {
      recentAssignments.rows.forEach(assignment => {
        const status = assignment.assignment_status === 'assigned' ? '🔄' : 
                      assignment.assignment_status === 'accepted' ? '✅' : 
                      assignment.assignment_status === 'rejected' ? '❌' : '❓';
        console.log(`${status} Job #${assignment.job_id}: ${assignment.notary_name} (${assignment.assignment_type})`);
        console.log(`   Company: ${assignment.title_company} | ${new Date(assignment.assigned_at).toLocaleDateString()}`);
      });
    } else {
      console.log('No recent assignment activity found.');
    }

    // Recommendations
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('===================');
    
    if (successRate === 100) {
      console.log('🎉 Excellent! All jobs are healthy.');
      console.log('✓ Keep monitoring with: npm run job:validate');
    } else if (successRate >= 80) {
      console.log('👍 Good health score, but room for improvement:');
      console.log('   - Run: npm run job:fix (to auto-fix simple issues)');
      console.log('   - Monitor: npm run job:stats (for ongoing tracking)');
    } else if (successRate >= 60) {
      console.log('⚠️ Moderate issues detected:');
      console.log('   1. Run: npm run job:fix (comprehensive fix)');
      console.log('   2. Run: npm run notary:assign (for missing notaries)');
      console.log('   3. Run: npm run participants:add (for missing participants)');
    } else {
      console.log('🚨 Critical issues detected:');
      console.log('   1. URGENT: Run npm run job:fix immediately');
      console.log('   2. Review: Manual intervention may be required');
      console.log('   3. Monitor: Check logs for ongoing problems');
    }

    console.log('\n🔧 Available Commands:');
    console.log('   npm run job:fix         - Comprehensive auto-fix');
    console.log('   npm run job:stats       - Detailed statistics');
    console.log('   npm run notary:assign   - Assign missing notaries');
    console.log('   npm run participants:add - Add missing participants');

  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run validation
validateJobIntegrity()
  .then(() => {
    console.log('\n✅ Job integrity validation completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Validation error:', error);
    process.exit(1);
  }); 