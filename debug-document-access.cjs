const path = require('path');
const fs = require('fs').promises;

async function debugDocumentAccess() {
  console.log('🔍 Debugging document access issue...\n');
  
  const problematicPath = 'development/document/2025/07/notarizations/job-79/20250716_doc_00f7m9_job79_RON_seller_doc_pkg.pdf';
  
  try {
    // 1. Check environment variables first
    console.log('1️⃣ Checking Vultr environment variables...');
    const vultrVars = {
      'VULTR_ACCESS_KEY': !!process.env.VULTR_ACCESS_KEY,
      'VULTR_SECRET_KEY': !!process.env.VULTR_SECRET_KEY,
      'VULTR_REGION': process.env.VULTR_REGION || 'not set',
      'VULTR_BUCKET_NAME': process.env.VULTR_BUCKET_NAME || 'not set',
      'VULTR_ENDPOINT': process.env.VULTR_ENDPOINT || 'not set'
    };
    console.log('   Environment variables:', vultrVars);
    
    // 2. Test Vultr access
    if (vultrVars['VULTR_ACCESS_KEY'] && vultrVars['VULTR_SECRET_KEY']) {
      console.log('\n2️⃣ Testing Vultr access...');
      try {
        const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
        
        const s3Client = new S3Client({
          region: process.env.VULTR_REGION || 'ewr1',
          endpoint: process.env.VULTR_ENDPOINT || 'https://ewr1.vultrobjects.com',
          credentials: {
            accessKeyId: process.env.VULTR_ACCESS_KEY,
            secretAccessKey: process.env.VULTR_SECRET_KEY,
          },
        });
        
        const command = new HeadObjectCommand({
          Bucket: process.env.VULTR_BUCKET_NAME || 'usanotary',
          Key: problematicPath,
        });
        
        const result = await s3Client.send(command);
        console.log('   ✅ File found in Vultr!');
        console.log('   File size:', result.ContentLength);
        console.log('   Last modified:', result.LastModified);
        console.log('   Content type:', result.ContentType);
        
      } catch (vultrError) {
        console.log('   ❌ Vultr access failed:', vultrError.message);
        
        // Check if it's a credentials issue
        if (vultrError.message.includes('InvalidAccessKeyId') || vultrError.message.includes('SignatureDoesNotMatch')) {
          console.log('   🔑 This looks like a Vultr credentials issue!');
        } else if (vultrError.message.includes('NoSuchKey') || vultrError.message.includes('Not Found')) {
          console.log('   📄 File not found in Vultr storage');
        } else if (vultrError.message.includes('NoSuchBucket')) {
          console.log('   🪣 Bucket not found - check VULTR_BUCKET_NAME');
        }
      }
    } else {
      console.log('\n❌ Vultr credentials not available');
    }
    
    // 3. Check local file paths
    console.log('\n3️⃣ Checking local file paths...');
    const possibleLocalPaths = [
      path.resolve('uploads', problematicPath),
      path.resolve('uploads', 'documents', problematicPath),
      path.resolve(problematicPath.startsWith('/') ? problematicPath.substring(1) : problematicPath),
      path.resolve(problematicPath),
      path.resolve('uploads', path.basename(problematicPath)),
      path.resolve('uploads', 'signed', path.basename(problematicPath))
    ];
    
    for (const localPath of possibleLocalPaths) {
      try {
        const stats = await fs.stat(localPath);
        console.log(`   ✅ Found locally: ${localPath} (${stats.size} bytes)`);
      } catch (e) {
        console.log(`   ❌ Not found: ${localPath}`);
      }
    }
    
    // 4. Check uploads directory structure
    console.log('\n4️⃣ Checking uploads directory structure...');
    try {
      const uploadsDir = path.resolve('uploads');
      const dirExists = await fs.stat(uploadsDir).then(() => true).catch(() => false);
      
      if (dirExists) {
        console.log('   📁 Uploads directory exists');
        
        // List some recent files
        try {
          const files = await fs.readdir(uploadsDir, { withFileTypes: true });
          const recentFiles = files
            .filter(f => f.isFile() && f.name.includes('.pdf'))
            .slice(0, 5);
          
          console.log(`   📄 Recent PDF files (${recentFiles.length}/total):`);
          recentFiles.forEach(file => {
            console.log(`      - ${file.name}`);
          });
        } catch (listError) {
          console.log('   ❌ Could not list files:', listError.message);
        }
      } else {
        console.log('   ❌ Uploads directory does not exist');
      }
    } catch (dirError) {
      console.log('   ❌ Error checking uploads directory:', dirError.message);
    }
    
    // 5. Test document serving endpoint
    console.log('\n5️⃣ Testing document serving endpoint...');
    try {
      const fetch = (await import('node-fetch')).default;
      const testUrl = `http://localhost:3000/api/documents/${encodeURIComponent(problematicPath)}`;
      console.log('   Testing URL:', testUrl);
      
      const response = await fetch(testUrl, {
        timeout: 10000
      });
      
      console.log('   Response status:', response.status, response.statusText);
      console.log('   Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.status !== 200) {
        const errorText = await response.text();
        console.log('   Error response:', errorText);
      }
      
    } catch (fetchError) {
      console.log('   ❌ Endpoint test failed:', fetchError.message);
      console.log('   💡 Make sure the server is running on localhost:3000');
    }
    
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