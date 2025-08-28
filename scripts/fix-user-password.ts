import { storage } from '../server/storage.js';
import bcrypt from 'bcrypt';

async function fixUserPassword() {
  console.log('🔧 Fixing user password...');
  
  const email = 'info@usanotary.net';
  const newPassword = 'AcesOverKing#22';
  
  try {
    // Get the user
    console.log(`📧 Looking up user: ${email}`);
    const user = await storage.getUserByEmail(email.toLowerCase());
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('✅ User found, updating password...');
    
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`🔐 New password hash created`);
    
    // Update the user's password
    const updatedUser = await storage.updateUser(user.id, {
      password: hashedPassword
    });
    
    if (updatedUser) {
      console.log('✅ Password updated successfully!');
      
      // Test the new password
      console.log('🧪 Testing new password...');
      const testPassword = await bcrypt.compare(newPassword, hashedPassword);
      console.log(`🎯 Password test: ${testPassword ? '✅ VALID' : '❌ INVALID'}`);
      
      console.log('\n🎯 Login credentials:');
      console.log(`Email: ${email}`);
      console.log(`Password: ${newPassword}`);
      console.log(`Role: ${updatedUser.role}`);
    } else {
      console.log('❌ Failed to update password');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixUserPassword();
