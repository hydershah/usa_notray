import { Client } from 'pg';

interface ValidationResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

async function validateEmailSystem() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  const results: ValidationResult[] = [];

  try {
    await client.connect();
    console.log('🔗 Connected to database');
    console.log('📧 COMPREHENSIVE EMAIL SYSTEM VALIDATION');
    console.log('=========================================');
    console.log('');

    // Test 1: Check for duplicate emails in users table
    console.log('🔍 Test 1: Checking for duplicate emails...');
    const duplicateEmailsResult = await client.query(`
      SELECT email, COUNT(*) as count, array_agg(id) as user_ids
      FROM users 
      GROUP BY email 
      HAVING COUNT(*) > 1 
      ORDER BY count DESC
    `);

    if (duplicateEmailsResult.rows.length === 0) {
      results.push({
        testName: 'Duplicate Email Check',
        status: 'PASS',
        message: 'No duplicate emails found in users table'
      });
    } else {
      results.push({
        testName: 'Duplicate Email Check',
        status: 'FAIL',
        message: `Found ${duplicateEmailsResult.rows.length} duplicate emails`,
        details: duplicateEmailsResult.rows
      });
    }

    // Test 2: Check unique constraint exists
    console.log('🔍 Test 2: Checking email unique constraint...');
    const constraintResult = await client.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name LIKE '%email%'
    `);

    const emailIndexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND indexname LIKE '%email%'
      AND indexdef LIKE '%UNIQUE%'
    `);

    if (constraintResult.rows.length > 0 || emailIndexResult.rows.length > 0) {
      results.push({
        testName: 'Email Unique Constraint',
        status: 'PASS',
        message: 'Email uniqueness constraint exists',
        details: {
          constraints: constraintResult.rows,
          indexes: emailIndexResult.rows
        }
      });
    } else {
      results.push({
        testName: 'Email Unique Constraint',
        status: 'FAIL',
        message: 'No email uniqueness constraint found!'
      });
    }

    // Test 3: User-Job relationship validation
    console.log('🔍 Test 3: Checking user-job relationships...');
    const userJobsResult = await client.query(`
      SELECT 
        u.email,
        u.id as user_id,
        COUNT(j.id) as job_count,
        array_agg(j.id ORDER BY j.created_at DESC) as job_ids
      FROM users u
      LEFT JOIN jobs j ON u.id = j.user_id
      WHERE u.role IN ('admin', 'title_company_user', 'notary')
      GROUP BY u.id, u.email
      HAVING COUNT(j.id) > 0
      ORDER BY job_count DESC
      LIMIT 10
    `);

    const totalUsersWithJobs = userJobsResult.rows.length;
    const usersWithMultipleJobs = userJobsResult.rows.filter(row => row.job_count > 1).length;

    results.push({
      testName: 'User-Job Relationships',
      status: 'PASS',
      message: `${totalUsersWithJobs} users have jobs, ${usersWithMultipleJobs} users have multiple jobs (expected)`,
      details: {
        usersWithJobs: totalUsersWithJobs,
        usersWithMultipleJobs: usersWithMultipleJobs,
        topUsers: userJobsResult.rows.slice(0, 5)
      }
    });

    // Test 4: Check for email variations (case sensitivity issues)
    console.log('🔍 Test 4: Checking for case-sensitive email duplicates...');
    const caseSensitiveResult = await client.query(`
      SELECT 
        LOWER(email) as normalized_email,
        COUNT(*) as count,
        array_agg(email) as email_variations,
        array_agg(id) as user_ids
      FROM users 
      GROUP BY LOWER(email) 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);

    if (caseSensitiveResult.rows.length === 0) {
      results.push({
        testName: 'Case-Sensitive Email Check',
        status: 'PASS',
        message: 'No case-sensitive email duplicates found'
      });
    } else {
      results.push({
        testName: 'Case-Sensitive Email Check',
        status: 'WARNING',
        message: `Found ${caseSensitiveResult.rows.length} case-sensitive email duplicates`,
        details: caseSensitiveResult.rows
      });
    }

    // Test 5: Test duplicate email insertion (should fail)
    console.log('🔍 Test 5: Testing duplicate email prevention...');
    try {
      // Get an existing email
      const existingUserResult = await client.query(`
        SELECT email FROM users LIMIT 1
      `);
      
      if (existingUserResult.rows.length > 0) {
        const existingEmail = existingUserResult.rows[0].email;
        
        // Try to insert a duplicate (this should fail)
        await client.query('BEGIN');
        try {
          await client.query(`
            INSERT INTO users (username, email, password, role, first_name, last_name)
            VALUES ('test_duplicate', $1, 'test_password', 'signer', 'Test', 'Duplicate')
          `, [existingEmail]);
          
          // If we reach here, duplicate was allowed (BAD!)
          await client.query('ROLLBACK');
          results.push({
            testName: 'Duplicate Email Prevention',
            status: 'FAIL',
            message: 'Duplicate email insertion was allowed! System is vulnerable!'
          });
        } catch (error) {
          // If insertion failed due to constraint (GOOD!)
          await client.query('ROLLBACK');
          if (error.code === '23505') { // unique violation
            results.push({
              testName: 'Duplicate Email Prevention',
              status: 'PASS',
              message: 'Duplicate email insertion properly blocked by database constraint'
            });
          } else {
            results.push({
              testName: 'Duplicate Email Prevention',
              status: 'WARNING',
              message: `Duplicate email insertion failed for unexpected reason: ${error.message}`
            });
          }
        }
      } else {
        results.push({
          testName: 'Duplicate Email Prevention',
          status: 'WARNING',
          message: 'No existing users found to test duplicate prevention'
        });
      }
    } catch (error) {
      results.push({
        testName: 'Duplicate Email Prevention',
        status: 'FAIL',
        message: `Test failed: ${error.message}`
      });
    }

    // Test 6: Check signup endpoints protection
    console.log('🔍 Test 6: Checking related tables for email consistency...');
    
    // Check signers table for email consistency
    const signersEmailResult = await client.query(`
      SELECT 
        s.signer_email,
        COUNT(*) as count,
        array_agg(DISTINCT s.job_id) as job_ids,
        array_agg(DISTINCT u.id) as user_ids
      FROM signers s
      LEFT JOIN users u ON s.signer_email = u.email
      GROUP BY s.signer_email
      HAVING COUNT(DISTINCT CASE WHEN u.id IS NOT NULL THEN u.id END) > 1
    `);

    if (signersEmailResult.rows.length === 0) {
      results.push({
        testName: 'Signers Email Consistency',
        status: 'PASS',
        message: 'No email conflicts in signers table'
      });
    } else {
      results.push({
        testName: 'Signers Email Consistency',
        status: 'WARNING',
        message: `Found ${signersEmailResult.rows.length} emails with multiple user IDs in signers table`,
        details: signersEmailResult.rows
      });
    }

    // Test 7: Check job_participants table
    const participantsEmailResult = await client.query(`
      SELECT 
        jp.email,
        COUNT(*) as count,
        array_agg(DISTINCT jp.job_id) as job_ids,
        array_agg(DISTINCT u.id) as user_ids
      FROM job_participants jp
      LEFT JOIN users u ON jp.email = u.email
      GROUP BY jp.email
      HAVING COUNT(DISTINCT CASE WHEN u.id IS NOT NULL THEN u.id END) > 1
    `);

    if (participantsEmailResult.rows.length === 0) {
      results.push({
        testName: 'Job Participants Email Consistency',
        status: 'PASS',
        message: 'No email conflicts in job_participants table'
      });
    } else {
      results.push({
        testName: 'Job Participants Email Consistency',
        status: 'WARNING',
        message: `Found ${participantsEmailResult.rows.length} emails with multiple user IDs in job_participants table`,
        details: participantsEmailResult.rows
      });
    }

    // Test 8: Check for placeholder/temp emails that should be cleaned up
    console.log('🔍 Test 8: Checking for placeholder emails...');
    const placeholderEmailResult = await client.query(`
      SELECT 
        email,
        id,
        role,
        created_at
      FROM users 
      WHERE email LIKE '%temp.example.com%' 
      OR email LIKE '%placeholder%'
      ORDER BY created_at DESC
    `);

    if (placeholderEmailResult.rows.length === 0) {
      results.push({
        testName: 'Placeholder Email Check',
        status: 'PASS',
        message: 'No placeholder emails found'
      });
    } else {
      results.push({
        testName: 'Placeholder Email Check',
        status: 'WARNING',
        message: `Found ${placeholderEmailResult.rows.length} placeholder emails that should be cleaned up`,
        details: placeholderEmailResult.rows
      });
    }

    // Summary Report
    console.log('');
    console.log('📊 VALIDATION RESULTS:');
    console.log('======================');
    
    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const warningCount = results.filter(r => r.status === 'WARNING').length;

    results.forEach(result => {
      const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${emoji} ${result.testName}: ${result.message}`);
      
      if (result.details && (result.status === 'FAIL' || result.status === 'WARNING')) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });

    console.log('');
    console.log('📈 SUMMARY:');
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️ Warnings: ${warningCount}`);
    console.log('');

    // Overall system status
    if (failCount === 0) {
      console.log('🎉 SYSTEM STATUS: EMAIL UNIQUENESS PROPERLY ENFORCED');
      console.log('✅ Users can have multiple jobs');
      console.log('✅ Users cannot create duplicate accounts');
      console.log('✅ Database constraints are working');
    } else {
      console.log('🚨 SYSTEM STATUS: CRITICAL EMAIL SECURITY ISSUES DETECTED');
      console.log('❌ Immediate action required to fix email uniqueness issues');
    }

    if (warningCount > 0) {
      console.log('');
      console.log('⚠️ RECOMMENDATIONS:');
      console.log('===================');
      
      const placeholderWarning = results.find(r => r.testName === 'Placeholder Email Check' && r.status === 'WARNING');
      if (placeholderWarning) {
        console.log('1. Clean up placeholder emails from temp.example.com domain');
        console.log('2. Replace with real user information or remove unused accounts');
      }
      
      const caseWarning = results.find(r => r.testName === 'Case-Sensitive Email Check' && r.status === 'WARNING');
      if (caseWarning) {
        console.log('3. Normalize email addresses to lowercase for consistency');
        console.log('4. Consider adding email normalization to signup process');
      }
    }

    return {
      overall: failCount === 0 ? 'SECURE' : 'VULNERABLE',
      results
    };

  } catch (error) {
    console.error('❌ Email system validation failed:', error);
    throw error;
  } finally {
    await client.end();
    console.log('');
    console.log('🔌 Database connection closed');
  }
}

// Run validation
validateEmailSystem()
  .then((result) => {
    console.log(`\n🎯 Email system validation completed: ${result.overall}`);
    process.exit(result.overall === 'SECURE' ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Validation error:', error);
    process.exit(1);
  }); 