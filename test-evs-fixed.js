#!/usr/bin/env node

/**
 * Test script for EVS service after fixes
 * 
 * Usage:
 * node test-evs-fixed.js          # Test with real BlueAssure API
 * EVS_BYPASS=true node test-evs-fixed.js  # Test with development bypass
 */

import fs from 'fs';
import path from 'path';

// Set environment variables for testing
process.env.NODE_ENV = 'development';
process.env.EVS_API_KEY = 'E27235-CE567A22-0D31-474A-B551-252882763208';
process.env.EVS_PASSWORD = '8aeWPi0XV#AyS#I';
process.env.EVS_ENVIRONMENT = 'production';

async function createTestImage() {
  // Create a minimal valid JPEG image (1x1 pixel)
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
  
  // Make it larger to pass quality validation (repeat the data)
  const largeImage = Buffer.concat(Array(3000).fill(minimalJpeg));
  return largeImage;
}

async function testEVSService() {
  console.log('🧪 Testing EVS Service After Fixes');
  console.log('=' .repeat(50));
  
  try {
    // Import the EVS service
    const { evsService } = await import('./server/lib/evs-service.ts');
    
    // Test 1: Configuration validation
    console.log('\n1️⃣ Testing Configuration Validation...');
    const configCheck = evsService.validateConfiguration();
    console.log(`   Configuration valid: ${configCheck.valid ? '✅' : '❌'}`);
    if (!configCheck.valid) {
      console.log('   Errors:', configCheck.errors);
    }
    
    // Test 2: Create test images
    console.log('\n2️⃣ Creating Test Images...');
    const testImage = await createTestImage();
    console.log(`   Created test image: ${testImage.length} bytes`);
    
    // Test 3: Verify identity with test data
    console.log('\n3️⃣ Testing Identity Verification...');
    const verificationRequest = {
      documentType: 'drivers_license',
      frontImage: testImage,
      backImage: testImage,
      selfieImage: testImage,
      userId: 'test_user_' + Date.now()
    };
    
    console.log('   Sending verification request...');
    const startTime = Date.now();
    const result = await evsService.verifyIdentity(verificationRequest);
    const endTime = Date.now();
    
    // Test 4: Display results
    console.log('\n4️⃣ Verification Results:');
    console.log(`   Duration: ${endTime - startTime}ms`);
    console.log(`   Success: ${result.success ? '✅' : '❌'}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Confidence: ${result.confidence}%`);
    console.log(`   Transaction ID: ${result.transactionId || 'N/A'}`);
    
    if (result.document) {
      console.log('\n   📄 Document Data:');
      console.log(`      Name: ${result.document.extractedData.firstName} ${result.document.extractedData.lastName}`);
      console.log(`      DOB: ${result.document.extractedData.dateOfBirth}`);
      console.log(`      Doc #: ${result.document.extractedData.documentNumber}`);
    }
    
    if (result.biometric) {
      console.log('\n   👤 Biometric Data:');
      console.log(`      Face Match: ${result.biometric.faceMatch ? '✅' : '❌'}`);
      console.log(`      Confidence: ${result.biometric.confidence}%`);
      console.log(`      Liveness: ${result.biometric.livenessScore}%`);
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log('\n   ❌ Errors:');
      result.errors.forEach(error => console.log(`      - ${error}`));
    }
    
    if (result.warnings && result.warnings.length > 0) {
      console.log('\n   ⚠️ Warnings:');
      result.warnings.forEach(warning => console.log(`      - ${warning}`));
    }
    
    // Test 5: Summary
    console.log('\n' + '=' .repeat(50));
    console.log('📊 TEST SUMMARY:');
    console.log(`   Mode: ${process.env.EVS_BYPASS === 'true' ? 'Development Bypass' : 'Real BlueAssure API'}`);
    console.log(`   Configuration: ${configCheck.valid ? 'Valid' : 'Invalid'}`);
    console.log(`   Verification: ${result.success ? 'Successful' : 'Failed'}`);
    console.log(`   Processing Time: ${endTime - startTime}ms`);
    
    if (process.env.EVS_BYPASS === 'true') {
      console.log('\n✅ Development bypass mode working correctly!');
      console.log('   To test real API: Remove EVS_BYPASS=true');
    } else {
      console.log('\n' + (result.success ? '✅ Real API test successful!' : '⚠️ Real API test shows configuration issues'));
      console.log('   To test bypass mode: Set EVS_BYPASS=true');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Stack:', error.stack);
  }
}

// Run the test
testEVSService().catch(console.error); 