#!/usr/bin/env tsx

/**
 * Vultr Storage Migration Script
 * Migrates all existing files from local storage to Vultr Object Storage
 */
 
import { cloudStorage } from './lib/cloud-storage-service';
import { db } from './db';
import { jobDocuments, users, notaryStamps } from '@shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

interface MigrationResult {
  success: boolean;
  migratedFiles: number;
  failedFiles: number;
  errors: string[];
  sizesMigrated: number; // bytes
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
      // Test Vultr connection first
      await this.testVultrConnection();

      // Migrate different file types
      await this.migrateJobDocuments();
      await this.migrateNotaryStamps();
      await this.migrateNotaryDocuments();
      await this.migrateVideoRecordings();
      await this.migrateSignatureFiles();

      console.log('\n✅ Migration completed successfully!');
      console.log(`📊 Results: ${this.results.migratedFiles} files migrated, ${Math.round(this.results.sizesMigrated / (1024 * 1024))}MB total`);
      
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
      throw new Error('Vultr bucket is not accessible. Check your credentials.');
    }
    
    console.log('✅ Vultr connection verified');
  }

  private async migrateJobDocuments(): Promise<void> {
    console.log('\n📄 Migrating job documents...');
    
    const documents = await db.select().from(jobDocuments);
    
    for (const doc of documents) {
      try {
        if (this.isLocalPath(doc.filePath)) {
          const migrationResult = await this.migrateFile(
            doc.filePath,
            'document',
            `job-${doc.jobId}`,
            doc.uploadedBy || undefined
          );

          if (migrationResult.success) {
            // Update database with new Vultr key
            await db.update(jobDocuments)
              .set({ 
                filePath: migrationResult.vultrKey!,
                // Add metadata to track migration
                // originalPath: doc.filePath 
              })
              .where(eq(jobDocuments.id, doc.id));

            console.log(`✅ Migrated document: ${doc.originalName}`);
            this.results.migratedFiles++;
          }
        }
      } catch (error) {
        console.error(`❌ Failed to migrate document ${doc.id}:`, error);
        this.results.failedFiles++;
        this.results.errors.push(`Document ${doc.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async migrateNotaryStamps(): Promise<void> {
    console.log('\n🛂 Migrating notary stamps...');
    
    const stamps = await db.select().from(notaryStamps);
    
    for (const stamp of stamps) {
      try {
        if (stamp.stampImage && this.isLocalPath(stamp.stampImage)) {
          const migrationResult = await this.migrateFile(
            stamp.stampImage,
            'stamp',
            `notary-${stamp.notaryId}`,
            stamp.notaryId
          );

          if (migrationResult.success) {
            // Update database with new Vultr key
            await db.update(notaryStamps)
              .set({ 
                stampImage: migrationResult.vultrKey!
              })
              .where(eq(notaryStamps.id, stamp.id));

            console.log(`✅ Migrated notary stamp: ${stamp.id}`);
            this.results.migratedFiles++;
          }
        }
      } catch (error) {
        console.error(`❌ Failed to migrate stamp ${stamp.id}:`, error);
        this.results.failedFiles++;
        this.results.errors.push(`Stamp ${stamp.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async migrateNotaryDocuments(): Promise<void> {
    console.log('\n📋 Migrating notary profile documents...');
    
    const uploadsDir = path.join(process.cwd(), 'uploads', 'notary-documents');
    
    try {
      const files = await this.getAllFiles(uploadsDir);
      
      for (const filePath of files) {
        try {
          const relativePath = path.relative(uploadsDir, filePath);
          const fileName = path.basename(filePath);
          
          // Extract user ID from filename pattern (userId-fieldName-timestamp.ext)
          const userIdMatch = fileName.match(/^(\d+)-/);
          const userId = userIdMatch ? parseInt(userIdMatch[1]) : undefined;

          const migrationResult = await this.migrateFileByPath(
            filePath,
            'document',
            `notary-profile-${userId || 'unknown'}`,
            userId
          );

          if (migrationResult.success) {
            console.log(`✅ Migrated notary document: ${fileName}`);
            this.results.migratedFiles++;
          }

        } catch (error) {
          console.error(`❌ Failed to migrate notary document ${filePath}:`, error);
          this.results.failedFiles++;
        }
      }
    } catch (error) {
      console.log('📁 No notary documents directory found, skipping...');
    }
  }

  private async migrateVideoRecordings(): Promise<void> {
    console.log('\n🎥 Migrating video recordings...');
    
    const recordingsDir = path.join(process.cwd(), 'recordings');
    
    try {
      const files = await this.getAllFiles(recordingsDir);
      
      for (const filePath of files) {
        try {
          const fileName = path.basename(filePath);
          const sessionId = fileName.split('-')[0] || 'unknown';

          const migrationResult = await this.migrateFileByPath(
            filePath,
            'document', // Use 'document' for recordings 
            `recording-${sessionId}`,
            undefined
          );

          if (migrationResult.success) {
            console.log(`✅ Migrated recording: ${fileName}`);
            this.results.migratedFiles++;
          }

        } catch (error) {
          console.error(`❌ Failed to migrate recording ${filePath}:`, error);
          this.results.failedFiles++;
        }
      }
    } catch (error) {
      console.log('📁 No recordings directory found, skipping...');
    }
  }

  private async migrateSignatureFiles(): Promise<void> {
    console.log('\n✍️ Migrating signature files...');
    
    const signaturesDir = path.join(process.cwd(), 'uploads', 'signatures');
    
    try {
      const files = await this.getAllFiles(signaturesDir);
      
      for (const filePath of files) {
        try {
          const fileName = path.basename(filePath);
          const sessionId = fileName.split('-')[0] || 'unknown';

          const migrationResult = await this.migrateFileByPath(
            filePath,
            'signature',
            `signatures-${sessionId}`,
            undefined
          );

          if (migrationResult.success) {
            console.log(`✅ Migrated signature: ${fileName}`);
            this.results.migratedFiles++;
          }

        } catch (error) {
          console.error(`❌ Failed to migrate signature ${filePath}:`, error);
          this.results.failedFiles++;
        }
      }
    } catch (error) {
      console.log('📁 No signatures directory found, skipping...');
    }
  }

  private async migrateFile(
    localPath: string,
    uploadType: 'document' | 'signature' | 'stamp',
    sessionId: string,
    userId?: number
  ): Promise<{
    success: boolean;
    vultrKey?: string;
    vultrUrl?: string;
    error?: string;
  }> {
    const fullPath = path.join(process.cwd(), 'uploads', localPath);
    return this.migrateFileByPath(fullPath, uploadType, sessionId, userId);
  }

  private async migrateFileByPath(
    fullPath: string,
    uploadType: 'document' | 'signature' | 'stamp',
    sessionId: string,
    userId?: number
  ): Promise<{
    success: boolean;
    vultrKey?: string;
    vultrUrl?: string;
    error?: string;
  }> {
    try {
      // Check if file exists
      await fs.access(fullPath);
      
      // Read file
      const fileBuffer = await fs.readFile(fullPath);
      const fileName = path.basename(fullPath);
      
      // Upload to Vultr
      const fileKey = cloudStorage.generateFileKey(uploadType, sessionId, fileName, userId);
      const uploadResult = await cloudStorage.uploadFile(fileBuffer, fileKey, {
        contentType: this.getContentType(fileName),
        metadata: {
          originalFilename: fileName,
          migratedFrom: fullPath,
          migratedAt: new Date().toISOString(),
          sessionId,
          userId: userId?.toString() || '',
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
      // Directory doesn't exist or is not accessible
    }
    
    return files;
  }

  private isLocalPath(filePath: string): boolean {
    // Check if it's a local file path (not a Vultr key)
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
      '.avi': 'video/avi',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    
    return contentTypes[ext] || 'application/octet-stream';
  }
}

// CLI interface for running migration
async function runMigration() {
  console.log('🔄 USA Notary Platform - Vultr Storage Migration');
  console.log('=' .repeat(50));

  const migration = new VultrMigration();
  const result = await migration.migrateAllFiles();

  if (result.success) {
    console.log('\n🎉 Migration completed successfully!');
    console.log(`📊 Files migrated: ${result.migratedFiles}`);
    console.log(`📏 Total size: ${Math.round(result.sizesMigrated / (1024 * 1024))}MB`);
    
    if (result.failedFiles > 0) {
      console.log(`⚠️  Failed files: ${result.failedFiles}`);
      console.log('Errors:', result.errors);
    }
  } else {
    console.log('\n❌ Migration failed!');
    console.log('Errors:', result.errors);
    process.exit(1);
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration().catch(console.error);
}

export { VultrMigration }; 