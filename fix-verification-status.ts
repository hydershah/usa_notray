import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function fixVerificationStatus() {
  try {
    console.log('🔧 Fixing Verification Status for User ID 28\n');
    
    // Update the user's verification status to match what should be shown
    const result = await db.update(users)
      .set({
        isVerified: true,
        verificationStatus: 'approved',
        isVerificationBypassed: true,
        verificationBypassedBy: 24, // Admin user ID
        verificationBypassedAt: new Date(),
        verificationBypassReason: 'Development testing - dashboard showed approved but DB had denied status',
        accountSetupComplete: true, // Also fix the account setup flag
        updatedAt: new Date()
      })
      .where(eq(users.id, 28))
      .returning({
        id: users.id,
        email: users.email,
        isVerified: users.isVerified,
        verificationStatus: users.verificationStatus,
        accountSetupComplete: users.accountSetupComplete
      });
    
    if (result.length > 0) {
      console.log('✅ Successfully updated user verification status:');
      console.log(`- User ID: ${result[0].id}`);
      console.log(`- Email: ${result[0].email}`);
      console.log(`- Is Verified: ${result[0].isVerified}`);
      console.log(`- Verification Status: ${result[0].verificationStatus}`);
      console.log(`- Account Setup Complete: ${result[0].accountSetupComplete}`);
      console.log('\n🎉 User should now be able to join as signer!');
    } else {
      console.log('❌ No user was updated. Check the user ID.');
    }
    
  } catch (error) {
    console.error('❌ Error fixing verification status:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

fixVerificationStatus();
