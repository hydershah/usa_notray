/**
 * 🧪 JOB CREATION PERFORMANCE TEST SUITE
 * Tests the optimized job creation endpoint to measure improvements
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-test-token-here';

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Single Signer - No Documents',
    signers: 1,
    documents: 0,
    expectedTime: '< 2s'
  },
  {
    name: 'Multiple Signers - No Documents', 
    signers: 3,
    documents: 0,
    expectedTime: '< 3s'
  },
  {
    name: 'Single Signer - Multiple Documents',
    signers: 1,
    documents: 2,
    expectedTime: '< 4s'
  },
  {
    name: 'Multiple Signers - Multiple Documents',
    signers: 3,
    documents: 2,
    expectedTime: '< 5s'
  },
  {
    name: 'Heavy Load Test',
    signers: 5,
    documents: 3,
    expectedTime: '< 6s'
  }
];

/**
 * Creates test data for job creation
 */
function createTestJobData(scenarioConfig) {
  const signers = [];
  
  // Generate test signers
  for (let i = 0; i < scenarioConfig.signers; i++) {
    signers.push({
      signerEmail: `test.signer${i}@testnotary.com`,
      signerName: `Test Signer ${i + 1}`,
      signerRole: 'signer',
      signerPhoneNumber: `555-000-${1000 + i}`
    });
  }

  return {
    titleCompany: 'Performance Test Company',
    closingType: 'Purchase',
    kbaRequired: 'false',
    notaryOption: 'admin_self',
    propertyAddressOne: '123 Test Street',
    propertyCity: 'Test City',
    propertyState: 'CA',
    propertyZipCode: '90210',
    closingDate: '2025-01-30',
    selectedDate: '2025-01-30',
    selectedTime: '10:00 AM',
    signers: JSON.stringify(signers)
  };
}

/**
 * Creates test documents for upload
 */
function createTestDocuments(count) {
  const documents = [];
  
  for (let i = 0; i < count; i++) {
    // Create a simple test PDF buffer
    const testContent = `%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n\nTest Document ${i + 1} Content\n%%EOF`;
    const buffer = Buffer.from(testContent);
    
    documents.push({
      fieldname: 'documents',
      originalname: `test-document-${i + 1}.pdf`,
      buffer: buffer,
      mimetype: 'application/pdf'
    });
  }
  
  return documents;
}

/**
 * Executes a single job creation test
 */
async function runSingleTest(scenario) {
  console.log(`\n🧪 Testing: ${scenario.name}`);
  console.log(`   Expected: ${scenario.expectedTime}`);
  
  const testData = createTestJobData(scenario);
  const testDocuments = createTestDocuments(scenario.documents);
  
  // Prepare FormData
  const formData = new FormData();
  
  // Add job data
  Object.keys(testData).forEach(key => {
    formData.append(key, testData[key]);
  });
  
  // Add document files
  testDocuments.forEach(doc => {
    formData.append('documents', doc.buffer, {
      filename: doc.originalname,
      contentType: doc.mimetype
    });
  });
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(`${BASE_URL}/api/jobs`, formData, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        ...formData.getHeaders()
      },
      timeout: 30000 // 30 second timeout
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Parse performance data from response
    const performanceData = response.data.performance || {};
    
    const results = {
      success: true,
      duration,
      jobId: response.data.id,
      documentCount: response.data.documentCount,
      performance: performanceData,
      scenario
    };
    
    console.log(`   ✅ SUCCESS: ${duration}ms`);
    console.log(`   📊 Performance Improvement: ${performanceData.improvementPercentage || 'N/A'}%`);
    console.log(`   📄 Documents: ${results.documentCount}`);
    console.log(`   🆔 Job ID: ${results.jobId}`);
    
    return results;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`   ❌ FAILED: ${duration}ms`);
    console.log(`   Error: ${error.response?.data?.message || error.message}`);
    
    return {
      success: false,
      duration,
      error: error.response?.data?.message || error.message,
      scenario
    };
  }
}

/**
 * Runs performance comparison tests
 */
