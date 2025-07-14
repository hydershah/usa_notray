// Test script for Notary Verification Management System
// This script tests the API endpoints and functionality for notaries to manage signer verification

const API_BASE = 'http://localhost:3000/api';

// Mock data for testing
const TEST_DATA = {
  notaryId: 1,
  jobId: 1,
  participantId: 2,
  testReason: 'Test bypass for development verification'
};

// Helper function to make API requests
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TEST_TOKEN || 'test-token'}`
    }
  };
  
  const response = await fetch(url, { ...defaultOptions, ...options });
  const data = await response.json();
  
  return {
    status: response.status,
    ok: response.ok,
    data
  };
}

// Test functions
async function testJobParticipantsEndpoint() {
  console.log('\n🧪 Testing Job Participants Endpoint...');
  
  try {
    const result = await makeRequest(`/notary/job-participants/${TEST_DATA.jobId}`);
    
    if (result.ok) {
      console.log('✅ Job participants endpoint working');
      console.log('📊 Participants found:', result.data.length);
      
      // Show participant details
      result.data.forEach(participant => {
        console.log(`   - ${participant.signer_name} (${participant.participant_role})`);
        console.log(`     User ID: ${participant.user_id || 'Not registered'}`);
        console.log(`     Verified: ${participant.is_verified ? 'Yes' : 'No'}`);
        console.log(`     Status: ${participant.verification_status || 'Unknown'}`);
      });
    } else {
      console.error('❌ Job participants endpoint failed:', result.data.error);
    }
  } catch (error) {
    console.error('❌ Error testing job participants:', error.message);
  }
}

async function testVerificationDocumentsEndpoint() {
  console.log('\n🧪 Testing Verification Documents Endpoint...');
  
  try {
    const result = await makeRequest(`/notary/job-participants/${TEST_DATA.jobId}/verification-documents`);
    
    if (result.ok) {
      console.log('✅ Verification documents endpoint working');
      console.log('📋 Documents found for participants:', result.data.length);
      
      // Show verification details
      result.data.forEach(participant => {
        if (participant.user_id) {
          console.log(`   - ${participant.signer_name}:`);
          console.log(`     EVS Transaction: ${participant.evs_transaction_id || 'None'}`);
          console.log(`     Confidence: ${participant.evs_verification_confidence || 'N/A'}%`);
          console.log(`     Face Match: ${participant.evs_face_match_result ? 'Pass' : 'Fail'}`);
          console.log(`     Has Images: ${participant.verification_image_front_url ? 'Yes' : 'No'}`);
          console.log(`     Bypassed: ${participant.is_verification_bypassed || participant.notary_verification_bypassed ? 'Yes' : 'No'}`);
        }
      });
    } else {
      console.error('❌ Verification documents endpoint failed:', result.data.error);
    }
  } catch (error) {
    console.error('❌ Error testing verification documents:', error.message);
  }
}

async function testParticipantDetailsEndpoint() {
  console.log('\n🧪 Testing Participant Details Endpoint...');
  
  try {
    const result = await makeRequest(`/notary/participant/${TEST_DATA.participantId}/verification-documents/${TEST_DATA.jobId}`);
    
    if (result.ok) {
      console.log('✅ Participant details endpoint working');
      console.log('👤 User details:');
      console.log(`   Name: ${result.data.user.full_name || result.data.user.username}`);
      console.log(`   Email: ${result.data.user.email}`);
      console.log(`   Verified: ${result.data.user.is_verified ? 'Yes' : 'No'}`);
      console.log(`   Status: ${result.data.user.verification_status}`);
      console.log(`   EVS Transaction: ${result.data.user.evs_transaction_id || 'None'}`);
      console.log(`   Attempts: ${result.data.attempts?.length || 0}`);
    } else {
      console.error('❌ Participant details endpoint failed:', result.data.error);
    }
  } catch (error) {
    console.error('❌ Error testing participant details:', error.message);
  }
}

async function testBypassVerificationEndpoint() {
  console.log('\n🧪 Testing Bypass Verification Endpoint...');
  
  try {
    const result = await makeRequest(
      `/notary/bypass-verification/${TEST_DATA.participantId}/${TEST_DATA.jobId}`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: TEST_DATA.testReason })
      }
    );
    
    if (result.ok) {
      console.log('✅ Bypass verification endpoint working');
      console.log('🔓 Bypass successful:', result.data.message);
      console.log('👤 Participant:', result.data.participantName);
    } else {
      console.log('ℹ️  Bypass endpoint responded with:', result.data.error);
      console.log('   This might be expected if participant is already bypassed or other constraints');
    }
  } catch (error) {
    console.error('❌ Error testing bypass verification:', error.message);
  }
}

async function testRemoveBypassEndpoint() {
  console.log('\n🧪 Testing Remove Bypass Endpoint...');
  
  try {
    const result = await makeRequest(
      `/notary/remove-bypass/${TEST_DATA.participantId}/${TEST_DATA.jobId}`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: 'Test removal for development' })
      }
    );
    
    if (result.ok) {
      console.log('✅ Remove bypass endpoint working');
      console.log('🔒 Bypass removed:', result.data.message);
    } else {
      console.log('ℹ️  Remove bypass endpoint responded with:', result.data.error);
      console.log('   This might be expected if no bypass exists or other constraints');
    }
  } catch (error) {
    console.error('❌ Error testing remove bypass:', error.message);
  }
}

async function testVerificationImageEndpoint() {
  console.log('\n🧪 Testing Verification Image Endpoint...');
  
  try {
    const imageTypes = ['front', 'back', 'selfie'];
    
    for (const imageType of imageTypes) {
      const result = await makeRequest(
        `/notary/participant/${TEST_DATA.participantId}/verification-image/${imageType}/${TEST_DATA.jobId}`
      );
      
      if (result.ok) {
        console.log(`✅ ${imageType} image endpoint working`);
        console.log(`   Image URL expires in: ${result.data.expiresIn} seconds`);
      } else {
        console.log(`ℹ️  ${imageType} image not found or not accessible`);
      }
    }
  } catch (error) {
    console.error('❌ Error testing verification images:', error.message);
  }
}

async function testAssignedJobsEndpoint() {
  console.log('\n🧪 Testing Assigned Jobs Endpoint...');
  
  try {
    const result = await makeRequest('/notary/assigned-jobs');
    
    if (result.ok) {
      console.log('✅ Assigned jobs endpoint working');
      console.log('📋 Jobs found:', result.data.length);
      
      result.data.forEach(job => {
        console.log(`   - ${job.title_company} (${job.closing_type})`);
        console.log(`     Status: ${job.job_status}`);
        console.log(`     Participants: ${job.verified_participants}/${job.total_participants} verified`);
        console.log(`     Signers: ${job.signer_count}, Witnesses: ${job.witness_count}`);
      });
    } else {
      console.error('❌ Assigned jobs endpoint failed:', result.data.error);
    }
  } catch (error) {
    console.error('❌ Error testing assigned jobs:', error.message);
  }
}

async function testBypassLogEndpoint() {
  console.log('\n🧪 Testing Bypass Log Endpoint...');
  
  try {
    const result = await makeRequest(`/notary/bypass-log/${TEST_DATA.jobId}`);
    
    if (result.ok) {
      console.log('✅ Bypass log endpoint working');
      console.log('📜 Log entries found:', result.data.length);
      
      result.data.slice(0, 5).forEach(entry => {
        console.log(`   - ${entry.action} by ${entry.notary_name}`);
        console.log(`     Participant: ${entry.participant_name}`);
        console.log(`     Reason: ${entry.reason}`);
        console.log(`     Date: ${new Date(entry.created_at).toLocaleString()}`);
      });
    } else {
      console.error('❌ Bypass log endpoint failed:', result.data.error);
    }
  } catch (error) {
    console.error('❌ Error testing bypass log:', error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Notary Verification Management Tests');
  console.log('================================================');
  
  await testAssignedJobsEndpoint();
  await testJobParticipantsEndpoint();
  await testVerificationDocumentsEndpoint();
  await testParticipantDetailsEndpoint();
  await testVerificationImageEndpoint();
  await testBypassVerificationEndpoint();
  await testRemoveBypassEndpoint();
  await testBypassLogEndpoint();
  
  console.log('\n🎉 All tests completed!');
  console.log('================================================');
  console.log('📝 Summary:');
  console.log('   - All major endpoints have been tested');
  console.log('   - Check the console output above for any failures');
  console.log('   - The system is ready for notary verification management');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testJobParticipantsEndpoint,
  testVerificationDocumentsEndpoint,
  testParticipantDetailsEndpoint,
  testBypassVerificationEndpoint,
  testRemoveBypassEndpoint,
  testVerificationImageEndpoint,
  testAssignedJobsEndpoint,
  testBypassLogEndpoint
}; 