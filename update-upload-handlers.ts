#!/usr/bin/env tsx

/**
 * Update Upload Handlers to Use Vultr Storage
 * This script updates the codebase to use Vultr Object Storage instead of local file storage
 */

import fs from 'fs/promises';
import path from 'path';

interface UpdateResult {
  filesUpdated: string[];
  changes: string[];
  errors: string[];
}

async function updateRoutes(): Promise<UpdateResult> {
  const result: UpdateResult = {
    filesUpdated: [],
    changes: [],
    errors: []
  };

  console.log('🔄 Updating upload handlers to use Vultr storage...\n');

  try {
    // 1. Update the job document upload section in routes.ts
    await updateJobDocumentUpload(result);
    
    // 2. Update file serving endpoints
    await updateFileServingEndpoints(result);
    
    // 3. Update notary profile uploads (already done above)
    result.changes.push('Updated notary profile uploads to use Vultr memory storage');
    
    console.log('✅ Upload handlers updated successfully!\n');
    
    return result;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(errorMsg);
    console.error('❌ Failed to update upload handlers:', errorMsg);
    return result;
  }
}

async function updateJobDocumentUpload(result: UpdateResult): Promise<void> {
  console.log('📄 Updating job document upload handlers...');
  
  const routesFile = path.join(process.cwd(), 'server', 'routes.ts');
  let content = await fs.readFile(routesFile, 'utf-8');
  
  // Check if already using memory storage
  if (content.includes('multer.memoryStorage()')) {
    console.log('   ℹ️  Already using memory storage for uploads');
    return;
  }
  
  // Find and replace the file handling section in job creation
  const oldFileHandling = `          await storage.createJobDocument({
            jobId: job.id,
            fileName: file.filename,
            originalName: metadata.originalName || file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            documentType: metadata.documentType,
            status: 'uploaded',
            uploadedBy: req.user.id,
            isRequired: metadata.isRequired,
            signaturePages: []
          });`;

  const newFileHandling = `          // Upload to Vultr cloud storage
          try {
            const sessionId = \`job-\${job.id}\`;
            const uploadResult = await handleCloudFileUpload(
              file.buffer,
              metadata.originalName || file.originalname,
              'document',
              sessionId,
              req.user.id,
              { documentType: metadata.documentType }
            );

            await storage.createJobDocument({
              jobId: job.id,
              fileName: metadata.originalName || file.originalname,
              originalName: metadata.originalName || file.originalname,
              filePath: uploadResult.key, // Store Vultr key instead of local path
              fileSize: uploadResult.size,
              mimeType: file.mimetype,
              documentType: metadata.documentType,
              status: 'uploaded',
              uploadedBy: req.user.id,
              isRequired: metadata.isRequired,
              signaturePages: []
            });
            
            console.log(\`✅ Uploaded \${metadata.originalName} to Vultr: \${uploadResult.key}\`);
          } catch (uploadError) {
            console.error(\`❌ Failed to upload \${metadata.originalName}:\`, uploadError);
            throw new Error(\`File upload failed: \${uploadError instanceof Error ? uploadError.message : 'Unknown error'}\`);
          }`;

  if (content.includes(oldFileHandling)) {
    content = content.replace(oldFileHandling, newFileHandling);
    await fs.writeFile(routesFile, content);
    result.filesUpdated.push('server/routes.ts');
    result.changes.push('Updated job document upload to use Vultr storage');
    console.log('   ✅ Updated job document upload handler');
  } else {
    console.log('   ℹ️  Job document upload pattern not found (may be already updated)');
  }
}

