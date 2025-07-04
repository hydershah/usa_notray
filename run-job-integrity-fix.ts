import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FixResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

async function runJobIntegrityFix(): Promise<FixResult> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Read the SQL migration file
    const sqlFile = resolve(__dirname, 'job-integrity-fix.sql');
    const migrationSQL = readFileSync(sqlFile, 'utf8');

    console.log('📋 Starting comprehensive job integrity fix...');
    console.log('');

    // Execute the migration
    const result = await client.query(migrationSQL);
    
    console.log('✅ Job integrity fix completed successfully!');
    console.log('');

    // Get summary statistics
    const summaryResult = await client.query(`
      SELECT 
        issue_type,
        COUNT(*) as count
      FROM problematic_jobs 
      GROUP BY issue_type
      ORDER BY 
        CASE issue_type 
          WHEN 'HEALTHY' THEN 1 
          ELSE 2 
        END,
        count DESC
    `);

    console.log('📊 FINAL STATUS REPORT:');
    console.log('========================');
    
    let totalJobs = 0;
    let healthyJobs = 0;
    
    summaryResult.rows.forEach(row => {
      const status = row.issue_type === 'HEALTHY' ? '✅' : '❌';
      console.log(`${status} ${row.issue_type}: ${row.count} jobs`);
      
      totalJobs += parseInt(row.count);
      if (row.issue_type === 'HEALTHY') {
        healthyJobs = parseInt(row.count);
      }
    });

    const successRate = totalJobs > 0 ? Math.round((healthyJobs / totalJobs) * 100) : 0;
    console.log('========================');
    console.log(`📈 Success Rate: ${successRate}% (${healthyJobs}/${totalJobs} jobs healthy)`);
    console.log('');

    // Get detailed problematic jobs if any
    if (healthyJobs < totalJobs) {
      console.log('🔍 REMAINING ISSUES:');
      const detailedIssues = await client.query(`
        SELECT 
          id,
          title_company,
          issue_type,
          job_status,
          signer_count,
          document_count,
          created_at::date as created_date
        FROM problematic_jobs 
        WHERE issue_type != 'HEALTHY'
        ORDER BY created_at DESC
        LIMIT 10
      `);

      detailedIssues.rows.forEach(job => {
        console.log(`   Job #${job.id} (${job.title_company}): ${job.issue_type}`);
        console.log(`     Status: ${job.job_status} | Signers: ${job.signer_count} | Docs: ${job.document_count}`);
      });

      if (detailedIssues.rows.length === 10) {
        console.log('   ... (showing first 10 issues)');
      }
      console.log('');
    }

    // Provide recommendations
    console.log('📝 RECOMMENDATIONS:');
    console.log('==================');
    
    if (healthyJobs === totalJobs) {
      console.log('✅ All jobs are now healthy! No further action needed.');
    } else {
      console.log('🔧 NEXT STEPS TO FIX REMAINING ISSUES:');
      
      const issueStats = summaryResult.rows.reduce((acc, row) => {
        if (row.issue_type !== 'HEALTHY') {
          acc[row.issue_type] = parseInt(row.count);
        }
        return acc;
      }, {} as Record<string, number>);

      if (issueStats.NO_NOTARY) {
        console.log(`   1. ${issueStats.NO_NOTARY} jobs need notary assignment:`);
        console.log('      - Run: npm run assign-notaries');
        console.log('      - Or manually assign via admin panel');
      }

      if (issueStats.NO_PARTICIPANTS) {
        console.log(`   2. ${issueStats.NO_PARTICIPANTS} jobs need participants:`);
        console.log('      - Add signers via job details modal');
        console.log('      - Or run: npm run add-default-participants');
      }

      if (issueStats.NO_DOCUMENTS) {
        console.log(`   3. ${issueStats.NO_DOCUMENTS} jobs need documents:`);
        console.log('      - Upload documents via job details');
        console.log('      - Jobs without documents cannot be completed');
      }
    }

    console.log('');
    console.log('🎯 The system now has safeguards to prevent these issues in the future!');

    return {
      success: true,
      message: 'Job integrity fix completed successfully',
      data: {
        totalJobs,
        healthyJobs,
        successRate,
        issues: summaryResult.rows
      }
    };

  } catch (error) {
    console.error('❌ Job integrity fix failed:', error);
    return {
      success: false,
      message: 'Job integrity fix failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runJobIntegrityFix()
    .then(result => {
      if (result.success) {
        console.log('\n🎉 Job integrity fix completed successfully!');
        process.exit(0);
      } else {
        console.error('\n💥 Job integrity fix failed:', result.error);
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

export { runJobIntegrityFix }; 