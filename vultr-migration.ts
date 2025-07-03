#!/usr/bin/env tsx

/**
 * Vultr Storage Migration Script
 * Migrates all existing files from local storage to Vultr Object Storage
 */

import { cloudStorage } from './server/lib/cloud-storage-service';
import { db } from './server/db';
import { jobDocuments, notaryStamps } from '@shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

interface MigrationResult {
  success: boolean;
  migratedFiles: number;
  failedFiles: number;
  errors: string[];
  sizesMigrated: number;
}

export class VultrMigration {
  private results: MigrationResult = {
    success: true,
    migratedFiles: 0,
    failedFiles: 0,
    errors: [],
    sizesMigrated: 0
  };

  async migrateAllFiles(): Promise<MigrationResult> {
    console.log('🚀 Starting Vultr Storage Migration...\n');

    try {
      await this.testVultrConnection();
      await this.migrateJobDocuments();
      await this.migrateNotaryStamps();
      await this.migrateOtherFiles();

      console.log('\n✅ Migration completed!');
      console.log(`📊 Results: ${this.results.migratedFiles} files migrated`);
      
      return this.results;

    } catch (error) {
      console.error('❌ Migration failed:', error);
      this.results.success = false;
      this.results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return this.results;
    }
  }

  private async testVultrConnection(): Promise<void> {
    console.log('🧪 Testing Vultr connection...');
    const stats = await cloudStorage.getBucketStats();
    if (!stats.isAccessible) {
      throw new Error('Vultr bucket is not accessible');
    }
    console.log('✅ Vultr connection verified');
  }

  private async migrateJobDocuments(): Promise<void> {
    console.log('\n📄 Migrating job documents...');
    
    const documents = await db.select().from(jobDocuments);
    
    for (const doc of documents) {
      try {
        if (this.isLocalPath(doc.filePath)) {
          const result = await this.migrateFile(
            doc.filePath,
            'document',
            `job-${doc.jobId}`,
            doc.uploadedBy || undefined
          );

          if (result.success) {
            await db.update(jobDocuments)
              .set({ filePath: result.vultrKey! })
              .where(eq(jobDocuments.id, doc.id));

            console.log(`✅ Migrated: ${doc.originalName}`);
            this.results.migratedFiles++;
          }
        }
      } catch (error) {
        console.error(`❌ Failed: ${doc.id}`, error);
        this.results.failedFiles++;
      }
    }
  }

  private async migrateNotaryStamps(): Promise<void> {
    console.log('\n🛂 Migrating notary stamps...');
    
    const stamps = await db.select().from(notaryStamps);
    
    for (const stamp of stamps) {
      try {
        if (stamp.stampImage && this.isLocalPath(stamp.stampImage)) {
          const result = await this.migrateFile(
            stamp.stampImage,
            'stamp',
            `notary-${stamp.notaryId}`,
            stamp.notaryId
          );

          if (result.success) {
            await db.update(notaryStamps)
              .set({ stampImage: result.vultrKey! })
              .where(eq(notaryStamps.id, stamp.id));

            console.log(`✅ Migrated stamp: ${stamp.id}`);
            this.results.migratedFiles++;
          }
        }
      } catch (error) {
        console.error(`❌ Failed stamp: ${stamp.id}`, error);
        this.results.failedFiles++;
      }
    }
  }

  private async migrateOtherFiles(): Promise<void> {
    console.log('\n📁 Migrating other files...');
    
    const dirs = ['uploads', 'recordings', 'temp'];
    
    for (const dir of dirs) {
      try {
        const files = await this.getAllFiles(path.join(process.cwd(), dir));
        
        for (const filePath of files) {
          try {
            const fileName = path.basename(filePath);
            const sessionId = `migration-${Date.now()}`;

            const result = await this.migrateFileByPath(
              filePath,
              'document',
              sessionId
            );

            if (result.success) {
              console.log(`✅ Migrated: ${fileName}`);
              this.results.migratedFiles++;
            }
          } catch (error) {
            this.results.failedFiles++;
          }
        }
      } catch (error) {
        console.log(`📁 Directory ${dir} not found, skipping...`);
      }
    }
  }

  private async migrateFile(
    localPath: string,
    uploadType: 'document' | 'signature' | 'stamp',
    sessionId: string,
    userId?: number
  ) {
    const fullPath = path.join(process.cwd(), 'uploads', localPath);
    return this.migrateFileByPath(fullPath, uploadType, sessionId, userId);
  }

  private async migrateFileByPath(
    fullPath: string,
    uploadType: 'document' | 'signature' | 'stamp',
    sessionId: string,
    userId?: number
  ) {
    try {
      await fs.access(fullPath);
      const fileBuffer = await fs.readFile(fullPath);
      const fileName = path.basename(fullPath);
      
      const fileKey = cloudStorage.generateFileKey(uploadType, sessionId, fileName, userId);
      const uploadResult = await cloudStorage.uploadFile(fileBuffer, fileKey, {
        contentType: this.getContentType(fileName),
        metadata: {
          originalFilename: fileName,
          migratedFrom: fullPath,
          migratedAt: new Date().toISOString(),
        }
      });

      this.results.sizesMigrated += fileBuffer.length;

      return {
        success: true,
        vultrKey: fileKey,
        vultrUrl: uploadResult.url,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Migration failed',
      };
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        
        if (item.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist
    }
    
    return files;
  }

  private isLocalPath(filePath: string): boolean {
    return !filePath.includes('vultrobjects.com') && 
           !filePath.startsWith('document/') && 
           !filePath.startsWith('signature/') && 
           !filePath.startsWith('stamp/');
  }

  private getContentType(filename: string): string {
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
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

async function runMigration() {
  console.log('🔄 USA Notary Platform - Vultr Storage Migration');
  console.log('='.repeat(50));

  const migration = new VultrMigration();
  const result = await migration.migrateAllFiles();

  if (result.success) {
    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Files migrated: ${result.migratedFiles}`);
    console.log(`📏 Total size: ${Math.round(result.sizesMigrated / (1024 * 1024))}MB`);
  } else {
    console.log('\n❌ Migration failed!');
    console.log('Errors:', result.errors);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration().catch(console.error);
}

export { VultrMigration }; 