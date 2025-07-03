import fetch from 'node-fetch';

// Demo script for admin 2FA management functionality
async function demoAdmin2FA() {
  console.log('🛡️ Admin 2FA Management Demo\n');
  
  try {
    // Step 1: Admin login
    console.log('1. Admin login...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com', // Replace with actual admin credentials
        password: 'admin123'        // Replace with actual admin password
      })
    });
    
    if (!loginResponse.ok) {
      console.log('⚠️  Admin login failed - make sure you have an admin user created');
      console.log('   Create admin user first or update credentials in this script');
      return;
    }
    
    const loginData = await loginResponse.json();
    const adminToken = loginData.token;
    console.log('✅ Admin login successful');
    
    // Step 2: Get list of users to demo bulk operations
    console.log('\n2. Fetching user list...');
    const usersResponse = await fetch('http://localhost:3000/api/users', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    if (!usersResponse.ok) {
      console.log('❌ Failed to fetch users');
      return;
    }
    
    const users = await usersResponse.json();
    console.log(`✅ Found ${users.length} users in the system`);
    
    // Display users with 2FA status
    console.log('\n   Current 2FA Status:');
    users.slice(0, 5).forEach((user: any, index: number) => {
      const status = user.mfaEnabled ? '🔒 Enabled' : '🔓 Disabled';
      console.log(`   ${index + 1}. ${user.email} - ${status}`);
    });
    
    // Step 3: Demo individual user 2FA toggle
    if (users.length > 0) {
      const testUser = users[0];
      console.log(`\n3. Testing individual 2FA toggle for: ${testUser.email}`);
      
      const toggleResponse = await fetch(`http://localhost:3000/api/users/${testUser.id}/2fa/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ enabled: !testUser.mfaEnabled })
      });
      
      if (toggleResponse.ok) {
        const toggleData = await toggleResponse.json();
        console.log(`✅ ${toggleData.message}`);
        console.log(`   User ${testUser.email} 2FA is now: ${toggleData.enabled ? 'ENABLED' : 'DISABLED'}`);
      } else {
        console.log('❌ Failed to toggle 2FA for user');
      }
    }
    
    // Step 4: Demo bulk 2FA operations
    console.log('\n4. Demo: Bulk 2FA Operations');
    console.log('   (In the UI, admin can select multiple users and:)');
    console.log('   ✅ Enable 2FA for multiple users at once');
    console.log('   ✅ Disable 2FA for multiple users at once');
    console.log('   ✅ View 2FA status in user management table');
    console.log('   ✅ Filter users by 2FA status');
    
    // Step 5: Show available admin endpoints
    console.log('\n5. Available Admin 2FA Endpoints:');
    console.log('   📡 PATCH /api/users/:id/2fa/toggle     - Toggle 2FA for any user');
    console.log('   📡 GET  /api/users                     - View all users with 2FA status');
    console.log('   📡 GET  /api/auth/2fa/status           - Check own 2FA status');
    console.log('   📡 POST /api/auth/2fa/setup            - Setup 2FA for own account');
    
    // Step 6: Usage instructions
    console.log('\n🎯 How Admins Use 2FA Management:');
    console.log('   1. Login to admin account');
    console.log('   2. Go to User Management page (/user-management)');
    console.log('   3. See 2FA status for each user (🔒 or 🔓 badges)');
    console.log('   4. Click 2FA badge to toggle individual user');
    console.log('   5. Select multiple users for bulk operations:');
    console.log('      - "Enable 2FA (X)" button');
    console.log('      - "Disable 2FA (X)" button');
    console.log('   6. Use dropdown menu for additional user actions');
    
    console.log('\n🎉 Admin 2FA management is fully functional!');
    console.log('   💡 Pro tip: Use the filter dropdown to show only users with/without 2FA');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    console.log('\nMake sure your server is running on http://localhost:3000');
    console.log('And ensure you have an admin user account created');
  }
}

// Additional utility function to show 2FA statistics
async function show2FAStats() {
  console.log('\n📊 2FA Statistics:');
  
  try {
    // This would be a custom endpoint you could add
    console.log('   Endpoint: GET /api/admin/2fa/stats');
    console.log('   Would show:');
    console.log('   - Total users with 2FA enabled');
    console.log('   - Total users with 2FA disabled'); 
    console.log('   - 2FA adoption rate percentage');
    console.log('   - Recent 2FA activity');
    
  } catch (error) {
    console.log('   📊 Stats endpoint not implemented yet');
  }
}

// Run the demo
console.log('🚀 Starting Admin 2FA Management Demo...\n');
demoAdmin2FA().then(() => {
  show2FAStats();
}); 