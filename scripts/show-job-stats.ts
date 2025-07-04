import { Client } from 'pg';

async function showJobStats() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('📊 JOB SYSTEM STATISTICS REPORT');
    console.log('================================');
    console.log(`Generated: ${new Date().toLocaleString()}`);
    console.log('');

    // Overall job counts
    const overallStats = await client.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN job_status = 'open' THEN 1 END) as open_jobs,
        COUNT(CASE WHEN job_status = 'pending' THEN 1 END) as pending_jobs,
        COUNT(CASE WHEN job_status = 'in_progress' THEN 1 END) as in_progress_jobs,
        COUNT(CASE WHEN job_status = 'completed' THEN 1 END) as completed_jobs,
        COUNT(CASE WHEN job_status = 'cancelled' THEN 1 END) as cancelled_jobs,
        COUNT(CASE WHEN job_status = 'expired' THEN 1 END) as expired_jobs
      FROM jobs
    `);

    const stats = overallStats.rows[0];
    
    console.log('📈 JOB STATUS BREAKDOWN:');
    console.log('========================');
    console.log(`🟢 Total Jobs: ${stats.total_jobs}`);
    console.log(`🔓 Open: ${stats.open_jobs}`);
    console.log(`⏳ Pending: ${stats.pending_jobs}`);
    console.log(`🔄 In Progress: ${stats.in_progress_jobs}`);
    console.log(`✅ Completed: ${stats.completed_jobs}`);
    console.log(`❌ Cancelled: ${stats.cancelled_jobs}`);
    console.log(`⏰ Expired: ${stats.expired_jobs}`);
    console.log('');

    // Notary assignment stats
    const notaryStats = await client.query(`
      SELECT 
        COUNT(*) as total_active_jobs,
        COUNT(CASE WHEN notary_id IS NOT NULL THEN 1 END) as jobs_with_notary,
        COUNT(CASE WHEN notary_option = 'auto' THEN 1 END) as auto_assignment_jobs,
        COUNT(CASE WHEN notary_option = 'assign' THEN 1 END) as manual_assignment_jobs,
        COUNT(CASE WHEN notary_option = 'admin_self' THEN 1 END) as admin_self_jobs,
        COUNT(CASE WHEN is_random_assignment = true THEN 1 END) as random_assignments,
        ROUND(AVG(assignment_attempts), 2) as avg_assignment_attempts
      FROM jobs 
      WHERE job_status != 'cancelled'
    `);

    const notaryData = notaryStats.rows[0];
    const assignmentRate = notaryData.total_active_jobs > 0 ? 
      Math.round((notaryData.jobs_with_notary / notaryData.total_active_jobs) * 100) : 0;

    console.log('👨‍⚖️ NOTARY ASSIGNMENT ANALYSIS:');
    console.log('================================');
    console.log(`📊 Assignment Rate: ${assignmentRate}% (${notaryData.jobs_with_notary}/${notaryData.total_active_jobs})`);
    console.log(`🤖 Auto Assignment Jobs: ${notaryData.auto_assignment_jobs}`);
    console.log(`👤 Manual Assignment Jobs: ${notaryData.manual_assignment_jobs}`);
    console.log(`🔑 Admin Self-Assignment: ${notaryData.admin_self_jobs}`);
    console.log(`🎲 Random Assignments: ${notaryData.random_assignments}`);
    console.log(`🔄 Avg Assignment Attempts: ${notaryData.avg_assignment_attempts}`);
    console.log('');

    // Approval workflow stats
    const approvalStats = await client.query(`
      SELECT 
        notary_approval_status,
        COUNT(*) as count
      FROM jobs 
      WHERE job_status != 'cancelled'
      GROUP BY notary_approval_status
      ORDER BY count DESC
    `);

    console.log('✅ APPROVAL WORKFLOW STATUS:');
    console.log('============================');
    approvalStats.rows.forEach(row => {
      const emoji = row.notary_approval_status === 'approved' ? '✅' :
                   row.notary_approval_status === 'pending_assignment' ? '⏳' :
                   row.notary_approval_status === 'assigned_pending_approval' ? '🔄' :
                   row.notary_approval_status === 'rejected' ? '❌' : '❓';
      console.log(`${emoji} ${row.notary_approval_status}: ${row.count} jobs`);
    });
    console.log('');

    // Document and participant stats
    const contentStats = await client.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN doc_count > 0 THEN 1 END) as jobs_with_docs,
        COUNT(CASE WHEN signer_count > 0 THEN 1 END) as jobs_with_signers,
        COUNT(CASE WHEN participant_count > 0 THEN 1 END) as jobs_with_participants,
        ROUND(AVG(doc_count), 2) as avg_docs_per_job,
        ROUND(AVG(signer_count), 2) as avg_signers_per_job
      FROM (
        SELECT 
          j.id,
          COALESCE(doc_stats.doc_count, 0) as doc_count,
          COALESCE(signer_stats.signer_count, 0) as signer_count,
          COALESCE(participant_stats.participant_count, 0) as participant_count
        FROM jobs j
        LEFT JOIN (
          SELECT job_id, COUNT(*) as doc_count 
          FROM job_documents 
          GROUP BY job_id
        ) doc_stats ON j.id = doc_stats.job_id
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
        WHERE j.job_status != 'cancelled'
      ) combined_stats
    `);

    const contentData = contentStats.rows[0];
    const docsRate = Math.round((contentData.jobs_with_docs / contentData.total_jobs) * 100);
    const signersRate = Math.round((contentData.jobs_with_signers / contentData.total_jobs) * 100);
    const participantsRate = Math.round((contentData.jobs_with_participants / contentData.total_jobs) * 100);

    console.log('📄 CONTENT COMPLETENESS:');
    console.log('========================');
    console.log(`📁 Jobs with Documents: ${docsRate}% (${contentData.jobs_with_docs}/${contentData.total_jobs})`);
    console.log(`✍️ Jobs with Signers: ${signersRate}% (${contentData.jobs_with_signers}/${contentData.total_jobs})`);
    console.log(`👥 Jobs with Participants: ${participantsRate}% (${contentData.jobs_with_participants}/${contentData.total_jobs})`);
    console.log(`📊 Avg Documents per Job: ${contentData.avg_docs_per_job}`);
    console.log(`📊 Avg Signers per Job: ${contentData.avg_signers_per_job}`);
    console.log('');

    // Recent activity trends
    const activityStats = await client.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as jobs_created,
        COUNT(CASE WHEN notary_id IS NOT NULL THEN 1 END) as jobs_with_notary
      FROM jobs 
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 7
    `);

    console.log('📅 RECENT ACTIVITY (Last 7 Days):');
    console.log('==================================');
    if (activityStats.rows.length > 0) {
      activityStats.rows.forEach(day => {
        const rate = day.jobs_created > 0 ? Math.round((day.jobs_with_notary / day.jobs_created) * 100) : 0;
        console.log(`${day.date}: ${day.jobs_created} jobs created, ${rate}% with notary`);
      });
    } else {
      console.log('No recent activity found.');
    }
    console.log('');

    // Title company breakdown
    const companyStats = await client.query(`
      SELECT 
        title_company,
        COUNT(*) as job_count,
        COUNT(CASE WHEN notary_id IS NOT NULL THEN 1 END) as jobs_with_notary,
        COUNT(CASE WHEN job_status = 'completed' THEN 1 END) as completed_jobs
      FROM jobs 
      WHERE job_status != 'cancelled'
      GROUP BY title_company
      ORDER BY job_count DESC
      LIMIT 10
    `);

    console.log('🏢 TOP TITLE COMPANIES:');
    console.log('=======================');
    companyStats.rows.forEach((company, index) => {
      const notaryRate = company.job_count > 0 ? Math.round((company.jobs_with_notary / company.job_count) * 100) : 0;
      const completionRate = company.job_count > 0 ? Math.round((company.completed_jobs / company.job_count) * 100) : 0;
      console.log(`${index + 1}. ${company.title_company}: ${company.job_count} jobs`);
      console.log(`   Notary Rate: ${notaryRate}% | Completion Rate: ${completionRate}%`);
    });
    console.log('');

    // Performance indicators
    const performanceIndicators = await client.query(`
      SELECT 
        COUNT(CASE WHEN notary_id IS NOT NULL AND signer_count > 0 AND doc_count > 0 THEN 1 END) as healthy_jobs,
        COUNT(*) as total_jobs,
        COUNT(CASE WHEN job_status = 'completed' AND completed_at IS NOT NULL THEN 1 END) as properly_completed,
        COUNT(CASE WHEN job_status = 'completed' THEN 1 END) as total_completed
      FROM (
        SELECT 
          j.*,
          COALESCE(doc_stats.doc_count, 0) as doc_count,
          COALESCE(signer_stats.signer_count, 0) as signer_count
        FROM jobs j
        LEFT JOIN (
          SELECT job_id, COUNT(*) as doc_count 
          FROM job_documents 
          GROUP BY job_id
        ) doc_stats ON j.id = doc_stats.job_id
        LEFT JOIN (
          SELECT job_id, COUNT(*) as signer_count 
          FROM signers 
          GROUP BY job_id
        ) signer_stats ON j.id = signer_stats.job_id
        WHERE j.job_status != 'cancelled'
      ) combined_data
    `);

    const perfData = performanceIndicators.rows[0];
    const healthScore = perfData.total_jobs > 0 ? Math.round((perfData.healthy_jobs / perfData.total_jobs) * 100) : 0;
    const completionIntegrity = perfData.total_completed > 0 ? 
      Math.round((perfData.properly_completed / perfData.total_completed) * 100) : 0;

    console.log('🎯 HEALTH INDICATORS:');
    console.log('=====================');
    console.log(`💚 Overall Health Score: ${healthScore}% (${perfData.healthy_jobs}/${perfData.total_jobs} jobs)`);
    console.log(`🔒 Completion Integrity: ${completionIntegrity}% (${perfData.properly_completed}/${perfData.total_completed} completed jobs)`);
    console.log('');

    // Recommendations based on data
    console.log('💡 RECOMMENDATIONS:');
    console.log('===================');
    
    if (healthScore >= 90) {
      console.log('🎉 Excellent system health! Keep up the good work.');
    } else if (healthScore >= 70) {
      console.log('👍 Good system health, but room for improvement:');
      if (assignmentRate < 90) console.log('   • Focus on improving notary assignment rate');
      if (docsRate < 80) console.log('   • Improve document upload compliance');
      if (signersRate < 80) console.log('   • Enhance participant management');
    } else {
      console.log('⚠️ System health needs attention:');
      console.log('   1. Run comprehensive fix: npm run job:fix');
      if (assignmentRate < 70) console.log('   2. Address notary assignment issues');
      if (docsRate < 60) console.log('   3. Implement document upload validation');
      if (signersRate < 60) console.log('   4. Fix participant workflow');
    }

    console.log('\n🔧 Available Tools:');
    console.log('   npm run job:validate    - Check current health');
    console.log('   npm run job:fix         - Auto-fix issues');
    console.log('   npm run notary:assign   - Fix notary assignments');
    console.log('   npm run participants:add - Add missing participants');

  } catch (error) {
    console.error('❌ Stats generation failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run stats
showJobStats()
  .then(() => {
    console.log('\n📊 Job statistics report completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Stats error:', error);
    process.exit(1);
  }); 