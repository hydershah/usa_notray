import { storage } from '../server/storage';

async function checkUserAccount() {
  try {
    console.log('🔍 Checking user accounts for company ID 15...');
    
    // Check users by company ID
    const companyUsers = await storage.getUsersByCompany(15);
    console.log('\n📊 Users in company ID 15:');
    companyUsers.forEach(user => {
      console.log(`  - ID: ${user.id}`);
      console.log(`    Email: ${user.email}`);
      console.log(`    Username: ${user.username}`);
      console.log(`    Role: ${user.role}`);
      console.log(`    Company Role: ${user.companyRole || 'N/A'}`);
      console.log(`    Is Active: ${user.isActive}`);
      console.log(`    Approval Status: ${user.approvalStatus || 'N/A'}`);
      console.log('    ---');
    });

    // Check the most recent users
    console.log('\n📊 Most recent 5 users:');
    const allUsers = await storage.getUsers();
    const recentUsers = allUsers.slice(-5);
    recentUsers.forEach(user => {
      console.log(`  - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, Company: ${user.companyId || 'None'}`);
    });

    // Check company details
    console.log('\n🏢 Company ID 15 details:');
    const company = await storage.getCompany(15);
    if (company) {
      console.log(`  - Name: ${company.companyName}`);
      console.log(`  - Primary User Email: ${company.primaryUserEmail}`);
      console.log(`  - Status: ${company.status}`);
    } else {
      console.log('  - Company not found!');
    }

  } catch (error) {
    console.error('❌ Error checking user account:', error);
  }
}

checkUserAccount().then(() => {
  console.log('\n✅ User account check completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
