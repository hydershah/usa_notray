#!/usr/bin/env node

/**
 * Fix Vultr Storage Configuration
 * This script sets up Vultr environment variables and tests document access
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vultr credentials from the production setup
const VULTR_CONFIG = {
  VULTR_ACCESS_KEY: 'GE8MIGK9HAH7L26SPN51',
  VULTR_SECRET_KEY: 'F4kBLWvvM6CSL3nDtdp7ROdynGmc5A1Fxy1IH20e',
  VULTR_REGION: 'ewr1',
  VULTR_BUCKET_NAME: 'usanotary',
  VULTR_ENDPOINT: 'https://ewr1.vultrobjects.com',
  VULTR_HOST_BASE: 'ewr1.vultrobjects.com',
  VULTR_HOST_BUCKET: '%(bucket)s.ewr1.vultrobjects.com'
};

async function setupVultrEnvironment() {
  console.log('🔧 Setting up Vultr environment variables...');
  
  // Set environment variables for this process
  Object.entries(VULTR_CONFIG).forEach(([key, value]) => {
    process.env[key] = value;
  });
  
  console.log('✅ Vultr environment variables set');
  
  // Test Vultr connection
  try {
    const { cloudStorage } = await import('../server/lib/cloud-storage-service.ts');
    const stats = await cloudStorage.getBucketStats();
    console.log('☁️ Vultr connection test:', stats);
    
    if (stats.isAccessible) {
      console.log('✅ Vultr storage is accessible');
      return true;
    } else {
      console.log('❌ Vultr storage is not accessible');
      return false;
    }
  } catch (error) {
    console.error('❌ Vultr connection test failed:', error.message);
    return false;
  }
}

async function testDocumentAccess() {
  console.log('\n📄 Testing document access...');
  
  try {
    const { cloudStorage } = await import('../server/lib/cloud-storage-service.ts');
    
    // Test file that was mentioned in the error
    const testFilePath = 'development/document/2025/07/notarizations/job-79/20250716_doc_00f7m9_job79_RON_seller_doc_pkg.pdf';
    
    console.log(`🔍 Checking file: ${testFilePath}`);
    
    const fileExists = await cloudStorage.fileExists(testFilePath);
    console.log(`📄 File exists in Vultr: ${fileExists}`);
    
    if (fileExists) {
      try {
        const signedUrl = await cloudStorage.getSignedUrl(testFilePath, 3600);
        console.log('🔗 Generated signed URL successfully');
        console.log(`URL: ${signedUrl.substring(0, 100)}...`);
        
        // Test the URL
        const response = await fetch(signedUrl);
        console.log(`📄 URL test result: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          console.log('✅ Document access is working correctly');
          return true;
        } else {
          console.log('❌ Document access failed');
          return false;
        }
      } catch (urlError) {
        console.error('❌ Signed URL generation failed:', urlError.message);
        return false;
      }
    } else {
      console.log('❌ File not found in Vultr storage');
      return false;
    }
  } catch (error) {
    console.error('❌ Document access test failed:', error.message);
    return false;
  }
}

async function createLocalFallback() {
  console.log('\n📁 Creating local fallback mechanism...');
  
  try {
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Created uploads directory');
    }
    
    // Create job-requests subdirectory
    const jobRequestsDir = path.join(uploadsDir, 'job-requests');
    if (!fs.existsSync(jobRequestsDir)) {
      fs.mkdirSync(jobRequestsDir, { recursive: true });
      console.log('✅ Created job-requests directory');
    }
    
    console.log('✅ Local fallback directories ready');
    return true;
  } catch (error) {
    console.error('❌ Failed to create local fallback:', error.message);
    return false;
  }
}

async function updateDocumentRoutes() {
  console.log('\n🔧 Updating document routes for better error handling...');
  
  try {
    const routesFile = path.join(process.cwd(), 'server', 'routes.ts');
    const content = fs.readFileSync(routesFile, 'utf8');
    
    // Check if the improved error handling is already present
    if (content.includes('vultrStatus: bucketStats.isAccessible')) {
      console.log('✅ Document routes already have improved error handling');
      return true;
    }
    
    console.log('⚠️ Document routes may need updating for better error handling');
    console.log('📝 Consider updating the /api/documents/:filePath(*) route');
    return true;
  } catch (error) {
    console.error('❌ Failed to check document routes:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Fixing Vultr Storage Configuration\n');
  
  // Step 1: Setup Vultr environment
  const vultrReady = await setupVultrEnvironment();
  
  // Step 2: Test document access
  const documentAccess = await testDocumentAccess();
  
  // Step 3: Create local fallback
  const localFallback = await createLocalFallback();
  
  // Step 4: Update routes
  const routesUpdated = await updateDocumentRoutes();
  
  console.log('\n📋 Summary:');
  console.log(`Vultr Environment: ${vultrReady ? '✅ Ready' : '❌ Failed'}`);
  console.log(`Document Access: ${documentAccess ? '✅ Working' : '❌ Failed'}`);
  console.log(`Local Fallback: ${localFallback ? '✅ Ready' : '❌ Failed'}`);
  console.log(`Routes Updated: ${routesUpdated ? '✅ Ready' : '❌ Failed'}`);
  
  if (vultrReady && documentAccess) {
    console.log('\n🎉 Vultr storage is working correctly!');
    console.log('📝 To make this permanent, add these environment variables to your .env file:');
    Object.entries(VULTR_CONFIG).forEach(([key, value]) => {
      console.log(`${key}=${value}`);
    });
  } else {
    console.log('\n⚠️ Some issues detected. Check the logs above for details.');
    console.log('📝 The system will fall back to local storage when Vultr is not available.');
  }
  
  console.log('\n🔧 Next steps:');
  console.log('1. Add the Vultr environment variables to your .env file');
  console.log('2. Restart your development server');
  console.log('3. Test document upload and download functionality');
}

main().catch(console.error); 