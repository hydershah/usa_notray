const { spawn } = require('child_process');
const fs = require('fs');

async function testEVSVerificationHandler() {
  console.log('🧪 Testing EVS Verification Handler...\n');

  // Create a test script that imports and tests the new handler
  const testScript = `
import { EVSVerificationHandler } from './server/services/evs-verification-handler.js';

async function runTest() {
  console.log('🔍 Testing EVS Verification Handler...');

  // Test successful verification
  const successfulEVSResult = {
    success: true,
    status: 'approved',
    confidence: 95,
    transactionId: 'test_' + Date.now(),
    document: {
      extractedData: {
        firstName: 'Test',
        lastName: 'User',
        dateOfBirth: '1990-01-01',
        documentNumber: 'D123456789'
      }
    }
  };

  console.log('\\n✅ Testing successful verification...');
  const successResult = await EVSVerificationHandler.updateUserVerificationStatus('44', successfulEVSResult);
  console.log('Success result:', successResult);

  // Check user status
  const userStatus = await EVSVerificationHandler.getUserVerificationStatus('44');
  console.log('User status after update:', userStatus);

  // Test failed verification
  const failedEVSResult = {
    success: false,
    status: 'rejected',
    confidence: 30,
    transactionId: 'test_failed_' + Date.now()
  };

  console.log('\\n❌ Testing failed verification...');
  const failResult = await EVSVerificationHandler.updateUserVerificationStatus('44', failedEVSResult);
  console.log('Fail result:', failResult);

  // Log verification attempt
  await EVSVerificationHandler.logVerificationAttempt('44', successfulEVSResult, 1500);

  console.log('\\n🎉 Test completed!');
}

runTest().catch(console.error);
`;

  // Write the test script to a temporary file
  fs.writeFileSync('temp-test-evs-handler.mjs', testScript);

  console.log('📝 Created test script...');
  console.log('🚀 Running EVS handler test...\n');

  // Run the test script
  const testProcess = spawn('node', ['temp-test-evs-handler.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test' }
  });

  testProcess.on('close', (code) => {
    // Clean up
    if (fs.existsSync('temp-test-evs-handler.mjs')) {
      fs.unlinkSync('temp-test-evs-handler.mjs');
    }
    
    if (code === 0) {
      console.log('\n✅ EVS Handler test completed successfully!');
    } else {
      console.log(`\n❌ EVS Handler test failed with code ${code}`);
    }
  });

  testProcess.on('error', (error) => {
    console.error('💥 Error running test:', error);
    // Clean up
    if (fs.existsSync('temp-test-evs-handler.mjs')) {
      fs.unlinkSync('temp-test-evs-handler.mjs');
    }
  });
}

// Run the test
testEVSVerificationHandler(); 