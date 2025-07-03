#!/usr/bin/env tsx

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from './server/db';
import { jobDocuments, notaryStamps, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const region = process.env.VULTR_REGION || 'ewr1';
const bucketName = process.env.VULTR_BUCKET_NAME || 'usanotary';

const s3Client = new S3Client({
  region: region,
  endpoint: process.env.VULTR_ENDPOINT || `https://${region}.vultrobjects.com`,
  credentials: {
    accessKeyId: process.env.VULTR_ACCESS_KEY!,
    secretAccessKey: process.env.VULTR_SECRET_KEY!,
  },
  forcePathStyle: false,
});

interface MigrationStats {
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  updatedRecords: number;
  totalSize: number;
  errors: string[];
}

class FileTypeDetector {
  static getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  static determineFileType(filePath: string): 'document' | 'stamp' | 'signature' | 'certificate' {
    if (filePath.includes('/stamps/')) return 'stamp';
    if (filePath.includes('signature')) return 'signature';
    if (filePath.includes('certificate')) return 'certificate';
    return 'document';
  }

  static generateVultrKey(originalPath: string, fileType: string): string {
    const fileName = path.basename(originalPath);
    const timestamp = Date.now();
    const randomId = createHash('sha256')
      .update(`${originalPath}-${timestamp}`)
      .digest('hex')
      .substring(0, 16);
    
    const date = new Date().toISOString().split('T')[0];
    
    // Extract user ID from path if possible
    const userIdMatch = originalPath.match(/stamps\/(\d+)\//);
    const userPrefix = userIdMatch ? `user-${userIdMatch[1]}/` : '';
    
    return `${fileType}/${date}/${userPrefix}migrated/${randomId}_${fileName}`;
  }
}

async function migrateFile(localPath: string): Promise<{
  success: boolean;
  vultrKey?: string;
  vultrUrl?: string;
  size?: number;
  error?: string;
}> {
  try {
    console.log(`  📤 Migrating: ${localPath}`);
    
    // Read file
    const fileBuffer = await fs.readFile(localPath);
    const fileType = FileTypeDetector.determineFileType(localPath);
    const vultrKey = FileTypeDetector.generateVultrKey(localPath, fileType);
    const contentType = FileTypeDetector.getContentType(localPath);
    
    // Upload to Vultr
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: vultrKey,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: {
        originalPath: localPath,
        migratedAt: new Date().toISOString(),
        originalSize: fileBuffer.length.toString(),
        fileType: fileType,
      },
      ServerSideEncryption: 'AES256',
    });

    await s3Client.send(uploadCommand);
    
    return {
      success: true,
      vultrKey,
      vultrUrl: `https://${bucketName}.${region}.vultrobjects.com/${vultrKey}`,
      size: fileBuffer.length,
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function updateDatabaseRecord(originalPath: string, vultrKey: string): Promise<boolean> {
  try {
    // Update job documents
    const updatedJobDocs = await db
      .update(jobDocuments)
      .set({ filePath: vultrKey })
      .where(eq(jobDocuments.filePath, originalPath))
      .returning();

    if (updatedJobDocs.length > 0) {
      console.log(`    🔄 Updated ${updatedJobDocs.length} job document records`);
      return true;
    }

    // Update notary stamps
    const updatedStamps = await db
      .update(notaryStamps)
      .set({ stampImagePath: vultrKey })
      .where(eq(notaryStamps.stampImagePath, originalPath))
      .returning();

    if (updatedStamps.length > 0) {
      console.log(`    🔄 Updated ${updatedStamps.length} notary stamp records`);
      return true;
    }

    // Update user signature/stamp data (stored as file paths)
    const updatedUsers = await db
      .update(users)
      .set({ 
        signatureData: vultrKey // This might be JSON, need to check
      })
      .where(eq(users.signatureData, originalPath))
      .returning();

    if (updatedUsers.length > 0) {
      console.log(`    🔄 Updated ${updatedUsers.length} user signature records`);
      return true;
    }

    console.log(`    ⚠️  No database records found for: ${originalPath}`);
    return false;

  } catch (error) {
    console.error(`    ❌ Database update failed: ${error}`);
    return false;
  }
}

async function scanDirectory(dirPath: string): Promise<string[]> {
  try {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await scanDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    
    return files;
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
    return [];
  }
}

async function migrateExistingFiles() {
  console.log('🚀 Starting Migration of Existing Files to Vultr Object Storage\n');

  const stats: MigrationStats = {
    totalFiles: 0,
    migratedFiles: 0,
    failedFiles: 0,
    updatedRecords: 0,
    totalSize: 0,
    errors: [],
  };

  try {
    // Scan uploads directory
    const allFiles = await scanDirectory('uploads');
    stats.totalFiles = allFiles.length;

    console.log(`📊 Found ${stats.totalFiles} files to migrate\n`);

    if (stats.totalFiles === 0) {
      console.log('✅ No files to migrate!');
      return;
    }

    // Process each file
    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i];
      const progress = `[${i + 1}/${stats.totalFiles}]`;
      
      console.log(`${progress} Processing: ${filePath}`);
      
      // Migrate file to Vultr
      const migrationResult = await migrateFile(filePath);
      
      if (migrationResult.success && migrationResult.vultrKey) {
        stats.migratedFiles++;
        stats.totalSize += migrationResult.size || 0;
        
        console.log(`    ✅ Uploaded to Vultr: ${migrationResult.vultrKey}`);
        
        // Update database records
        const dbUpdated = await updateDatabaseRecord(filePath, migrationResult.vultrKey);
        if (dbUpdated) {
          stats.updatedRecords++;
        }
        
      } else {
        stats.failedFiles++;
        const error = `Failed to migrate ${filePath}: ${migrationResult.error}`;
        stats.errors.push(error);
        console.log(`    ❌ ${error}`);
      }
      
      console.log(); // Empty line for readability
    }

    // Summary
    console.log('🎉 Migration Complete!');
    console.log('─'.repeat(60));
    console.log(`📊 Total Files: ${stats.totalFiles}`);
    console.log(`✅ Successfully Migrated: ${stats.migratedFiles}`);
    console.log(`❌ Failed: ${stats.failedFiles}`);
    console.log(`🔄 Database Records Updated: ${stats.updatedRecords}`);
    console.log(`💾 Total Data Migrated: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('─'.repeat(60));

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (stats.migratedFiles > 0) {
      console.log('\n🚀 Next Steps:');
      console.log('1. Restart your server to ensure Vultr configuration is active');
      console.log('2. Test file uploads - they should go directly to Vultr');
      console.log('3. Verify file downloads work from both local and Vultr');
      console.log('4. Consider removing local files after confirming everything works');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
migrateExistingFiles(); 