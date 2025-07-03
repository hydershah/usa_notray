#!/usr/bin/env tsx

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from './server/db';
import { jobDocuments } from '@shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface MigrationResult {
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  updatedRecords: number;
  totalSizeMB: number;
}

const region = process.env.VULTR_REGION || 'ewr1';
const bucketName = process.env.VULTR_BUCKET_NAME || 'usanotary';

console.log('🚀 Fixed Migration to Vultr Object Storage');
console.log('──────────────────────────────────────────');
console.log(`📦 Bucket: ${bucketName}`);
console.log(`🌍 Region: ${region}`);
console.log(`🔑 Access Key: ${process.env.VULTR_ACCESS_KEY?.slice(0, 8)}...`);
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

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const types: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return types[ext] || 'application/octet-stream';
}

function generateVultrKey(originalPath: string): string {
  const fileName = path.basename(originalPath);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  
  // Determine file type from path
  let fileType = 'document';
  if (originalPath.includes('/stamps/')) fileType = 'stamp';
  if (originalPath.includes('signature')) fileType = 'signature';
  
  const date = new Date().toISOString().split('T')[0];
  
  return `${fileType}/${date}/migrated/${timestamp}_${randomId}_${fileName}`;
}

async function uploadFileToVultr(localPath: string): Promise<{ success: boolean; vultrKey?: string; error?: string }> {
  try {
    // Read file
    const fileBuffer = await fs.readFile(localPath);
    const vultrKey = generateVultrKey(localPath);
    const contentType = getContentType(localPath);
    
    // Upload to Vultr
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: vultrKey,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        originalPath: localPath,
        migratedAt: new Date().toISOString(),
        fileSize: fileBuffer.length.toString(),
      },
    });
    
    await s3Client.send(uploadCommand);
    
    return { success: true, vultrKey };
    
  } catch (error: any) {
    return { 
      success: false, 
      error: `${error.name}: ${error.message}` 
    };
  }
}

async function updateDatabaseRecord(originalPath: string, vultrKey: string): Promise<boolean> {
  try {
    // Try to update job documents table
    const updated = await db
      .update(jobDocuments)
      .set({ filePath: vultrKey })
      .where(eq(jobDocuments.filePath, originalPath))
      .returning();
    
    return updated.length > 0;
  } catch (error) {
    console.log(`    ⚠️  Database update failed: ${error}`);
    return false;
  }
}

async function getAllFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not read directory ${dirPath}: ${error}`);
  }
  
  return files;
}

async function migrateFiles() {
  const result: MigrationResult = {
    totalFiles: 0,
    migratedFiles: 0,
    failedFiles: 0,
    updatedRecords: 0,
    totalSizeMB: 0,
  };
  
  try {
    // Get all files to migrate
    const allFiles = await getAllFiles('uploads');
    result.totalFiles = allFiles.length;
    
    console.log(`📊 Found ${result.totalFiles} files to migrate\n`);
    
    if (result.totalFiles === 0) {
      console.log('✅ No files to migrate!');
      return;
    }
    
    // Process files one by one
    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i];
      const progress = `[${i + 1}/${result.totalFiles}]`;
      
      console.log(`${progress} ${path.basename(filePath)}`);
      
      try {
        // Get file size for tracking
        const stats = await fs.stat(filePath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        // Upload to Vultr
        const uploadResult = await uploadFileToVultr(filePath);
        
        if (uploadResult.success && uploadResult.vultrKey) {
          result.migratedFiles++;
          result.totalSizeMB += fileSizeMB;
          
          console.log(`  ✅ → Vultr: ${uploadResult.vultrKey.split('/').pop()}`);
          
          // Update database
          const dbUpdated = await updateDatabaseRecord(filePath, uploadResult.vultrKey);
          if (dbUpdated) {
            result.updatedRecords++;
            console.log(`  🔄 Database updated`);
          }
          
        } else {
          result.failedFiles++;
          console.log(`  ❌ Failed: ${uploadResult.error}`);
        }
        
      } catch (error) {
        result.failedFiles++;
        console.log(`  ❌ Error: ${error}`);
      }
      
      // Add a small delay to prevent overwhelming Vultr
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Summary
    console.log('\n🎉 Migration Summary');
    console.log('─'.repeat(40));
    console.log(`📊 Total Files: ${result.totalFiles}`);
    console.log(`✅ Migrated: ${result.migratedFiles}`);
    console.log(`❌ Failed: ${result.failedFiles}`);
    console.log(`🔄 DB Records Updated: ${result.updatedRecords}`);
    console.log(`💾 Data Migrated: ${result.totalSizeMB.toFixed(2)} MB`);
    console.log('─'.repeat(40));
    
    if (result.migratedFiles > 0) {
      console.log('\n🚀 Success! Your files are now in Vultr Object Storage!');
      console.log('\n📋 Next Steps:');
      console.log('1. Restart your server');
      console.log('2. Test new file uploads (they should go to Vultr)');
      console.log('3. Test file downloads/previews');
      console.log('4. Check your Vultr dashboard to see the files');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migrateFiles(); 