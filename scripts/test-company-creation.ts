import fetch from 'node-fetch';

async function testCompanyCreation() {
  try {
    console.log('🧪 Testing title company creation flow...');
    
    // First, let's login as admin to get a token
    console.log('🔐 Logging in as admin...');
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@usanotary.com',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Admin logged in successfully');
    
    // Now test company creation with user data (what admin form sends)
    console.log('🏢 Creating test company...');
    const testCompanyData = {
      companyName: `Test Title Company ${Date.now()}`,
      primaryUserName: 'John Manager',
      primaryUserEmail: `manager${Date.now()}@testcompany.com`,
      // Note: No primaryUserPassword - this simulates admin form
      address1: '123 Test Street',
      city: 'Test City',
      state: 'TX',
      zipCode: '12345',
      paymentMethod: 'invoiced',
      contactName: 'John Manager',
      email: `contact${Date.now()}@testcompany.com`,
      phoneNumber: '555-1234',
      status: 'active'
    };
    
    const createResponse = await fetch('http://localhost:3000/api/companies', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testCompanyData)
    });
    
    if (!createResponse.ok) {
      const errorData = await createResponse.text();
      throw new Error(`Company creation failed: ${createResponse.status} - ${errorData}`);
    }
    
    const companyData = await createResponse.json();
    console.log('✅ Company created successfully!');
    console.log('📊 Company Data:');
    console.log(`  - Company ID: ${companyData.company.id}`);
    console.log(`  - Company Name: ${companyData.company.companyName}`);
    console.log(`  - Status: ${companyData.company.status}`);
    
    if (companyData.manager) {
      console.log('👤 Manager Data:');
      console.log(`  - Manager ID: ${companyData.manager.id}`);
      console.log(`  - Manager Email: ${companyData.manager.email}`);
      console.log(`  - Manager Role: ${companyData.manager.role}`);
      console.log(`  - Needs Password Setup: ${companyData.manager.needsPasswordSetup || false}`);
    }
    
    // Test that the user was actually created correctly
    console.log('🔍 Verifying user account...');
    const userCheckResponse = await fetch(`http://localhost:3000/api/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (userCheckResponse.ok) {
      const users = await userCheckResponse.json();
      const createdUser = users.find((u: any) => u.email === testCompanyData.primaryUserEmail);
      
      if (createdUser) {
        console.log('✅ User account verification:');
        console.log(`  - User ID: ${createdUser.id}`);
        console.log(`  - Email: ${createdUser.email}`);
        console.log(`  - Role: ${createdUser.role}`);
        console.log(`  - Company ID: ${createdUser.companyId}`);
        console.log(`  - Is Active: ${createdUser.isActive}`);
        console.log(`  - Account Setup Complete: ${createdUser.accountSetupComplete}`);
        
        if (createdUser.role === 'title_company') {
          console.log('🎉 SUCCESS: User has correct title_company role!');
        } else {
          console.log(`❌ FAILED: User has wrong role: ${createdUser.role}`);
        }
      } else {
        console.log('❌ FAILED: User account not found!');
      }
    }
    
    console.log('\n🧪 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCompanyCreation();
