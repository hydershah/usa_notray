import { db } from '../server/db';
import { editorSessions, documentTags, jobDocuments } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function debugSession(sessionId: string) {
  console.log(`\n🔎 Debugging session ${sessionId}`);
  const [session] = await db.select().from(editorSessions).where(eq(editorSessions.sessionId, sessionId)).limit(1);
  if (!session) {
    console.log('❌ Session not found');
    process.exit(1);
  }
  console.log('🎯 Session:', { id: session.id, jobId: session.jobId, sessionType: session.sessionType, status: session.status });

  const tags = await db.select().from(documentTags).where(eq(documentTags.sessionId, session.id));
  console.log(`🏷️ Tags (${tags.length}):`);
  for (const t of tags) {
    console.log(`  - id=${t.id} docId=${t.documentId} type=${t.tagType} page=${t.pageNumber} completed=${t.isCompleted} contentPreview=${(t.content||'').toString().slice(0,40)}`);
  }

  if (session.jobId) {
    const docs = await db.select().from(jobDocuments).where(eq(jobDocuments.jobId, session.jobId));
    console.log(`📄 Job documents (${docs.length}) for job ${session.jobId}:`);
    for (const d of docs) {
      console.log(`  - id=${d.id} type=${d.documentType} name=${d.fileName} path=${d.filePath}`);
    }
  }
}

const sessionId = process.argv[2] || 'SwA5UyPihS-L';

debugSession(sessionId).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});


