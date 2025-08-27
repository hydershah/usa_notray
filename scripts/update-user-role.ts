import { storage } from '../server/storage';

async function updateUserRole() {
  try {
    const email = 'title@cryptofamilyuser.com';
    console.log(`🔄 Updating user role for: ${email}`);
    
    // Get the user
    const user = await storage.getUserByEmail(email);
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`📋 Current user role: ${user.role}`);
    
    // Update the user role to title_company
    const updatedUser = await storage.updateUser(user.id, {
      role: 'title_company'
    });

    if (updatedUser) {
      console.log('✅ User role updated successfully!');
      console.log(`  - ID: ${updatedUser.id}`);
      console.log(`  - Email: ${updatedUser.email}`);
      console.log(`  - Old Role: company_manager`);
      console.log(`  - New Role: ${updatedUser.role}`);
      console.log(`  - Company ID: ${updatedUser.companyId}`);
    } else {
      console.log('❌ Failed to update user role');
    }

  } catch (error) {
    console.error('❌ Error updating user role:', error);
  }
}

updateUserRole().then(() => {
  console.log('\n✅ User role update completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
