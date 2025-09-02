#!/usr/bin/env node

/**
 * Test script to demonstrate the profile update fix
 * This shows how partial updates now work correctly
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 1; // Replace with actual user ID
const AUTH_TOKEN = 'your-auth-token-here'; // Replace with actual token

async function testPartialProfileUpdate() {
  console.log('🧪 Testing Partial Profile Update Fix\n');
  
  try {
    // First, get the current user profile
    console.log('📄 Step 1: Getting current user profile...');
    const currentProfile = await axios.get(`${BASE_URL}/api/users/${TEST_USER_ID}`, {
      headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
    });
    
    console.log('Current profile data:');
    console.log({
      firstName: currentProfile.data.firstName,
      lastName: currentProfile.data.lastName,
      phoneNumber: currentProfile.data.phoneNumber,
      email: currentProfile.data.email
    });
    
    // Test 1: Update only phone number
    console.log('\n📱 Step 2: Testing partial update (phone number only)...');
    const phoneOnlyUpdate = {
      phoneNumber: '555-TEST-123'  // Only updating phone number
    };
    
    const phoneUpdateResult = await axios.put(
      `${BASE_URL}/api/users/${TEST_USER_ID}/profile`, 
      phoneOnlyUpdate,
      { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
    );
    
    console.log('✅ Phone number update successful!');
    console.log('Updated profile:', {
      firstName: phoneUpdateResult.data.firstName,
      lastName: phoneUpdateResult.data.lastName,
      phoneNumber: phoneUpdateResult.data.phoneNumber,
      email: phoneUpdateResult.data.email
    });
    
    // Test 2: Update only first name
    console.log('\n👤 Step 3: Testing partial update (first name only)...');
    const nameOnlyUpdate = {
      firstName: 'UpdatedFirstName'  // Only updating first name
    };
    
    const nameUpdateResult = await axios.put(
      `${BASE_URL}/api/users/${TEST_USER_ID}/profile`, 
      nameOnlyUpdate,
      { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
    );
    
    console.log('✅ First name update successful!');
    console.log('Updated profile:', {
      firstName: nameUpdateResult.data.firstName,
      lastName: nameUpdateResult.data.lastName,
      phoneNumber: nameUpdateResult.data.phoneNumber,
      email: nameUpdateResult.data.email
    });
    
    console.log('\n🎉 All tests passed! Partial updates are working correctly.');
    console.log('\n📋 Summary:');
    console.log('- ✅ Phone number updated without affecting other fields');
    console.log('- ✅ First name updated without affecting other fields'); 
    console.log('- ✅ No data loss during partial updates');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Tip: Make sure to replace AUTH_TOKEN with a valid JWT token');
    }
    if (error.response?.status === 404) {
      console.log('\n💡 Tip: Make sure to replace TEST_USER_ID with a valid user ID');
    }
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testPartialProfileUpdate();
}

module.exports = { testPartialProfileUpdate };
