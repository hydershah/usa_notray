import { storage } from '../server/storage';

async function checkSpecificUser() {
  try {
    console.log('🔍 Checking for user: title@cryptofamilyuser.com');
    
    const user = await storage.getUserByEmail('title@cryptofamilyuser.com');
    if (user) {
      console.log('✅ User found:');
      console.log(`  - ID: ${user.id}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Username: ${user.username}`);
      console.log(`  - Role: ${user.role}`);
      console.log(`  - Company ID: ${user.companyId}`);
      console.log(`  - Is Active: ${user.isActive}`);
      console.log(`  - Approval Status: ${user.approvalStatus}`);
    } else {
      console.log('❌ User not found in database');
      console.log('This confirms the registration bug - company was created but user account was not.');
    }

  } catch (error) {
    console.error('❌ Error checking user:', error);
  }
}

checkSpecificUser().then(() => {
  console.log('\n✅ User check completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
