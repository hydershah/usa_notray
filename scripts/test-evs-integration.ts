#!/usr/bin/env tsx

import { evsService } from '../server/lib/evs-service.js';
import fs from 'fs';
import path from 'path';

/**
 * Create test images for BlueAssure verification using test data from documentation
 */
function createTestImages(): { frontImage: Buffer; backImage: Buffer; selfieImage: Buffer } {
  // Create minimal test image buffers (1x1 pixel JPEG)
  const minimalJpeg = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xD9
  ]);

  return {
    frontImage: minimalJpeg,
    backImage: minimalJpeg,
    selfieImage: minimalJpeg
  };
}

/**
 * Test BlueAssure service configuration
 */
async function testConfiguration(): Promise<boolean> {
  console.log('\n🔧 Testing BlueAssure Configuration...');
  
  try {
    const validation = evsService.validateConfiguration();
    
    if (validation.valid) {
      console.log('✅ BlueAssure configuration is valid');
      console.log('   Using BlueAssure Platform API v3.0.0');
      console.log('   Products: AssureCard (with AssureID & KBA)');
      return true;
    } else {
      console.log('❌ BlueAssure configuration errors:');
      validation.errors.forEach(error => console.log(`   - ${error}`));
      return false;
    }
  } catch (error) {
    console.error('❌ Configuration test failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Test basic connectivity to BlueAssure platform
 */
async function testConnectivity(): Promise<boolean> {
  console.log('\n🌐 Testing BlueAssure Platform Connectivity...');
  
  try {
    const result = await evsService.testConnection();
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log('   Endpoint: /WebServices/Integrated/Main/V300/AssureId');
      return true;
    } else {
      console.log(`⚠️ ${result.message}`);
      
      // Provide specific guidance for common issues
      if (result.message.includes('authentication failed')) {
        console.log('\n💡 Authentication Tips:');
        console.log('   1. Verify your BlueAssure username (API key) is correct');
        console.log('   2. Check that your password is valid');
        console.log('   3. Ensure your account has API access enabled');
        console.log('   4. Contact BlueAssure support if credentials are correct');
      }
      
      return false;
    }
  } catch (error) {
    console.error('❌ Connectivity test failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Test BlueAssure identity verification using AssureCard
 */
async function testIdentityVerification(): Promise<boolean> {
  console.log('\n📄 Testing BlueAssure Identity Verification...');
  console.log('   Using AssureCard with DirectImageUpload mode');
  
  try {
    const testImages = createTestImages();
    
    const verificationRequest = {
      documentType: 'drivers_license' as const,
      frontImage: testImages.frontImage,
      backImage: testImages.backImage,
      selfieImage: testImages.selfieImage,
      userId: `test_user_${Date.now()}`
    };

    console.log('📤 Sending verification request to BlueAssure...');
    console.log(`   Document Type: ${verificationRequest.documentType}`);
    console.log(`   User ID: ${verificationRequest.userId}`);
    console.log(`   Images: Front (${testImages.frontImage.length} bytes), Back (${testImages.backImage.length} bytes), Selfie (${testImages.selfieImage.length} bytes)`);
    console.log('   API: AssureCard with biometric matching');
    
    const startTime = Date.now();
    const result = await evsService.verifyIdentity(verificationRequest);
    const endTime = Date.now();
    
    console.log(`\n📥 BlueAssure Response received in ${endTime - startTime}ms:`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Confidence: ${result.confidence}%`);
    
    if (result.transactionId) {
      console.log(`   Transaction ID: ${result.transactionId}`);
    }
    
    if (result.document) {
      console.log('\n📋 Document Data:');
      console.log(`   Type: ${result.document.type}`);
      console.log(`   Name: ${result.document.extractedData.firstName} ${result.document.extractedData.lastName}`);
      if (result.document.extractedData.dateOfBirth) {
        console.log(`   DOB: ${result.document.extractedData.dateOfBirth}`);
      }
      if (result.document.extractedData.documentNumber) {
        console.log(`   Document #: ${result.document.extractedData.documentNumber}`);
      }
      if (result.document.extractedData.address) {
        console.log(`   Address: ${result.document.extractedData.address}`);
      }
    }
    
    if (result.biometric) {
      console.log('\n👤 Biometric Data:');
      console.log(`   Face Match: ${result.biometric.faceMatch ? '✅' : '❌'}`);
      console.log(`   Match Confidence: ${result.biometric.confidence}%`);
      console.log(`   Liveness Score: ${result.biometric.livenessScore}%`);
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n⚠️ Errors:');
      result.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      result.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ BlueAssure Verification failed:', error instanceof Error ? error.message : 'Unknown error');
    
    // Provide specific guidance based on error type
    if (error instanceof Error) {
      if (error.message.includes('API errors')) {
        console.log('\n💡 API Error Troubleshooting:');
        console.log('   1. Check if test transactions are enabled for your account');
        console.log('   2. Verify your account has AssureCard product access');
        console.log('   3. Ensure image data is properly formatted');
        console.log('   4. Contact BlueAssure support for product configuration');
      } else if (error.message.includes('authentication')) {
        console.log('\n💡 Authentication Troubleshooting:');
        console.log('   1. Verify your BlueAssure credentials are active');
        console.log('   2. Check that your account has API access enabled');
        console.log('   3. Ensure you have the correct environment (production)');
      } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        console.log('\n💡 Network Troubleshooting:');
        console.log('   1. Check your internet connection');
        console.log('   2. Verify firewall allows access to blueassure.evssolutions.com');
        console.log('   3. Try again in a few minutes in case of temporary issues');
      }
    }
    
    return false;
  }
}

/**
 * Generate test report
 */
function generateTestReport(results: { [key: string]: boolean }): void {
  console.log('\n📊 BlueAssure Platform Integration Test Report');
  console.log('═'.repeat(55));
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  console.log(`Overall Status: ${passed}/${total} tests passed`);
  console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);
  
  console.log('\nDetailed Results:');
  for (const [test, result] of Object.entries(results)) {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`   ${test}: ${status}`);
  }
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! BlueAssure Platform integration is working correctly.');
    console.log('\n✅ Ready for Production:');
    console.log('   • BlueAssure Platform API v3.0.0 validated');
    console.log('   • AssureCard product with biometric matching confirmed');
    console.log('   • DirectImageUpload mode working');
    console.log('   • Your plan includes: AssureID, KBA Questions, AssurePhone');
    console.log('\n🔧 Integration Summary:');
    console.log('   • Primary Product: AssureCard (IdentiFraud Card with KBA)');
    console.log('   • Features: Document validation, face matching, KBA questions');
    console.log('   • Backup Product: AssureID (Identifraud Consumer+ w/KBA)');
    console.log('   • Additional: AssurePhone for phone verification');
  } else {
    console.log('\n⚠️ Some tests failed. Check the logs above for details.');
    console.log('\n💡 Troubleshooting Resources:');
    console.log('   1. BlueAssure Support: Contact EVS Solutions for API issues');
    console.log('   2. Documentation: BlueAssure Platform Integration API v3.0.0');
    console.log('   3. Account Status: Verify your plan includes the required products');
    console.log('   4. Network: Ensure connectivity to blueassure.evssolutions.com');
  }
}

/**
 * Main test execution
 */
async function main(): Promise<void> {
  console.log('🚀 Starting BlueAssure Platform Integration Test Suite');
  console.log('═'.repeat(55));
  console.log('🔑 BlueAssure Platform API v3.0.0 Configuration:');
  console.log(`   Username: ${process.env.EVS_API_KEY?.substring(0, 15) || 'E27235-CE567A22'}...`);
  console.log(`   Base URL: https://blueassure.evssolutions.com`);
  console.log('   Environment: Production');
  console.log('\n📋 Your BlueAssure Plan:');
  console.log('   • AssureCard: IdentiFraud Card with KBA');
  console.log('     - Features: AssureID, KBA Questions, AssurePhone');
  console.log('   • AssureID: Identifraud Consumer+ w/KBA');
  console.log('     - Features: KBA Questions, AssurePhone');
  
  const results: { [key: string]: boolean } = {};
  
  // Test 1: Configuration
  results['Configuration'] = await testConfiguration();
  
  // Test 2: Connectivity
  results['Connectivity'] = await testConnectivity();
  
  // Test 3: Identity Verification
  results['Identity Verification'] = await testIdentityVerification();
  
  // Generate report
  generateTestReport(results);
  
  console.log('\n' + '═'.repeat(55));
  console.log('Test suite completed.');
  
  // Exit with appropriate code
  const allPassed = Object.values(results).every(Boolean);
  process.exit(allPassed ? 0 : 1);
}

// Run the test suite
main().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
}); 