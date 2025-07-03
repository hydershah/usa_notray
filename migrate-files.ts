#!/usr/bin/env tsx

/**
 * Simple Vultr Migration Script
 * Migrates all local files to Vultr Object Storage
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs/promises';
import path from 'path';

// Initialize Vultr S3 client
const region = process.env.VULTR_REGION || 'ewr1';
const bucketName = process.env.VULTR_BUCKET_NAME || 'usa-notary-documents';

const s3Client = new S3Client({
  region: region,
  endpoint: `https://${region}.vultrobjects.com`,
  credentials: {
    accessKeyId: process.env.VULTR_ACCESS_KEY || '',
    secretAccessKey: process.env.VULTR_SECRET_KEY || '',
  },
  forcePathStyle: false,
});

interface MigrationStats {
  totalFiles: number;
  migratedFiles: number;
  failedFiles: number;
  totalSize: number;
  errors: string[];
}

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        const subFiles = await getAllFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Directory doesn't exist or not accessible
  }
  
  return files;
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.avi': 'video/avi',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

function generateFileKey(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath);
  const fileName = path.basename(filePath);
  const dir = path.dirname(relativePath);
  
  // Create organized structure in Vultr
  const date = new Date().toISOString().split('T')[0];
  const randomId = Math.random().toString(36).substring(2, 8);
  
  return `migrated/${date}/${dir}/${randomId}_${fileName}`.replace(/\\/g, '/');
}

async function migrateFile(filePath: string): Promise<{ success: boolean; size?: number; error?: string; vultrKey?: string }> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    const fileKey = generateFileKey(filePath);
    
    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: getContentType(fileName),
      Metadata: {
        originalPath: filePath,
        migratedAt: new Date().toISOString(),
        originalName: fileName,
      },
      ServerSideEncryption: 'AES256',
    });

    await s3Client.send(uploadCommand);
    
    return {
      success: true,
      size: fileBuffer.length,
      vultrKey: fileKey
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function migrateAllFiles(): Promise<MigrationStats> {
  console.log('🚀 Starting Vultr Storage Migration...\n');

  const stats: MigrationStats = {
    totalFiles: 0,
    migratedFiles: 0,
    failedFiles: 0,
    totalSize: 0,
    errors: []
  };

  // Test Vultr connection first
  try {
    const testContent = Buffer.from('test');
    const testCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: 'test-connection.txt',
      Body: testContent,
      ContentType: 'text/plain',
    });
    
    await s3Client.send(testCommand);
    console.log('✅ Vultr connection verified\n');
  } catch (error) {
    console.error('❌ Vultr connection failed:', error);
    throw new Error('Cannot connect to Vultr. Check your credentials.');
  }

  // Directories to migrate
  const directories = ['uploads', 'recordings', 'temp'];

  for (const dir of directories) {
    const fullDirPath = path.join(process.cwd(), dir);
    console.log(`📁 Processing directory: ${dir}`);
    
    const files = await getAllFiles(fullDirPath);
    stats.totalFiles += files.length;
    
    if (files.length === 0) {
      console.log(`   📭 No files found in ${dir}\n`);
      continue;
    }

    console.log(`   📋 Found ${files.length} files`);

    for (const filePath of files) {
      const fileName = path.basename(filePath);
      
      try {
        const result = await migrateFile(filePath);
        
        if (result.success) {
          stats.migratedFiles++;
          stats.totalSize += result.size || 0;
          console.log(`   ✅ ${fileName} → ${result.vultrKey}`);
        } else {
          stats.failedFiles++;
          stats.errors.push(`${fileName}: ${result.error}`);
          console.log(`   ❌ ${fileName}: ${result.error}`);
        }
        
      } catch (error) {
        stats.failedFiles++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`${fileName}: ${errorMsg}`);
        console.log(`   ❌ ${fileName}: ${errorMsg}`);
      }
    }
    
    console.log('');
  }

  return stats;
}

async function main() {
  try {
    // Check environment variables
    if (!process.env.VULTR_ACCESS_KEY || !process.env.VULTR_SECRET_KEY) {
      console.log('❌ Missing Vultr credentials in environment variables');
      console.log('Required: VULTR_ACCESS_KEY, VULTR_SECRET_KEY, VULTR_BUCKET_NAME, VULTR_REGION');
      process.exit(1);
    }

    const stats = await migrateAllFiles();

    console.log('🎉 Migration Summary');
    console.log('=' .repeat(50));
    console.log(`📊 Total files processed: ${stats.totalFiles}`);
    console.log(`✅ Successfully migrated: ${stats.migratedFiles}`);
    console.log(`❌ Failed migrations: ${stats.failedFiles}`);
    console.log(`📏 Total size migrated: ${Math.round(stats.totalSize / (1024 * 1024))}MB`);

    if (stats.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      stats.errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }

    console.log('\n🔗 Next Steps:');
    console.log('1. Update your application code to use Vultr URLs');
    console.log('2. Test file access from the application');
    console.log('3. Consider cleanup of local files after verification');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { migrateAllFiles }; 