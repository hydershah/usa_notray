#!/usr/bin/env npx tsx

import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { selfSignedCertificateService } from '../server/services/self-signed-certificate-service';

/**
 * Fix Certificate Issue Script
 * 
 * This script fixes the common issue where a user has a certificate record
 * in the database but the actual certificate files are missing from the filesystem.
 * 
 * Usage: npx tsx scripts/fix-certificate-issue.ts <userId>
 */

async function fixCertificateIssue(userId: number): Promise<void> {
  try {
    console.log(`🔧 Starting certificate fix for user ${userId}...`);

    // Step 1: Check if user exists and get details
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        isVerified: users.isVerified,
        isVerificationBypassed: users.isVerificationBypassed,
        notaryVerificationBypassed: users.notaryVerificationBypassed
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    console.log(`👤 User found: ${user.fullName} (${user.email}) - Role: ${user.role}`);

    // Step 2: Check if user can have certificates
    if (!['signer', 'witness'].includes(user.role)) {
      throw new Error(`User role '${user.role}' is not eligible for certificates. Only signers and witnesses can have certificates.`);
    }

    // Step 3: Check if user is verified
    const isVerified = user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed;
    if (!isVerified) {
      throw new Error('User must complete ID verification before certificate generation');
    }

    console.log(`✅ User is verified and eligible for certificates`);

    // Step 4: Check current certificate status
    const existingCert = await selfSignedCertificateService.getUserCertificate(userId);
    if (existingCert) {
      console.log(`📋 Found existing certificate record: ${existingCert.certificate_id}`);
      console.log(`   Status: ${existingCert.status}`);
      console.log(`   Issued: ${existingCert.issued_at}`);
      console.log(`   Expires: ${existingCert.expires_at}`);

      // Step 5: Try to get the certificate file to check if it exists
      const fileResult = await selfSignedCertificateService.getCertificateFile(userId, 'cert');
      
      if (!fileResult.success) {
        console.log(`❌ Certificate files are missing: ${fileResult.error}`);
        console.log(`🔄 Revoking broken certificate and regenerating...`);

        // Revoke the broken certificate
        const revokeResult = await selfSignedCertificateService.revokeCertificate(
          userId, 
          'File system mismatch - certificate files missing'
        );

        if (!revokeResult.success) {
          throw new Error(`Failed to revoke certificate: ${revokeResult.error}`);
        }

        console.log(`🚫 Successfully revoked broken certificate`);
      } else {
        console.log(`✅ Certificate files exist and are accessible`);
        console.log(`   File path: ${fileResult.filePath}`);
        console.log(`   Content length: ${fileResult.content?.length} characters`);
        console.log(`📄 Certificate appears to be working correctly - no action needed`);
        return;
      }
    } else {
      console.log(`📋 No existing certificate found for user`);
    }

    // Step 6: Generate new certificate
    console.log(`🔐 Generating new certificate for ${user.fullName}...`);
    const generateResult = await selfSignedCertificateService.generateCertificateForUser(userId);

    if (!generateResult.success) {
      throw new Error(`Failed to generate certificate: ${generateResult.error}`);
    }

    console.log(`✅ Certificate generated successfully!`);
    console.log(`   Certificate ID: ${generateResult.certificateId}`);
    console.log(`   Certificate Path: ${generateResult.certificatePath}`);
    console.log(`   Private Key Path: ${generateResult.privateKeyPath}`);
    console.log(`   Public Key Path: ${generateResult.publicKeyPath}`);
    console.log(`   Expires: ${generateResult.expirationDate?.toISOString()}`);

    // Step 7: Verify the new certificate works
    const verifyResult = await selfSignedCertificateService.getCertificateFile(userId, 'cert');
    if (verifyResult.success) {
      console.log(`✅ Certificate verification successful - files are accessible`);
      console.log(`📄 Certificate content length: ${verifyResult.content?.length} characters`);
    } else {
      console.log(`⚠️ Warning: Generated certificate verification failed: ${verifyResult.error}`);
    }

    console.log(`🎉 Certificate fix completed successfully for user ${userId}`);

  } catch (error) {
    console.error(`❌ Certificate fix failed:`, error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`Usage: npx tsx scripts/fix-certificate-issue.ts <userId>`);
    console.log(`Example: npx tsx scripts/fix-certificate-issue.ts 44`);
    process.exit(1);
  }

  const userId = parseInt(args[0]);
  
  if (isNaN(userId)) {
    console.error(`❌ Invalid user ID: ${args[0]}`);
    process.exit(1);
  }

  try {
    await fixCertificateIssue(userId);
    console.log(`\n🎉 Certificate fix completed successfully!`);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Certificate fix failed:`, error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { fixCertificateIssue }; 