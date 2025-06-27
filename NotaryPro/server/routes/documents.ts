// Save signed document
router.post('/documents/:id/signed', authenticate, upload.single('signedPdf'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get the original document
    const documents = await db
      .select()
      .from(tables.documents)
      .where(eq(tables.documents.id, parseInt(id)))
      .limit(1);

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];

    // Check if user has permission to sign this document
    const jobs = await db
      .select()
      .from(tables.jobs)
      .where(eq(tables.jobs.id, document.jobId))
      .limit(1);

    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobs[0];

    // Check if user is a participant in this job
    const participants = await db
      .select()
      .from(tables.jobParticipants)
      .where(
        and(
          eq(tables.jobParticipants.jobId, job.id),
          eq(tables.jobParticipants.userId, userId)
        )
      )
      .limit(1);

    if (participants.length === 0 && job.notaryId !== userId) {
      return res.status(403).json({ error: 'You do not have permission to sign this document' });
    }

    // Save the signed document
    const signedFilename = `signed_${Date.now()}_${document.filename}`;
    const signedFilepath = path.join(process.cwd(), 'uploads', 'documents', signedFilename);
    
    await fs.writeFile(signedFilepath, file.buffer);

    // Update document record with signed version
    await db
      .update(tables.documents)
      .set({
        signedFilename,
        signedAt: new Date(),
        status: 'signed'
      })
      .where(eq(tables.documents.id, parseInt(id)));

    // Check if all documents in the job are signed
    const allDocuments = await db
      .select()
      .from(tables.documents)
      .where(eq(tables.documents.jobId, job.id));

    const allSigned = allDocuments.every(doc => doc.status === 'signed');

    if (allSigned) {
      // Update job status to completed
      await db
        .update(tables.jobs)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(tables.jobs.id, job.id));
    }

    res.json({
      success: true,
      document: {
        ...document,
        signedFilename,
        signedAt: new Date(),
        status: 'signed'
      }
    });

  } catch (error) {
    console.error('Error saving signed document:', error);
    res.status(500).json({ error: 'Failed to save signed document' });
  }
});

// Get signed document
router.get('/documents/:id/signed', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Get the document
    const documents = await db
      .select()
      .from(tables.documents)
      .where(eq(tables.documents.id, parseInt(id)))
      .limit(1);

    if (documents.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const document = documents[0];

    if (!document.signedFilename) {
      return res.status(404).json({ error: 'Document has not been signed yet' });
    }

    // Check permissions
    const jobs = await db
      .select()
      .from(tables.jobs)
      .where(eq(tables.jobs.id, document.jobId))
      .limit(1);

    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobs[0];

    // Check if user has access
    const participants = await db
      .select()
      .from(tables.jobParticipants)
      .where(
        and(
          eq(tables.jobParticipants.jobId, job.id),
          eq(tables.jobParticipants.userId, userId)
        )
      )
      .limit(1);

    if (participants.length === 0 && job.notaryId !== userId && userId !== job.signerId) {
      return res.status(403).json({ error: 'You do not have permission to view this document' });
    }

    // Send the signed document
    const signedPath = path.join(process.cwd(), 'uploads', 'documents', document.signedFilename);
    
    if (!await fs.access(signedPath).then(() => true).catch(() => false)) {
      return res.status(404).json({ error: 'Signed document file not found' });
    }

    res.sendFile(signedPath);

  } catch (error) {
    console.error('Error retrieving signed document:', error);
    res.status(500).json({ error: 'Failed to retrieve signed document' });
  }
}); 