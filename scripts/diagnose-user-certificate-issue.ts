import { db } from '../server/db.js';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function diagnoseUserCertificateIssue() {
  const targetEmail = 'hyder99@hotmail.com';
  
  try {
    console.log(`🔍 Checking certificate generation issue for user: ${targetEmail}`);
    
    // Get user details
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, targetEmail.trim().toLowerCase()))
      .limit(1);

    if (!user) {
      console.log(`❌ User not found: ${targetEmail}`);
      return;
    }

    console.log(`\n👤 User Details:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Full Name: ${user.fullName || 'Not set'}`);
    console.log(`   First Name: ${user.firstName || 'Not set'}`);
    console.log(`   Last Name: ${user.lastName || 'Not set'}`);

    console.log(`\n✅ Verification Status:`);
    console.log(`   Is Verified (EVS): ${user.isVerified || false}`);
    console.log(`   Verification Status: ${user.verificationStatus || 'Not set'}`);
    console.log(`   Admin Bypass: ${user.isVerificationBypassed || false}`);
    console.log(`   Notary Bypass: ${user.notaryVerificationBypassed || false}`);
    console.log(`   EVS Transaction ID: ${user.evsTransactionId || 'None'}`);
    console.log(`   EVS Confidence: ${user.evsVerificationConfidence || 'None'}%`);
    console.log(`   EVS Verified At: ${user.evsVerifiedAt || 'Never'}`);

    console.log(`\n📋 Certificate Status:`);
    console.log(`   Digital Certificate File: ${user.digitalCertificateFile || 'None'}`);
    console.log(`   Certificate Expiration: ${user.digitalCertificateExpiration || 'None'}`);

    // Check verification eligibility
    const isVerified = user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed;
    console.log(`\n🔒 Certificate Generation Analysis:`);
    console.log(`   User is verified: ${isVerified}`);
    console.log(`   User role: ${user.role}`);
    
    // Check current certificate generation logic eligibility
    const eligibleRoles = ['signer', 'witness'];
    const isEligibleForAutoGeneration = eligibleRoles.includes(user.role);
    
    console.log(`   Eligible for auto-generation (current logic): ${isEligibleForAutoGeneration}`);
    console.log(`   Eligible roles (current): ${eligibleRoles.join(', ')}`);
    
    if (isVerified && !isEligibleForAutoGeneration) {
      console.log(`\n❌ ISSUE IDENTIFIED:`);
      console.log(`   User has completed ID verification but their role '${user.role}' is not eligible for automatic certificate generation.`);
      console.log(`   The current certificate generation logic only supports roles: ${eligibleRoles.join(', ')}`);
      console.log(`\n💡 SOLUTION:`);
      console.log(`   Need to update the certificate generation logic to support '${user.role}' role.`);
    } else if (!isVerified) {
      console.log(`\n❌ ISSUE IDENTIFIED:`);
      console.log(`   User has not completed ID verification or been bypassed.`);
    } else if (isVerified && isEligibleForAutoGeneration && !user.digitalCertificateFile) {
      console.log(`\n❌ ISSUE IDENTIFIED:`);
      console.log(`   User is verified and eligible but certificate was not generated. Check server logs for errors.`);
    } else if (user.digitalCertificateFile) {
      console.log(`\n✅ Certificate exists: ${user.digitalCertificateFile}`);
    }

    // Check if user should have different certificate type based on role
    if (user.role === 'notary') {
      console.log(`\n📝 Additional Notes for Notary:`);
      console.log(`   Notaries typically use the CertificateService (OpenSSL-based) rather than SelfSignedCertificateService.`);
      console.log(`   Check if notary certificate generation should be triggered instead.`);
    }

  } catch (error) {
    console.error('❌ Error diagnosing user certificate issue:', error);
  }
}

diagnoseUserCertificateIssue().catch(console.error); 