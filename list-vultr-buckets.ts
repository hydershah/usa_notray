#!/usr/bin/env tsx

import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const region = process.env.VULTR_REGION || 'ewr1';

const s3Client = new S3Client({
  region: region,
  endpoint: process.env.VULTR_ENDPOINT || `https://${region}.vultrobjects.com`,
  credentials: {
    accessKeyId: process.env.VULTR_ACCESS_KEY!,
    secretAccessKey: process.env.VULTR_SECRET_KEY!,
  },
  forcePathStyle: false,
});

async function listBuckets() {
  console.log('📋 Listing Vultr Object Storage Buckets...\n');
  
  try {
    console.log('🔗 Connection details:');
    console.log(`   Region: ${region}`);
    console.log(`   Endpoint: ${process.env.VULTR_ENDPOINT}`);
    console.log(`   Access Key: ${process.env.VULTR_ACCESS_KEY?.slice(0, 8)}...`);
    console.log('');
    
    const command = new ListBucketsCommand({});
    const result = await s3Client.send(command);
    
    if (result.Buckets && result.Buckets.length > 0) {
      console.log('✅ Found existing buckets:');
      console.log('─'.repeat(50));
      result.Buckets.forEach((bucket, index) => {
        console.log(`${index + 1}. ${bucket.Name} (created: ${bucket.CreationDate})`);
      });
      console.log('─'.repeat(50));
      
      // Check if our target bucket exists
      const targetBucket = result.Buckets.find(b => b.Name === 'usa-notary-documents');
      if (targetBucket) {
        console.log(`\n🎉 Target bucket 'usa-notary-documents' already exists!`);
        console.log('Your Vultr migration is ready to go!');
      } else {
        console.log(`\n📝 Target bucket 'usa-notary-documents' not found.`);
        console.log('You can either:');
        console.log('1. Create it manually in Vultr dashboard');
        console.log('2. Use one of the existing buckets above');
      }
    } else {
      console.log('📭 No buckets found. You need to create one first.');
      console.log('');
      console.log('🔧 Next steps:');
      console.log('1. Go to Vultr Object Storage dashboard');
      console.log('2. Create a new bucket named "usa-notary-documents"');
      console.log('3. Select region: New Jersey (ewr1)');
    }
    
  } catch (error: any) {
    console.log('❌ Failed to connect to Vultr:');
    console.error(error.message);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify your Vultr Object Storage credentials');
    console.log('2. Check that Object Storage is enabled in your Vultr account');
    console.log('3. Ensure the region and endpoint are correct');
  }
}

listBuckets(); 