import { db } from '../server/db';
import { editorSessions, sessionParticipantsStatus } from '../shared/schema';
import { eq, desc, like } from 'drizzle-orm';

/**
 * Debug script to investigate session performance issues
 */

async function debugSessionPerformance() {
  console.log('🔍 Debugging session performance...');
  
  try {
    // 1. Check existing sessions
    console.log('\n📊 Checking existing sessions...');
    const recentSessions = await db
      .select({
        id: editorSessions.id,
        sessionId: editorSessions.sessionId,
        jobId: editorSessions.jobId,
        status: editorSessions.status,
        signingState: editorSessions.signingState,
        createdAt: editorSessions.createdAt
      })
      .from(editorSessions)
      .where(like(editorSessions.sessionId, 'live_%'))
      .orderBy(desc(editorSessions.createdAt))
      .limit(10);

    console.log(`Found ${recentSessions.length} live sessions:`);
    recentSessions.forEach(session => {
      console.log(`  - ${session.sessionId} (Job ${session.jobId}) - ${session.status}/${session.signingState}`);
    });

    // 2. Test session lookup performance
    console.log('\n⏱️ Testing session lookup performance...');
    const testSessionId = 'live_137_1753482758292';
    
    // Direct sessionId lookup
    const directStart = Date.now();
    const directResult = await db
      .select({
        id: editorSessions.id,
        sessionId: editorSessions.sessionId,
        jobId: editorSessions.jobId
      })
      .from(editorSessions)
      .where(eq(editorSessions.sessionId, testSessionId))
      .limit(1);
    const directTime = Date.now() - directStart;
    console.log(`Direct sessionId lookup: ${directTime}ms (found: ${directResult.length})`);

    // Fallback jobId lookup if direct failed
    if (directResult.length === 0) {
      const fallbackStart = Date.now();
      const fallbackResult = await db
        .select({
          id: editorSessions.id,
          sessionId: editorSessions.sessionId,
          jobId: editorSessions.jobId
        })
        .from(editorSessions)
        .where(eq(editorSessions.jobId, 137))
        .orderBy(desc(editorSessions.updatedAt))
        .limit(1);
      const fallbackTime = Date.now() - fallbackStart;
      console.log(`Fallback jobId lookup: ${fallbackTime}ms (found: ${fallbackResult.length})`);
      
      if (fallbackResult.length > 0) {
        console.log(`  Found session: ${fallbackResult[0].sessionId} for job 137`);
      }
    }

    // 3. Test participant lookup
    if (directResult.length > 0) {
      console.log('\n👥 Testing participant lookup...');
      const participantStart = Date.now();
      const participants = await db
        .select()
        .from(sessionParticipantsStatus)
        .where(eq(sessionParticipantsStatus.sessionId, directResult[0].id));
      const participantTime = Date.now() - participantStart;
      console.log(`Participant lookup: ${participantTime}ms (found: ${participants.length})`);
    }

    // 4. Check if session needs to be created
    console.log('\n🆕 Checking if session needs creation...');
    const existingForJob137 = await db
      .select()
      .from(editorSessions)
      .where(eq(editorSessions.jobId, 137))
      .limit(5);
    
    console.log(`Sessions for job 137: ${existingForJob137.length}`);
    existingForJob137.forEach(session => {
      console.log(`  - ${session.sessionId} (${session.status}/${session.signingState}) - ${session.createdAt}`);
    });

    // 5. Check database indexes
    console.log('\n📊 Checking database performance...');
    
    // Simple count query to test general DB performance
    const countStart = Date.now();
    const sessionCount = await db.$count(editorSessions);
    const countTime = Date.now() - countStart;
    console.log(`Total sessions count: ${sessionCount} (took: ${countTime}ms)`);
    
    if (countTime > 100) {
      console.log('⚠️ Database appears to be slow - consider connection pooling optimization');
    }

    console.log('\n✅ Session performance debug completed');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the debug
debugSessionPerformance(); 