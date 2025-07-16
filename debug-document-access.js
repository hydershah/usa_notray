import { cloudStorage } from './server/lib/cloud-storage-service.ts';
import { db } from './server/db.ts';
import { jobDocuments } from './shared/schema.ts';
import { like } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

async function debugDocumentAccess() {
  console.log('🔍 Debugging document access issue...\n');
  
  const problematicPath = 'development/document/2025/07/notarizations/job-79/20250716_doc_00f7m9_job79_RON_seller_doc_pkg.pdf';
  
  try {
    // 1. Check Vultr configuration
    console.log('1️⃣ Checking Vultr configuration...');
    const bucketStats = await cloudStorage.getBucketStats();
    console.log('   Bucket stats:', bucketStats);
    
    // 2. Check if file exists in Vultr
    console.log('\n2️⃣ Checking if file exists in Vultr...');
    const fileExists = await cloudStorage.fileExists(problematicPath);
    console.log('   File exists in Vultr:', fileExists);
    
    // 3. Try to get file metadata
    console.log('\n3️⃣ Trying to get file metadata...');
    try {
      const metadata = await cloudStorage.getFileMetadata(problematicPath);
      console.log('   File metadata:', metadata);
    } catch (metaError) {
      console.log('   Metadata error:', metaError.message);
    }
    
    // 4. Try to generate signed URL
    console.log('\n4️⃣ Trying to generate signed URL...');
    try {
      const signedUrl = await cloudStorage.getSignedUrl(problematicPath, 3600);
      console.log('   Signed URL:', signedUrl);
      
      // 5. Try to fetch the URL
      console.log('\n5️⃣ Testing URL access...');
      const response = await fetch(signedUrl);
      console.log('   URL status:', response.status, response.statusText);
      
    } catch (urlError) {
      console.log('   Signed URL error:', urlError.message);
    }
    
    // 6. Check local file paths
    console.log('\n6️⃣ Checking local file paths...');
    const possibleLocalPaths = [
      path.resolve('uploads', problematicPath),
      path.resolve('uploads', 'documents', problematicPath),
      path.resolve(problematicPath.startsWith('/') ? problematicPath.substring(1) : problematicPath),
      path.resolve(problematicPath)
    ];
    
    for (const localPath of possibleLocalPaths) {
      try {
        const stats = await fs.stat(localPath);
        console.log(`   ✅ Found locally: ${localPath} (${stats.size} bytes)`);
      } catch (e) {
        console.log(`   ❌ Not found: ${localPath}`);
      }
    }
    
    // 7. Check database record
    console.log('\n7️⃣ Checking database for this file...');
    const docs = await db.select().from(jobDocuments).where(
      like(jobDocuments.filePath, `%${problematicPath.split('/').pop()}%`)
    );
    
    console.log('   Database records found:', docs.length);
    docs.forEach(doc => {
      console.log(`   - ID: ${doc.id}, Path: ${doc.filePath}, Job: ${doc.jobId}`);
    });
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugDocumentAccess().then(() => {
  console.log('\n✅ Debug complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
}); 