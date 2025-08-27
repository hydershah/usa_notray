import { storage } from '../server/storage';

async function verifyTitleCompanyRole() {
  try {
    console.log('🔍 Verifying title company user roles...');
    
    // Check the updated user
    const user = await storage.getUserByEmail('title@cryptofamilyuser.com');
    if (user) {
      console.log('\n✅ Updated User:');
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Role: ${user.role}`);
      console.log(`  - Company ID: ${user.companyId}`);
      console.log(`  - Company Role: ${user.companyRole || 'N/A'}`);
      console.log(`  - Is Active: ${user.isActive}`);
    }

    // Check all title_company users
    console.log('\n📊 All users with title_company role:');
    const titleCompanyUsers = await storage.getUsersByRole('title_company');
    titleCompanyUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (ID: ${user.id}, Company: ${user.companyId || 'None'})`);
    });

    // Check company details
    console.log('\n🏢 Company details:');
    const company = await storage.getCompany(15);
    if (company) {
      console.log(`  - Name: ${company.companyName}`);
      console.log(`  - Status: ${company.status}`);
      console.log(`  - Primary User: ${company.primaryUserEmail}`);
    }

  } catch (error) {
    console.error('❌ Error verifying roles:', error);
  }
}

verifyTitleCompanyRole().then(() => {
  console.log('\n✅ Verification completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
