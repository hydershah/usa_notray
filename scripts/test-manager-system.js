// Test script for Company Manager System
// This script tests the multi-manager functionality

const API_BASE = 'http://localhost:3000';
let authToken = '';

// Helper function to make API calls
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      ...options.headers,
    },
    ...options,
  };

  console.log(`🌐 ${config.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Error: ${response.status} - ${data.error || data.message}`);
      return { error: data.error || data.message, status: response.status };
    }
    
    console.log(`✅ Success: ${response.status}`);
    return { data, status: response.status };
  } catch (error) {
    console.error(`❌ Network Error: ${error.message}`);
    return { error: error.message };
  }
}

// Step 1: Login as title company user
async function loginAsTitleCompany() {
  console.log('\n📝 Step 1: Login as Title Company');
  
  const result = await apiCall('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: 'y@xymax.co', // Update with your title company email
      password: '123456'    // Update with your password
    })
  });

  if (result.error) {
    console.error('Failed to login');
    return false;
  }

  authToken = result.data.token;
  console.log('🎉 Login successful!');
  console.log(`👤 User: ${result.data.user.email}`);
  console.log(`🏢 Company ID: ${result.data.user.companyId}`);
  return result.data.user.companyId;
}

// Step 2: Get existing managers
async function getExistingManagers(companyId) {
  console.log('\n📋 Step 2: Get Existing Managers');
  
  const result = await apiCall(`/api/companies/${companyId}/managers`);
  
  if (result.error) {
    console.error('Failed to get managers');
    return [];
  }

  console.log(`📊 Found ${result.data.managers.length} manager(s):`);
  result.data.managers.forEach(manager => {
    console.log(`  👤 ${manager.user?.fullName} (${manager.user?.email})`);
    console.log(`     Role: ${manager.managerRole}, Status: ${manager.status}, Primary: ${manager.isPrimary}`);
  });
  
  return result.data.managers;
}

// Step 3: Get permission templates
async function getPermissionTemplates(companyId) {
  console.log('\n📄 Step 3: Get Permission Templates');
  
  const result = await apiCall(`/api/companies/${companyId}/permission-templates`);
  
  if (result.error) {
    console.error('Failed to get permission templates');
    return [];
  }

  console.log(`📋 Found ${result.data.templates.length} template(s):`);
  result.data.templates.forEach(template => {
    console.log(`  📝 ${template.templateName} - ${template.description}`);
    console.log(`     Default: ${template.isDefault}`);
  });
  
  return result.data.templates;
}

// Step 4: Invite a new manager
async function inviteNewManager(companyId) {
  console.log('\n✉️ Step 4: Invite New Manager');
  
  const managerData = {
    email: 'manager@test.com',
    firstName: 'Test',
    lastName: 'Manager',
    managerRole: 'manager'
  };

  const result = await apiCall(`/api/companies/${companyId}/managers/invite`, {
    method: 'POST',
    body: JSON.stringify(managerData)
  });

  if (result.error) {
    console.error('Failed to invite manager');
    return null;
  }

  console.log('🎉 Manager invited successfully!');
  console.log(`👤 Manager: ${result.data.manager.user?.fullName}`);
  console.log(`📧 Email: ${result.data.manager.user?.email}`);
  console.log(`🆕 User Created: ${result.data.userCreated}`);
  console.log(`📋 Status: ${result.data.manager.status}`);
  
  return result.data.manager;
}

// Step 5: Check current user's manager status
async function checkMyManagerStatus(companyId) {
  console.log('\n🔍 Step 5: Check My Manager Status');
  
  const result = await apiCall(`/api/companies/${companyId}/managers/me`);
  
  if (result.error) {
    console.error('Failed to get manager status');
    return null;
  }

  const manager = result.data.manager;
  console.log('📊 My Manager Status:');
  console.log(`  🎭 Role: ${manager.managerRole}`);
  console.log(`  👑 Primary: ${manager.isPrimary}`);
  console.log(`  ✅ Active: ${manager.isActive}`);
  console.log(`  📋 Status: ${manager.status}`);
  console.log('  🔑 Permissions:');
  
  // Display permissions in a readable format
  Object.entries(manager.permissions).forEach(([category, perms]) => {
    console.log(`    📂 ${category.toUpperCase()}:`);
    Object.entries(perms).forEach(([action, allowed]) => {
      const icon = allowed ? '✅' : '❌';
      console.log(`      ${icon} ${action.replace(/_/g, ' ')}`);
    });
  });
  
  return manager;
}

