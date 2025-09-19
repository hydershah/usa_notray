import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function checkSpecificUserVerification() {
  try {
    console.log('🔍 Checking Verification Status for Dashboard "Approved" User\n');
    
    // Let's check the user who says they have "approved" status in dashboard
    // This is likely the most recent user or the one with EVS transaction
    const usersWithEVS = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      
      // Account setup
      accountSetupComplete: users.accountSetupComplete,
      profileSubmitted: users.profileSubmitted,
      
      // Verification flags
      isVerified: users.isVerified,
      verificationStatus: users.verificationStatus,
      isVerificationBypassed: users.isVerificationBypassed,
      notaryVerificationBypassed: users.notaryVerificationBypassed,
      
      // EVS specific data
      evsTransactionId: users.evsTransactionId,
      evsVerificationConfidence: users.evsVerificationConfidence,
      evsVerifiedAt: users.evsVerifiedAt,
      
      // Profile data
      firstName: users.firstName,
      lastName: users.lastName,
      phoneNumber: users.phoneNumber,
      address1: users.address1,
      city: users.city,
      state: users.state,
      zipCode: users.zipCode,
      address: users.address,
      
      // Error tracking
      evsVerificationErrors: users.evsVerificationErrors,
      evsVerificationWarnings: users.evsVerificationWarnings
      
    }).from(users)
    .where(eq(users.evsTransactionId, 'evs_1757896458850')); // This is from our debug output
    
    if (usersWithEVS.length > 0) {
      const user = usersWithEVS[0];
      console.log('📋 User with EVS Transaction (probably you):');
      console.log('================================================');
      console.log(`User ID: ${user.id}`);
      console.log(`Email: ${user.email}`);
      console.log(`Role: ${user.role}`);
      console.log();
      
      console.log('🔧 Account Setup Status:');
      console.log(`- Account Setup Complete: ${user.accountSetupComplete}`);
      console.log(`- Profile Submitted: ${user.profileSubmitted}`);
      
      const hasBasicInfo = !!(user.firstName && user.lastName && user.phoneNumber);
      const hasAddress = !!(user.address1 && user.city && user.state && user.zipCode) || !!user.address;
      console.log(`- Has Basic Info: ${hasBasicInfo}`);
      console.log(`- Has Address: ${hasAddress}`);
      console.log(`- Should be Setup Complete: ${hasBasicInfo && hasAddress}`);
      console.log();
      
      console.log('🔐 Verification Status:');
      console.log(`- Is Verified: ${user.isVerified}`);
      console.log(`- Verification Status: ${user.verificationStatus}`);
      console.log(`- Verification Bypassed: ${user.isVerificationBypassed}`);
      console.log(`- Notary Verification Bypassed: ${user.notaryVerificationBypassed}`);
      console.log();
      
      console.log('🎯 EVS Verification Details:');
      console.log(`- EVS Transaction ID: ${user.evsTransactionId}`);
      console.log(`- EVS Confidence: ${user.evsVerificationConfidence}`);
      console.log(`- EVS Verified At: ${user.evsVerifiedAt}`);
      console.log(`- EVS Errors: ${user.evsVerificationErrors ? JSON.stringify(user.evsVerificationErrors) : 'None'}`);
      console.log(`- EVS Warnings: ${user.evsVerificationWarnings ? JSON.stringify(user.evsVerificationWarnings) : 'None'}`);
      console.log();
      
      // Check overall signer readiness
      const isActuallyVerified = user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed;
      const canJoinAsSigner = (hasBasicInfo && hasAddress) && isActuallyVerified;
      
      console.log('✅ Final Status Check:');
      console.log(`- Is Actually Verified (any method): ${isActuallyVerified}`);
      console.log(`- Can Join as Signer: ${canJoinAsSigner}`);
      console.log();
      
      if (!canJoinAsSigner) {
        console.log('❌ PROBLEM IDENTIFIED:');
        if (!hasBasicInfo || !hasAddress) {
          console.log('   - Profile setup is incomplete');
        }
        if (!isActuallyVerified) {
          console.log('   - User is not verified despite dashboard showing "approved"');
          console.log('   - This indicates a database sync issue between EVS and user table');
        }
      }
      
    } else {
      console.log('No user found with EVS transaction ID. Let me check all users with any EVS data...\n');
      
      const anyEVSUsers = await db.select({
        id: users.id,
        email: users.email,
        evsTransactionId: users.evsTransactionId,
        verificationStatus: users.verificationStatus,
        isVerified: users.isVerified
      }).from(users)
      .where(eq(users.verificationStatus, 'approved'));
      
      console.log('Users with approved verification status:');
      anyEVSUsers.forEach(user => {
        console.log(`- ID ${user.id}: ${user.email} (verified: ${user.isVerified})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking verification status:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

checkSpecificUserVerification();
