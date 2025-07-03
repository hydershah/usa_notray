#!/usr/bin/env tsx

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const region = process.env.VULTR_REGION || 'ewr1';
const bucketName = process.env.VULTR_BUCKET_NAME || 'usanotary';

console.log('🔧 Debug Vultr Upload Configuration');
console.log('──────────────────────────────────');
console.log(`Region: ${region}`);
console.log(`Bucket: ${bucketName}`);
console.log(`Endpoint: ${process.env.VULTR_ENDPOINT}`);
console.log(`Access Key: ${process.env.VULTR_ACCESS_KEY?.slice(0, 8)}...`);
console.log(`Secret Key: ${process.env.VULTR_SECRET_KEY ? 'SET' : 'NOT SET'}`);
console.log('');

const s3Client = new S3Client({
  region: region,
  endpoint: process.env.VULTR_ENDPOINT || `https://${region}.vultrobjects.com`,
  credentials: {
    accessKeyId: process.env.VULTR_ACCESS_KEY!,
    secretAccessKey: process.env.VULTR_SECRET_KEY!,
  },
  forcePathStyle: false,
});

async function debugUpload() {
  try {
    // Find a test file
    const testFiles = [
      'uploads/0dbd7a53201604904ec562f730dcd7cb',
      'uploads/stamps/1/notary_stamp_1751087870552_b7fbcdb6f369e4cd262d65b03a94a6a7.png'
    ];
    
    let testFile = '';
    for (const file of testFiles) {
      try {
        await fs.access(file);
        testFile = file;
        break;
      } catch {
        continue;
      }
    }
    
    if (!testFile) {
      console.log('❌ No test files found');
      return;
    }
    
    console.log(`🧪 Testing upload with file: ${testFile}`);
    
    // Read file
    const fileBuffer = await fs.readFile(testFile);
    console.log(`📄 File size: ${fileBuffer.length} bytes`);
    
    // Determine content type
    const ext = path.extname(testFile).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 
                       ext === '.pdf' ? 'application/pdf' : 
                       'application/octet-stream';
    
    console.log(`📋 Content type: ${contentType}`);
    
    // Generate simple key
    const fileName = path.basename(testFile);
    const testKey = `debug-test/${Date.now()}_${fileName}`;
    
    console.log(`🔑 Vultr key: ${testKey}`);
    console.log('');
    console.log('📤 Attempting upload...');
    
    // Upload to Vultr
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        uploadTest: 'true',
        originalFile: testFile,
        uploadedAt: new Date().toISOString(),
      },
    });
    
    const result = await s3Client.send(uploadCommand);
    
    console.log('✅ Upload successful!');
    console.log(`📍 ETag: ${result.ETag}`);
    console.log(`🌐 URL: https://${bucketName}.${region}.vultrobjects.com/${testKey}`);
    
  } catch (error: any) {
    console.log('❌ Upload failed!');
    console.log('Error details:');
    console.log(`  Name: ${error.name}`);
    console.log(`  Message: ${error.message}`);
    console.log(`  Code: ${error.Code || 'N/A'}`);
    console.log(`  Status: ${error.$metadata?.httpStatusCode || 'N/A'}`);
    
    if (error.name === 'CredentialsProviderError') {
      console.log('\n🔧 This is a credentials issue. Check:');
      console.log('  1. VULTR_ACCESS_KEY is correct');
      console.log('  2. VULTR_SECRET_KEY is correct');
    } else if (error.name === 'NoSuchBucket') {
      console.log('\n🔧 Bucket not found. Check:');
      console.log('  1. Bucket name is correct');
      console.log('  2. Bucket exists in Vultr dashboard');
      console.log('  3. Region matches bucket region');
    } else {
      console.log('\n🔧 General troubleshooting:');
      console.log('  1. Check internet connection');
      console.log('  2. Verify Vultr account has Object Storage enabled');
      console.log('  3. Try a different file');
    }
  }
}

debugUpload(); 