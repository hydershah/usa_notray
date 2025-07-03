#!/usr/bin/env tsx

import { cloudStorage } from './server/lib/cloud-storage-service';
import { db } from './server/db';
import { jobDocuments, notaryStamps } from '@shared/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

async function migrateToVultr() {
  console.log('🚀 Starting Vultr Storage Migration...');
  
  // Test Vultr connection
  const stats = await cloudStorage.getBucketStats();
  if (!stats.isAccessible) {
    throw new Error('Vultr not accessible');
  }
  console.log('✅ Vultr connection verified');
  
  let migrated = 0;
  
  // Migrate job documents
  const documents = await db.select().from(jobDocuments);
  for (const doc of documents) {
    if (doc.filePath && !doc.filePath.includes('vultrobjects.com')) {
      try {
        const fullPath = path.join(process.cwd(), 'uploads', doc.filePath);
        const fileBuffer = await fs.readFile(fullPath);
        
        const fileKey = cloudStorage.generateFileKey('document', `job-${doc.jobId}`, doc.originalName, doc.uploadedBy || undefined);
        await cloudStorage.uploadFile(fileBuffer, fileKey, {
          contentType: 'application/pdf',
          metadata: { originalFilename: doc.originalName }
        });
        
        await db.update(jobDocuments)
          .set({ filePath: fileKey })
          .where(eq(jobDocuments.id, doc.id));
          
        console.log(`✅ Migrated: ${doc.originalName}`);
        migrated++;
      } catch (error) {
        console.log(`❌ Failed: ${doc.originalName}`, error);
      }
    }
  }
  
  console.log(`🎉 Migration complete! Migrated ${migrated} files`);
}

migrateToVultr().catch(console.error); 