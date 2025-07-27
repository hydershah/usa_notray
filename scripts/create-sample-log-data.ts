import { db } from '../server/db';
import { notaryLogEntries, auditTrail, editorSessions, users, jobs, jobDocuments } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function createSampleLogData() {
  console.log('🔄 Creating sample log data...');

  try {
    // Get existing data to work with
    const [user] = await db.select().from(users).where(eq(users.id, 1)).limit(1);
    const [job] = await db.select().from(jobs).limit(1);
    const [document] = await db.select().from(jobDocuments).limit(1);
    const [session] = await db.select().from(editorSessions).limit(1);

    if (!user || !job || !document || !session) {
      console.log('⚠️ Missing required data (user, job, document, or session). Creating basic records first...');
      
      // Create a basic job if none exists
      if (!job) {
        const [newJob] = await db.insert(jobs).values({
          titleCompany: 'Sample Title Company',
          closingType: 'Purchase',
          propertyAddressOne: '123 Main St',
          propertyCity: 'Sample City',
          propertyState: 'CA',
          propertyZipCode: '12345',
          userId: 1,
          jobStatus: 'completed',
          completedAt: new Date(),
        }).returning();
        console.log('✅ Created sample job:', newJob.id);
      }

      // Create a basic document if none exists
      if (!document) {
        const jobId = job?.id || (await db.select().from(jobs).limit(1))[0].id;
        const [newDocument] = await db.insert(jobDocuments).values({
          jobId: jobId,
          fileName: 'sample-document.pdf',
          filePath: '/uploads/sample-document.pdf',
          fileSize: 1024000,
          uploadedBy: 1,
        }).returning();
        console.log('✅ Created sample document:', newDocument.id);
      }

      // Create a basic session if none exists
      if (!session) {
        const jobId = job?.id || (await db.select().from(jobs).limit(1))[0].id;
        const [newSession] = await db.insert(editorSessions).values({
          jobId: jobId,
          sessionId: 'sample-session-' + Date.now(),
          notaryId: 1,
          status: 'completed',
          completedAt: new Date(),
        }).returning();
        console.log('✅ Created sample session:', newSession.id);
      }

      // Refresh data
      const [updatedJob] = await db.select().from(jobs).limit(1);
      const [updatedDocument] = await db.select().from(jobDocuments).limit(1);
      const [updatedSession] = await db.select().from(editorSessions).limit(1);
      
      // Use updated data
      const finalJob = updatedJob;
      const finalDocument = updatedDocument;
      const finalSession = updatedSession;
    }

    // Get fresh data
    const [finalJob] = await db.select().from(jobs).limit(1);
    const [finalDocument] = await db.select().from(jobDocuments).limit(1);
    const [finalSession] = await db.select().from(editorSessions).limit(1);

    if (!finalJob || !finalDocument || !finalSession) {
      throw new Error('Failed to create or find required data');
    }

    // Clear existing sample data first
    await db.delete(notaryLogEntries);
    await db.delete(auditTrail);
    console.log('🗑️ Cleared existing log data');

    // Create sample notary log entries
    const sampleNotaryLogs = [
      {
        sessionId: finalSession.id,
        notaryId: 1,
        signerId: 1, // Same user for demo
        documentId: finalDocument.id,
        notarizationType: 'jurat',
        pageNumber: 1,
        timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      },
      {
        sessionId: finalSession.id,
        notaryId: 1,
        signerId: 1,
        documentId: finalDocument.id,
        notarizationType: 'acknowledgment',
        pageNumber: 2,
        timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
      },
      {
        sessionId: finalSession.id,
        notaryId: 1,
        signerId: 1,
        documentId: finalDocument.id,
        notarizationType: 'copy_certification',
        pageNumber: 3,
        timestamp: new Date(Date.now() - 900000), // 15 minutes ago
      },
    ];

    const insertedNotaryLogs = await db.insert(notaryLogEntries).values(sampleNotaryLogs).returning();
    console.log('✅ Created notary log entries:', insertedNotaryLogs.length);

    // Create sample audit trail entries
    const sampleAuditEntries = [
      {
        sessionId: finalSession.id,
        userId: 1,
        action: 'session_started',
        details: { message: 'Notarization session started' },
        timestamp: new Date(Date.now() - 4200000), // 70 minutes ago
      },
      {
        sessionId: finalSession.id,
        userId: 1,
        action: 'document_opened',
        details: { documentName: finalDocument.fileName },
        documentId: finalDocument.id,
        timestamp: new Date(Date.now() - 3900000), // 65 minutes ago
      },
      {
        sessionId: finalSession.id,
        userId: 1,
        action: 'signature_placed',
        details: { pageNumber: 1, signatureType: 'digital' },
        documentId: finalDocument.id,
        pageNumber: 1,
        timestamp: new Date(Date.now() - 3600000), // 60 minutes ago
      },
      {
        sessionId: finalSession.id,
        userId: 1,
        action: 'seal_placed',
        details: { pageNumber: 1, sealType: 'notary_seal' },
        documentId: finalDocument.id,
        pageNumber: 1,
        timestamp: new Date(Date.now() - 3300000), // 55 minutes ago
      },
      {
        sessionId: finalSession.id,
        userId: 1,
        action: 'document_saved',
        details: { version: 'final', documentName: finalDocument.fileName },
        documentId: finalDocument.id,
        timestamp: new Date(Date.now() - 1200000), // 20 minutes ago
      },
      {
        sessionId: finalSession.id,
        userId: 1,
        action: 'session_completed',
        details: { duration: '45 minutes', documentsProcessed: 1 },
        timestamp: new Date(Date.now() - 600000), // 10 minutes ago
      },
    ];

    const insertedAuditEntries = await db.insert(auditTrail).values(sampleAuditEntries).returning();
    console.log('✅ Created audit trail entries:', insertedAuditEntries.length);

    console.log('🎉 Sample log data created successfully!');
    console.log('📋 Summary:');
    console.log(`   - Notary Log Entries: ${insertedNotaryLogs.length}`);
    console.log(`   - Audit Trail Entries: ${insertedAuditEntries.length}`);
    console.log(`   - Using Session ID: ${finalSession.id}`);
    console.log(`   - Using Document ID: ${finalDocument.id}`);
    console.log(`   - Using Job ID: ${finalJob.id}`);

  } catch (error) {
    console.error('❌ Error creating sample log data:', error);
    process.exit(1);
  }
}

// Run the script
createSampleLogData()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }); 