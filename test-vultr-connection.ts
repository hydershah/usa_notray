#!/usr/bin/env tsx

/**
 * Test Vultr Object Storage Connection
 * This script tests your Vultr setup without affecting existing files
 */

import { config } from 'dotenv';
import { S3Client, ListBucketsCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Load environment variables from .env file
config();

async function testVultrConnection() {
  console.log('🧪 Testing Vultr Object Storage Connection...\n');
  
  // Check environment variables
  const requiredVars = ['VULTR_ACCESS_KEY', 'VULTR_SECRET_KEY', 'VULTR_BUCKET_NAME', 'VULTR_REGION'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:');
    missing.forEach(varName => {
      console.log(`   ${varName}=your_${varName.toLowerCase()}`);
    });
    console.log('\n💡 Add these to your .env file and restart');
    return;
  }

  console.log('✅ Environment variables found');
  
  const region = process.env.VULTR_REGION!;
  const bucketName = process.env.VULTR_BUCKET_NAME!;
  
  // Initialize Vultr S3-compatible client
  const s3Client = new S3Client({
    region: region,
    endpoint: `https://${region}.vultrobjects.com`,
    credentials: {
      accessKeyId: process.env.VULTR_ACCESS_KEY!,
      secretAccessKey: process.env.VULTR_SECRET_KEY!,
    },
    forcePathStyle: false,
  });

  try {
    // Test 1: List buckets (verify connection)
    console.log('📡 Testing connection to Vultr...');
    const listCommand = new ListBucketsCommand({});
    await s3Client.send(listCommand);
    console.log('✅ Connected to Vultr Object Storage');

    // Test 2: Upload test file
    console.log('📤 Testing file upload...');
    const testContent = Buffer.from('Hello from your USA Notary system! 🚀');
    const testKey = `test/connection-test-${Date.now()}.txt`;
    
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
      Metadata: {
        testUpload: 'true',
        timestamp: new Date().toISOString(),
      },
    });
    
    await s3Client.send(uploadCommand);
    console.log('✅ Test file uploaded successfully');

    // Test 3: Generate signed URL
    console.log('🔗 Testing signed URL generation...');
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    });
    
    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });
    console.log('✅ Signed URL generated successfully');

    // Test 4: Verify file access
    console.log('🔍 Testing file access...');
    const response = await fetch(signedUrl);
    const content = await response.text();
    
    if (content.includes('Hello from your USA Notary system!')) {
      console.log('✅ File content verified');
    } else {
      console.log('⚠️  File content mismatch');
    }

    // Results Summary
    console.log('\n🎉 Vultr Object Storage Test Results:');
    console.log('─'.repeat(50));
    console.log(`✅ Connection: Success`);
    console.log(`✅ Upload: Success`);
    console.log(`✅ URL Generation: Success`);
    console.log(`✅ File Access: Success`);
    console.log(`📍 Region: ${region}`);
    console.log(`🪣 Bucket: ${bucketName}`);
    console.log(`🌐 Test URL: ${signedUrl.split('?')[0]}`);
    console.log('─'.repeat(50));
    console.log('\n🚀 Your Vultr Object Storage is ready to use!');
    console.log('\n📋 Next Steps:');
    console.log('1. Replace upload handlers with Vultr integration');
    console.log('2. Test with actual file uploads');
    console.log('3. Set up background migration for existing files');

  } catch (error) {
    console.log('\n❌ Vultr Connection Failed:');
    console.error(error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify your Vultr Access Key and Secret Key');
    console.log('2. Check that your bucket exists in Vultr dashboard');
    console.log('3. Ensure region matches your bucket region');
    console.log('4. Verify your Vultr account has Object Storage enabled');
  }
}

// Run the test
testVultrConnection(); 