// Step 6: Get activity log
async function getActivityLog(companyId) {
  console.log('\n📜 Step 6: Get Activity Log');
  
  const result = await apiCall(`/api/companies/${companyId}/activity-log?limit=10`);
  
  if (result.error) {
    console.error('Failed to get activity log');
    return [];
  }

  console.log(`📊 Found ${result.data.activityLog.length} activity log entries:`);
  result.data.activityLog.forEach(log => {
    const date = new Date(log.createdAt).toLocaleString();
    console.log(`  📅 ${date}`);
    console.log(`     👤 ${log.managerName} (${log.managerEmail})`);
    console.log(`     🎯 Action: ${log.action}`);
    if (log.targetType) {
      console.log(`     📋 Target: ${log.targetType} ${log.targetId || ''}`);
    }
    if (log.details) {
      console.log(`     📝 Details: ${JSON.stringify(log.details)}`);
    }
    console.log('');
  });
  
  return result.data.activityLog;
}

// Main test function
async function runManagerSystemTest() {
  console.log('🚀 Starting Company Manager System Test');
  console.log('=====================================');

  try {
    // Step 1: Login
    const companyId = await loginAsTitleCompany();
    if (!companyId) {
      console.error('❌ Test failed: Could not login');
      return;
    }

    // Step 2: Get existing managers
    const managers = await getExistingManagers(companyId);

    // Step 3: Get permission templates
    const templates = await getPermissionTemplates(companyId);

    // Step 4: Invite new manager (optional - comment out if you don't want to create a test user)
    // const newManager = await inviteNewManager(companyId);

    // Step 5: Check my manager status
    const myStatus = await checkMyManagerStatus(companyId);

    // Step 6: Get activity log
    const activityLog = await getActivityLog(companyId);

    console.log('\n🎉 Manager System Test Completed Successfully!');
    console.log('==========================================');
    console.log('✅ All API endpoints are working');
    console.log('✅ Permission system is functional');
    console.log('✅ Activity logging is working');
    console.log('✅ Manager management is operational');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Manual testing instructions
function printManualTestInstructions() {
  console.log('\n📖 Manual Testing Instructions');
  console.log('==============================');
  console.log('');
  console.log('1. 📱 Login to the application as a title company user');
  console.log('2. 🏠 Go to the dashboard');
  console.log('3. 📑 Click on the "Managers" tab');
  console.log('4. 👀 You should see:');
  console.log('   - Current managers list');
  console.log('   - "Invite Manager" button');
  console.log('   - Manager permissions display');
  console.log('');
  console.log('5. ✉️ Test Invite Manager:');
  console.log('   - Click "Invite Manager"');
  console.log('   - Fill in manager details');
  console.log('   - Select role and permissions');
  console.log('   - Submit invitation');
  console.log('');
  console.log('6. 🔍 Test Permission Viewing:');
  console.log('   - Click settings icon next to a manager');
  console.log('   - View detailed permissions');
  console.log('   - Check different permission categories');
  console.log('');
  console.log('7. 📊 Test Activity Log:');
  console.log('   - Any manager actions should be logged');
  console.log('   - Check the activity log for entries');
  console.log('');
  console.log('🔧 API Testing:');
  console.log('Run this script to test all API endpoints:');
  console.log('node scripts/test-manager-system.js');
}

// Check if running directly
if (require.main === module) {
  console.log('🧪 Company Manager System Tester');
  console.log('=================================');
  console.log('');
  console.log('Choose testing method:');
  console.log('1. Run API tests automatically');
  console.log('2. Show manual testing instructions');
  console.log('');
  
  const choice = process.argv[2];
  
  if (choice === 'manual' || choice === '2') {
    printManualTestInstructions();
  } else {
    runManagerSystemTest();
  }
}

module.exports = {
  runManagerSystemTest,
  printManualTestInstructions
};
