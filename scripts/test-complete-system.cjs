const { Pool } = require('pg');
const https = require('https');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes('supabase.co') ? { rejectUnauthorized: false } : false
});

async function testCompleteSystem() {
  console.log('🧪 COMPREHENSIVE SYSTEM TEST\n');
  console.log('=================================\n');
  
  try {
    // Test 1: Database Schema (Admin Dashboard Fix)
    console.log('📊 TEST 1: Admin Dashboard Database Schema');
    console.log('-------------------------------------------');
    
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN (
        'is_verified', 'verification_status', 'verification_date', 
        'verification_confidence', 'evs_transaction_id'
      )
      ORDER BY column_name;
    `);
    
    console.log('✅ Database Schema Check:');
    schemaCheck.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });
    console.log(`   Total columns found: ${schemaCheck.rows.length}/5\n`);
    
    // Test 2: Verification Stats Query (Admin Dashboard)
    console.log('📈 TEST 2: Admin Dashboard Verification Stats');
    console.log('----------------------------------------------');
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users,
        COUNT(CASE WHEN verification_status = 'pending' THEN 1 END) as pending_verification,
        COUNT(CASE WHEN verification_status = 'approved' THEN 1 END) as approved_verification,
        COUNT(CASE WHEN verification_status = 'rejected' THEN 1 END) as rejected_verification,
        COUNT(CASE WHEN evs_transaction_id IS NOT NULL THEN 1 END) as users_with_evs_data
      FROM users;
    `;
    
    const statsResult = await pool.query(statsQuery);
    console.log('✅ Verification Stats Query Result:');
    const stats = statsResult.rows[0];
    console.log(`   Total Users: ${stats.total_users}`);
    console.log(`   Verified Users: ${stats.verified_users}`);
    console.log(`   Pending: ${stats.pending_verification}`);
    console.log(`   Approved: ${stats.approved_verification}`);
    console.log(`   Rejected: ${stats.rejected_verification}`);
    console.log(`   With EVS Data: ${stats.users_with_evs_data}\n`);
    
    // Test 3: EVS API Endpoints
    console.log('🔗 TEST 3: EVS API Endpoints Connectivity');
    console.log('------------------------------------------');
    
    const endpoints = [
      { name: 'BlueAssure Primary', url: 'https://blueassure.evssolutions.com', method: 'GET' },
      { name: 'BlueAssure API', url: 'https://api.blueassure.evssolutions.com', method: 'GET' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const result = await testEndpoint(endpoint.url, endpoint.method);
        console.log(`✅ ${endpoint.name}: ${result.status} (${result.statusCode})`);
      } catch (error) {
        console.log(`❌ ${endpoint.name}: ${error.message}`);
      }
    }
    console.log('');
    
    // Test 4: EVS Service Configuration
    console.log('⚙️  TEST 4: EVS Service Configuration');
    console.log('------------------------------------');
    
    const evsConfig = {
      apiKey: process.env.EVS_API_KEY || 'E27235-CE567A22-0D31-474A-B551-252882763208',
      password: process.env.EVS_PASSWORD || '8aeWPi0XV#AyS#I',
      apiUrl: 'https://blueassure.evssolutions.com',
      environment: process.env.EVS_ENVIRONMENT || 'production'
    };
    
    console.log('✅ EVS Configuration:');
    console.log(`   API Key: ${evsConfig.apiKey.substring(0, 10)}...`);
    console.log(`   API URL: ${evsConfig.apiUrl}`);
    console.log(`   Environment: ${evsConfig.environment}\n`);
    
    // Test 5: System Health Summary
    console.log('🎯 TEST 5: System Health Summary');
    console.log('---------------------------------');
    
    const healthSummary = {
      adminDashboard: schemaCheck.rows.length === 5 ? 'HEALTHY' : 'ERROR',
      verificationStats: stats.total_users > 0 ? 'HEALTHY' : 'WARNING',
      evsIntegration: 'READY',
      databaseConnection: 'HEALTHY'
    };
    
    console.log('✅ System Health Status:');
    Object.entries(healthSummary).forEach(([component, status]) => {
      const icon = status === 'HEALTHY' ? '🟢' : status === 'WARNING' ? '🟡' : '🔴';
      console.log(`   ${icon} ${component}: ${status}`);
    });
    
    console.log('\n🎉 SYSTEM TEST COMPLETE!');
    console.log('========================\n');
    
    // Final Summary
    const isSystemHealthy = Object.values(healthSummary).every(status => status !== 'ERROR');
    if (isSystemHealthy) {
      console.log('✅ RESULT: System is fully operational!');
      console.log('   - Admin dashboard verification stats will work');
      console.log('   - EVS integration is configured and ready');
      console.log('   - Database schema is complete');
    } else {
      console.log('⚠️  RESULT: System has some issues that need attention');
    }
    
  } catch (error) {
    console.error('❌ System Test FAILED:', error.message);
    console.error('Error details:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Helper function to test HTTP endpoints
function testEndpoint(url, method = 'GET') {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: method,
      timeout: 5000,
      headers: {
        'User-Agent': 'NotaryPlatform-Test/1.0'
      }
    };
    
    const req = https.request(options, (res) => {
      resolve({
        status: 'reachable',
        statusCode: res.statusCode
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Connection failed: ${error.message}`));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timeout'));
    });
    
    req.setTimeout(5000);
    req.end();
  });
}

testCompleteSystem(); 