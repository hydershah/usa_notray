#!/usr/bin/env tsx

import { S3Client, CreateBucketCommand, ListBucketsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const region = process.env.VULTR_REGION || 'ewr1';
const bucketName = process.env.VULTR_BUCKET_NAME || 'usa-notary-documents';

const s3Client = new S3Client({
  region: region,
  endpoint: process.env.VULTR_ENDPOINT || `https://${region}.vultrobjects.com`,
  credentials: {
    accessKeyId: process.env.VULTR_ACCESS_KEY!,
    secretAccessKey: process.env.VULTR_SECRET_KEY!,
  },
  forcePathStyle: false,
});

async function createBucket() {
  console.log('🪣 Creating Vultr Object Storage Bucket...\n');
  
  try {
    // First check if bucket already exists
    console.log('📋 Checking existing buckets...');
    const listCommand = new ListBucketsCommand({});
    const listResult = await s3Client.send(listCommand);
    
    const existingBucket = listResult.Buckets?.find(bucket => bucket.Name === bucketName);
    
    if (existingBucket) {
      console.log(`✅ Bucket '${bucketName}' already exists!`);
      console.log(`📅 Created: ${existingBucket.CreationDate}`);
      return;
    }
    
    // Create the bucket (Vultr doesn't require CreateBucketConfiguration)
    console.log(`🔨 Creating bucket: ${bucketName}`);
    const createCommand = new CreateBucketCommand({
      Bucket: bucketName,
      // Vultr Object Storage doesn't use CreateBucketConfiguration
    });
    
    await s3Client.send(createCommand);
    
    console.log('🎉 Success! Vultr bucket created:');
    console.log('─'.repeat(50));
    console.log(`📦 Bucket Name: ${bucketName}`);
    console.log(`🌍 Region: ${region}`);
    console.log(`🔗 Endpoint: ${process.env.VULTR_ENDPOINT}`);
    console.log('─'.repeat(50));
    console.log('\n✅ Your USA Notary Platform can now store files in Vultr!');
    
  } catch (error: any) {
    console.log('\n❌ Failed to create bucket:');
    console.error(error.message);
    
    if (error.name === 'BucketAlreadyOwnedByYou') {
      console.log('\n✅ Actually, the bucket already exists and you own it!');
    } else {
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Check your Vultr credentials are correct');
      console.log('2. Verify you have Object Storage enabled in Vultr account');
      console.log('3. Try a different bucket name if this one is taken globally');
      console.log('4. Check the region matches your Vultr Object Storage region');
    }
  }
}

createBucket(); 