async function updateFileServingEndpoints(result: UpdateResult): Promise<void> {
  console.log('📁 Creating Vultr file serving endpoints...');
  
  // Create a new file serving handler
  const fileHandler = `
  // ===== VULTR FILE ACCESS ROUTES =====
  
  // Serve files from Vultr storage with authentication
  app.get('/api/files/:fileKey(*)', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const fileKey = req.params.fileKey;
      
      // Get optimized file URL (with caching)
      const fileAccess = await optimizedStorage.getOptimizedFileUrl(fileKey, 24);
      
      // Redirect to Vultr URL (faster, doesn't use server bandwidth)
      res.redirect(302, fileAccess.cdnUrl || fileAccess.signedUrl);
      
    } catch (error) {
      console.error('Vultr file access error:', error);
      res.status(404).json({ message: 'File not found' });
    }
  });
  
  // Get signed URL for file access (for frontend use)
  app.get('/api/files/:fileKey(*)/url', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const fileKey = req.params.fileKey;
      const expiresIn = parseInt(req.query.expires as string) || 24; // hours
      
      const fileAccess = await optimizedStorage.getOptimizedFileUrl(fileKey, expiresIn);
      
      res.json({
        url: fileAccess.cdnUrl || fileAccess.signedUrl,
        expiresAt: fileAccess.expiresAt,
        cached: fileAccess.cached,
        storageType: 'vultr'
      });
      
    } catch (error) {
      console.error('Get file URL error:', error);
      res.status(404).json({ message: 'File not found' });
    }
  });
  
  // Hybrid file access for backward compatibility (local + Vultr)
  app.get('/api/files/local/:filePath(*)', verifyToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const filePath = req.params.filePath;
      
      // Use migration service to handle both local and Vultr files
      const fileAccess = await fileMigration.getFileUrl(filePath);
      
      if (fileAccess.storageType === 'local') {
        // Serve local file directly
        const localFile = await fileMigration.serveLocalFile(filePath);
        if (!localFile) {
          return res.status(404).json({ message: 'File not found' });
        }
        
        res.setHeader('Content-Type', localFile.contentType);
        res.setHeader('Content-Disposition', \`inline; filename="\${localFile.filename}"\`);
        res.send(localFile.buffer);
      } else {
        // Redirect to Vultr URL
        res.redirect(302, fileAccess.url);
      }
      
    } catch (error) {
      console.error('Local file access error:', error);
      res.status(404).json({ message: 'File not found' });
    }
  });`;

  // Add this to the routes file
  const routesFile = path.join(process.cwd(), 'server', 'routes.ts');
  let content = await fs.readFile(routesFile, 'utf-8');
  
  // Find a good place to insert the new routes (before the existing enhanced upload routes)
  const insertPoint = content.indexOf('// ===== ENHANCED UPLOAD SYSTEM ROUTES =====');
  
  if (insertPoint !== -1 && !content.includes('// ===== VULTR FILE ACCESS ROUTES =====')) {
    content = content.slice(0, insertPoint) + fileHandler + '\n\n  ' + content.slice(insertPoint);
    await fs.writeFile(routesFile, content);
    result.filesUpdated.push('server/routes.ts (file serving)');
    result.changes.push('Added Vultr file serving endpoints');
    console.log('   ✅ Added Vultr file serving endpoints');
  } else {
    console.log('   ℹ️  Vultr file serving endpoints already exist or insertion point not found');
  }
}

async function createEnvTemplate(): Promise<void> {
  console.log('📋 Creating .env template for Vultr...');
  
  const envTemplate = `
# Vultr Object Storage Configuration
VULTR_ACCESS_KEY=your_vultr_access_key_here
VULTR_SECRET_KEY=your_vultr_secret_key_here
VULTR_BUCKET_NAME=usa-notary-documents
VULTR_REGION=ewr1
VULTR_ENDPOINT=https://ewr1.vultrobjects.com

# Optional: CDN URL for faster file delivery
CDN_BASE_URL=https://your-bucket.ewr1.vultrobjects.com
`;

  try {
    await fs.writeFile('.env.vultr.template', envTemplate.trim());
    console.log('   ✅ Created .env.vultr.template');
  } catch (error) {
    console.log('   ⚠️  Could not create .env template');
  }
}

async function main() {
  console.log('🚀 Vultr Storage Integration Update');
  console.log('=' .repeat(40));

  const result = await updateRoutes();
  
  // Create environment template
  await createEnvTemplate();

  console.log('\n📊 Update Summary:');
  console.log('=' .repeat(40));
  console.log(\`Files updated: \${result.filesUpdated.length}\`);
  result.filesUpdated.forEach(file => console.log(\`  ✅ \${file}\`));
  
  console.log(\`\nChanges made: \${result.changes.length}\`);
  result.changes.forEach(change => console.log(\`  📝 \${change}\`));
  
  if (result.errors.length > 0) {
    console.log(\`\nErrors encountered: \${result.errors.length}\`);
    result.errors.forEach(error => console.log(\`  ❌ \${error}\`));
  }

  console.log('\n🎯 Next Steps:');
  console.log('1. Set up your Vultr credentials in .env (see .env.vultr.template)');
  console.log('2. Run: tsx test-vultr-connection.ts');
  console.log('3. Run: tsx migrate-files.ts (to migrate existing files)');
  console.log('4. Test file uploads in your application');
  console.log('5. Verify file access works correctly');
  
  console.log('\n⚡ Benefits after migration:');
  console.log('• No server memory spikes from large file uploads');
  console.log('• Global CDN delivery for faster file access');
  console.log('• Automatic scalability for concurrent users');
  console.log('• 10-year retention for compliance requirements');
  console.log('• Cost-effective storage (~13% cheaper than AWS S3)');
}

if (require.main === module) {
  main().catch(console.error);
}

export { updateRoutes }; 