async function runPerformanceTests() {
  console.log('🚀 JOB CREATION PERFORMANCE TEST SUITE');
  console.log('=====================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Scenarios: ${TEST_SCENARIOS.length}`);
  
  const results = [];
  let totalTests = 0;
  let successfulTests = 0;
  let totalTime = 0;
  
  for (const scenario of TEST_SCENARIOS) {
    const result = await runSingleTest(scenario);
    results.push(result);
    
    totalTests++;
    if (result.success) {
      successfulTests++;
      totalTime += result.duration;
    }
    
    // Wait between tests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Calculate summary statistics
  const averageTime = successfulTests > 0 ? Math.round(totalTime / successfulTests) : 0;
  const successRate = Math.round((successfulTests / totalTests) * 100);
  
  console.log('\n📊 PERFORMANCE TEST SUMMARY');
  console.log('============================');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests}`);
  console.log(`Success Rate: ${successRate}%`);
  console.log(`Average Time: ${averageTime}ms`);
  
  // Performance analysis
  const fastTests = results.filter(r => r.success && r.duration < 3000).length;
  const moderateTests = results.filter(r => r.success && r.duration >= 3000 && r.duration < 6000).length;
  const slowTests = results.filter(r => r.success && r.duration >= 6000).length;
  
  console.log('\n⚡ PERFORMANCE BREAKDOWN:');
  console.log(`Fast (< 3s): ${fastTests} tests`);
  console.log(`Moderate (3-6s): ${moderateTests} tests`);
  console.log(`Slow (> 6s): ${slowTests} tests`);
  
  // Expected vs Actual comparison
  console.log('\n🎯 OPTIMIZATION SUCCESS:');
  const originalTime = 15000; // Original ~15-20s average
  const newAverageTime = averageTime;
  const improvement = Math.round(((originalTime - newAverageTime) / originalTime) * 100);
  
  console.log(`Original Average: ~15-20s`);
  console.log(`New Average: ${newAverageTime}ms`);
  console.log(`Performance Improvement: ${improvement}%`);
  
  if (improvement >= 70) {
    console.log('🎉 EXCELLENT: Optimization target achieved!');
  } else if (improvement >= 50) {
    console.log('✅ GOOD: Significant improvement, room for more optimization');
  } else if (improvement >= 25) {
    console.log('⚠️ MODERATE: Some improvement, needs more optimization');
  } else {
    console.log('❌ POOR: Little improvement, optimization not working');
  }
  
  // Detailed results
  console.log('\n📋 DETAILED RESULTS:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const time = result.duration;
    const improvement = result.performance?.improvementPercentage || 'N/A';
    
    console.log(`${index + 1}. ${status} ${result.scenario.name}: ${time}ms (${improvement}% improvement)`);
  });
  
  return results;
}

/**
 * Tests specific optimization components
 */
async function testOptimizationComponents() {
  console.log('\n🔍 TESTING OPTIMIZATION COMPONENTS');
  console.log('==================================');
  
  // Test 1: Parallel bcrypt operations
  console.log('\n1. Testing parallel bcrypt operations...');
  const bcryptTest = await runSingleTest({
    name: 'Bcrypt Test (5 new signers)',
    signers: 5,
    documents: 0
  });
  
  if (bcryptTest.success && bcryptTest.duration < 4000) {
    console.log('   ✅ Parallel bcrypt working (< 4s for 5 signers)');
  } else {
    console.log('   ⚠️ Bcrypt optimization may need improvement');
  }
  
  // Test 2: File upload optimization
  console.log('\n2. Testing parallel file uploads...');
  const uploadTest = await runSingleTest({
    name: 'Upload Test (3 documents)',
    signers: 1,
    documents: 3
  });
  
  if (uploadTest.success && uploadTest.duration < 5000) {
    console.log('   ✅ Parallel uploads working (< 5s for 3 docs)');
  } else {
    console.log('   ⚠️ Upload optimization may need improvement');
  }
}

/**
 * Main test execution
 */
async function main() {
  try {
    // Verify server is running
    console.log('🔗 Checking server connection...');
    await axios.get(`${BASE_URL}/health`).catch(() => {
      console.log('⚠️ Server health check failed, but continuing with tests...');
    });
    
    // Run performance tests
    const results = await runPerformanceTests();
    
    // Test optimization components
    await testOptimizationComponents();
    
    // Save results to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `performance-test-results-${timestamp}.json`;
    
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      results,
      summary: {
        totalTests: results.length,
        successfulTests: results.filter(r => r.success).length,
        averageTime: Math.round(results.filter(r => r.success).reduce((sum, r) => sum + r.duration, 0) / results.filter(r => r.success).length)
      }
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  runPerformanceTests,
  testOptimizationComponents,
  runSingleTest
}; 