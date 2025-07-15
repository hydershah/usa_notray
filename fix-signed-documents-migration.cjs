const { db } = require('./server/db');
const { eq, like } = require('drizzle-orm');
const { jobDocuments, documentVersions, jobs } = require('./shared/schema');

async function migrateSignedDocuments() {
  console.log('🔄 Starting migration of signed documents...');

  try {
    // Find all documents with documentType 'signed_document' or filename patterns indicating signed docs
    const signedDocs = await db
      .select()
      .from(jobDocuments)
      .where(eq(jobDocuments.documentType, 'signed_document'));

    console.log(`📄 Found ${signedDocs.length} signed documents to migrate`);

    if (signedDocs.length === 0) {
      console.log('✅ No signed documents found to migrate');
      return;
    }

    let migratedCount = 0;
    let errorCount = 0;

    for (const doc of signedDocs) {
      try {
        console.log(`🔄 Migrating: ${doc.fileName} (Job ID: ${doc.jobId})`);

        // Check if this document version already exists
        const existingVersion = await db
          .select()
          .from(documentVersions)
          .where(eq(documentVersions.fileName, doc.fileName))
          .limit(1);

        if (existingVersion.length > 0) {
          console.log(`⚠️  Document version already exists for ${doc.fileName}, skipping...`);
          continue;
        }

        // Create document version record
        const [documentVersion] = await db.insert(documentVersions).values({
          originalDocumentId: doc.jobId,
          sessionId: 1, // Default session ID since we don't know the exact session
          versionNumber: 1,
          fileName: doc.fileName,
          filePath: doc.filePath,
          fileSize: doc.fileSize,
          status: 'completed',
          digitalCertificateApplied: false,
          createdAt: doc.createdAt
        }).returning();

        // Update job to reference the signed document
        await db
          .update(jobs)
          .set({ signedDocumentId: documentVersion.id })
          .where(eq(jobs.id, doc.jobId));

        // Remove from jobDocuments table
        await db
          .delete(jobDocuments)
          .where(eq(jobDocuments.id, doc.id));

        console.log(`✅ Migrated: ${doc.fileName} → Document Version ID: ${documentVersion.id}`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Failed to migrate ${doc.fileName}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`  ✅ Successfully migrated: ${migratedCount} documents`);
    console.log(`  ❌ Failed migrations: ${errorCount} documents`);
    console.log(`  📄 Total processed: ${signedDocs.length} documents`);

    if (migratedCount > 0) {
      console.log('\n🎉 Migration completed! Signed documents should now appear in the "Completed Documents" section.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateSignedDocuments().then(() => {
  console.log('✅ Migration script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Migration script failed:', error);
  process.exit(1);
}); 