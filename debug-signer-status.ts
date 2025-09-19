import { db } from './server/db.js';
import { users, signers, jobParticipants } from './shared/schema.js';
import { eq, desc } from 'drizzle-orm';

async function debugSignerStatus() {
  try {
    console.log('🔍 Debugging Signer Registration Status\n');
    
    // Get recent users
    const recentUsers = await db.select({
      id: users.id,
      email: users.email,
      role: users.role,
      accountSetupComplete: users.accountSetupComplete,
      isVerified: users.isVerified,
      verificationStatus: users.verificationStatus,
      isVerificationBypassed: users.isVerificationBypassed,
      notaryVerificationBypassed: users.notaryVerificationBypassed,
      profileSubmitted: users.profileSubmitted,
      firstName: users.firstName,
      lastName: users.lastName,
      phoneNumber: users.phoneNumber,
      address1: users.address1,
      city: users.city,
      state: users.state,
      zipCode: users.zipCode,
      address: users.address,
      evsTransactionId: users.evsTransactionId,
      evsVerifiedAt: users.evsVerifiedAt
    }).from(users)
    .orderBy(desc(users.id))
    .limit(10);
    
    console.log('📋 Recent Users in System:');
    console.log('============================\n');
    
    recentUsers.forEach((user, index) => {
      console.log(`${index + 1}. User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Account Setup Complete: ${user.accountSetupComplete}`);
      console.log(`   Is Verified: ${user.isVerified}`);
      console.log(`   Verification Status: ${user.verificationStatus}`);
      console.log(`   Verification Bypassed: ${user.isVerificationBypassed}`);
      console.log(`   Notary Verification Bypassed: ${user.notaryVerificationBypassed}`);
      console.log(`   Profile Submitted: ${user.profileSubmitted}`);
      console.log(`   EVS Transaction ID: ${user.evsTransactionId}`);
      console.log(`   EVS Verified At: ${user.evsVerifiedAt}`);
      
      const hasBasicInfo = !!(user.firstName && user.lastName && user.phoneNumber);
      const hasAddress = !!(user.address1 && user.city && user.state && user.zipCode) || !!user.address;
      const shouldBeSetupComplete = hasBasicInfo && hasAddress;
      
      console.log(`   Has Basic Info: ${hasBasicInfo} (firstName: ${!!user.firstName}, lastName: ${!!user.lastName}, phone: ${!!user.phoneNumber})`);
      console.log(`   Has Address: ${hasAddress} (address1: ${!!user.address1}, city: ${!!user.city}, state: ${!!user.state}, zip: ${!!user.zipCode}, address: ${!!user.address})`);
      console.log(`   Should be Setup Complete: ${shouldBeSetupComplete}`);
      
      // Check if this user is actually verified by any method
      const isActuallyVerified = user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed;
      console.log(`   Is Actually Verified (any method): ${isActuallyVerified}`);
      
      // Final signer readiness check
      const canJoinAsSigner = shouldBeSetupComplete && isActuallyVerified;
      console.log(`   ✅ Can Join as Signer: ${canJoinAsSigner}`);
      
      console.log('   ──────────────────────────────────────\n');
    });
    
    // Check for any signer records
    console.log('📝 Checking Signer Records:');
    console.log('============================\n');
    
    const signerRecords = await db.select({
      id: signers.id,
      jobId: signers.jobId,
      userId: signers.userId,
      signerEmail: signers.signerEmail,
      primaryUserRole: signers.primaryUserRole,
      requiresIdVerification: signers.requiresIdVerification,
      idVerificationCompleted: signers.idVerificationCompleted,
      signingStatus: signers.signingStatus
    }).from(signers)
    .orderBy(desc(signers.id))
    .limit(5);
    
    if (signerRecords.length === 0) {
      console.log('No signer records found in the system.\n');
    } else {
      signerRecords.forEach((signer, index) => {
        console.log(`${index + 1}. Signer ID: ${signer.id}`);
        console.log(`   Job ID: ${signer.jobId}`);
        console.log(`   User ID: ${signer.userId}`);
        console.log(`   Email: ${signer.signerEmail}`);
        console.log(`   Primary Role: ${signer.primaryUserRole}`);
        console.log(`   Requires Verification: ${signer.requiresIdVerification}`);
        console.log(`   Verification Completed: ${signer.idVerificationCompleted}`);
        console.log(`   Signing Status: ${signer.signingStatus}`);
        console.log('   ──────────────────────────────────────\n');
      });
    }
    
    // Check for job participants
    console.log('👥 Checking Job Participants:');
    console.log('==============================\n');
    
    const participantRecords = await db.select({
      id: jobParticipants.id,
      jobId: jobParticipants.jobId,
      userId: jobParticipants.userId,
      email: jobParticipants.email,
      jobSpecificRole: jobParticipants.jobSpecificRole,
      primaryRole: jobParticipants.primaryRole,
      inviteStatus: jobParticipants.inviteStatus,
      requiresIdVerification: jobParticipants.requiresIdVerification,
      idVerificationCompleted: jobParticipants.idVerificationCompleted
    }).from(jobParticipants)
    .orderBy(desc(jobParticipants.id))
    .limit(5);
    
    if (participantRecords.length === 0) {
      console.log('No job participant records found in the system.\n');
    } else {
      participantRecords.forEach((participant, index) => {
        console.log(`${index + 1}. Participant ID: ${participant.id}`);
        console.log(`   Job ID: ${participant.jobId}`);
        console.log(`   User ID: ${participant.userId}`);
        console.log(`   Email: ${participant.email}`);
        console.log(`   Job Specific Role: ${participant.jobSpecificRole}`);
        console.log(`   Primary Role: ${participant.primaryRole}`);
        console.log(`   Invite Status: ${participant.inviteStatus}`);
        console.log(`   Requires Verification: ${participant.requiresIdVerification}`);
        console.log(`   Verification Completed: ${participant.idVerificationCompleted}`);
        console.log('   ──────────────────────────────────────\n');
      });
    }
    
  } catch (error) {
    console.error('❌ Error debugging signer status:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

debugSignerStatus();
