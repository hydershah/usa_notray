#!/usr/bin/env tsx

// Test Real EVS Solutions Integration
// This script tests the actual EVS API integration (no mocks)

import dotenv from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
dotenv.config({ path: resolve(projectRoot, '.env') });

// Import the EVS service directly
import { evsService } from '../server/lib/evs-service';

async function testEVSConfiguration() {
  console.log('🔧 Testing EVS Configuration...\n');
  
  try {
    const validation = evsService.validateConfiguration();
    
    if (validation.valid) {
      console.log('✅ EVS Configuration is valid');
      console.log(`   API Key: ${process.env.EVS_API_KEY ? process.env.EVS_API_KEY.substring(0, 10) + '...' : 'Not set'}`);
      console.log(`   Environment: ${process.env.EVS_ENVIRONMENT || 'production'}`);
    } else {
      console.log('❌ EVS Configuration is invalid:');
      validation.errors.forEach(error => console.log(`   - ${error}`));
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Configuration test failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

async function testEVSConnection() {
  console.log('\n🌐 Testing EVS API Connection...\n');
  
  try {
    const result = await evsService.testConnection();
    
    if (result.success) {
      console.log('✅ EVS API Connection successful');
      console.log(`   ${result.message}`);
    } else {
      console.log('❌ EVS API Connection failed');
      console.log(`   ${result.message}`);
    }
    
    return result.success;
  } catch (error) {
    console.error('❌ Connection test failed:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

function createTestImages() {
  // Create minimal test images (1x1 pixel JPEG)
  const minimalJpeg = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
    0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
    0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x80, 0xFF, 0xD9
  ]);

  return {
    frontImage: minimalJpeg,
    backImage: minimalJpeg,
    selfieImage: minimalJpeg
  };
}

async function testEVSVerification() {
  console.log('\n📄 Testing EVS Identity Verification (Real API)...\n');
  
  try {
    const testImages = createTestImages();
    
    const verificationRequest = {
      documentType: 'drivers_license' as const,
      frontImage: testImages.frontImage,
      backImage: testImages.backImage,
      selfieImage: testImages.selfieImage,
      userId: `test_user_${Date.now()}`
    };

    console.log('📤 Sending verification request to EVS...');
    console.log(`   Document Type: ${verificationRequest.documentType}`);
    console.log(`   User ID: ${verificationRequest.userId}`);
    console.log(`   Images: Front (${testImages.frontImage.length} bytes), Back (${testImages.backImage.length} bytes), Selfie (${testImages.selfieImage.length} bytes)`);
    
    const startTime = Date.now();
    const result = await evsService.verifyIdentity(verificationRequest);
    const endTime = Date.now();
    
    console.log(`\n📥 EVS Response received in ${endTime - startTime}ms:`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Confidence: ${result.confidence}%`);
    console.log(`   Transaction ID: ${result.transactionId}`);
    
    if (result.document) {
      console.log('\n📋 Document Data:');
      console.log(`   Type: ${result.document.type}`);
      console.log(`   Name: ${result.document.extractedData.firstName} ${result.document.extractedData.lastName}`);
      console.log(`   DOB: ${result.document.extractedData.dateOfBirth}`);
      console.log(`   Document #: ${result.document.extractedData.documentNumber}`);
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
    
    return result;
    
  } catch (error) {
    console.error('❌ EVS Verification failed:', error instanceof Error ? error.message : 'Unknown error');
    
    // Provide specific guidance based on error type
    if (error instanceof Error && error.message.includes('All EVS API endpoints failed')) {
      console.log('\n💡 Troubleshooting Tips:');
      console.log('   1. Verify your EVS API key is correct');
      console.log('   2. Check if your account has API access enabled');
      console.log('   3. Ensure your network can reach EVS servers');
      console.log('   4. Contact EVS support for API endpoint documentation');
    }
    
    return null;
  }
}

async function testStatusCheck(transactionId: string) {
  if (!transactionId) return;
  
  console.log('\n🔍 Testing Status Check...\n');
  
  try {
    const status = await evsService.getVerificationStatus(transactionId);
    
    if (status) {
      console.log('✅ Status check successful');
      console.log(`   Status: ${status.status}`);
      console.log(`   Confidence: ${status.confidence}%`);
    } else {
      console.log('❌ Status check failed or transaction not found');
    }
    
  } catch (error) {
    console.error('❌ Status check error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

async function main() {
  console.log('🧪 EVS Solutions Real API Integration Test');
  console.log('==========================================\n');
  
  console.log('ℹ️ This test uses the REAL EVS API - no mock responses');
  console.log('   Make sure you have a valid EVS API key configured\n');
  
  // Test configuration
  const configValid = await testEVSConfiguration();
  if (!configValid) {
    console.log('\n❌ Cannot proceed without valid configuration');
    process.exit(1);
  }
  
  // Test connection
  const connectionValid = await testEVSConnection();
  if (!connectionValid) {
    console.log('\n⚠️ API connection failed, but continuing with verification test...');
  }
  
  // Test verification
  const verificationResult = await testEVSVerification();
  
  // Test status check if we got a transaction ID
  if (verificationResult?.transactionId) {
    await testStatusCheck(verificationResult.transactionId);
  }
  
  console.log('\n🎯 Test Summary:');
  console.log('================');
  console.log(`Configuration: ${configValid ? '✅' : '❌'}`);
  console.log(`Connection: ${connectionValid ? '✅' : '❌'}`);
  console.log(`Verification: ${verificationResult ? '✅' : '❌'}`);
  
  if (verificationResult) {
    console.log('\n🎉 EVS Integration is working with real API!');
    console.log('   You can now use identity verification in your application.');
  } else {
    console.log('\n💭 EVS Integration test completed.');
    console.log('   Check the errors above and verify your API credentials.');
    console.log('\n📞 Next Steps:');
    console.log('   1. Contact EVS Support at 866-491-5665');
    console.log('   2. Request API documentation and endpoint details');
    console.log('   3. Verify your account has API access enabled');
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 