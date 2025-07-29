import dotenv from 'dotenv';
dotenv.config();

import { cloudStorage } from './lib/cloud-storage-service';
import fs from 'fs';

async function testUpload() {
  console.log('🧪 Testing Upload Configuration...\n');
  
  // Test environment variables
  console.log('📋 Environment Variables:');
  console.log(`   VULTR_ACCESS_KEY: ${process.env.VULTR_ACCESS_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   VULTR_SECRET_KEY: ${process.env.VULTR_SECRET_KEY ? '✅ SET' : '❌ NOT SET'}`);
  console.log(`   VULTR_REGION: ${process.env.VULTR_REGION || '❌ NOT SET'}`);
  console.log(`   VULTR_BUCKET_NAME: ${process.env.VULTR_BUCKET_NAME || '❌ NOT SET'}`);
  console.log(`   VULTR_ENDPOINT: ${process.env.VULTR_ENDPOINT || '❌ NOT SET'}\n`);
  
  // Test cloud storage initialization
  console.log('☁️ Cloud Storage Service:');
  try {
    // Try to list buckets to test connectivity
    const testBuffer = Buffer.from('Hello World - Upload Test');
    const testKey = `test/upload-test-${Date.now()}.txt`;
    
    console.log('   Testing upload...');
    const uploadResult = await cloudStorage.uploadFile(testBuffer, testKey, {
      contentType: 'text/plain',
      metadata: { test: 'true' }
    });
    
    console.log('   ✅ Upload successful!');
    console.log(`   📁 Key: ${uploadResult.key}`);
    console.log(`   🔗 URL: ${uploadResult.url}`);
    console.log(`   📏 Size: ${uploadResult.size} bytes`);
    
    // Test signed URL generation
    console.log('\n🔗 Testing signed URL generation...');
    const signedUrl = await cloudStorage.getSignedUrl(testKey, 3600);
    console.log(`   ✅ Signed URL: ${signedUrl.substring(0, 100)}...`);
    
    // Clean up test file
    console.log('\n🗑️ Cleaning up test file...');
    await cloudStorage.deleteFile(testKey);
    console.log('   ✅ Test file deleted');
    
    console.log('\n🎉 All upload tests passed! Upload system is working correctly.');
    
  } catch (error) {
    console.error('   ❌ Upload test failed:');
    console.error('   Error:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error && error.message.includes('Access denied')) {
      console.log('\n💡 Possible solutions:');
      console.log('   1. Check Vultr credentials are correct');
      console.log('   2. Verify bucket exists and is accessible');
      console.log('   3. Check Vultr region is correct');
    }
  }
}

// Run the test
testUpload().catch(console.error); 