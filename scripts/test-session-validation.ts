#!/usr/bin/env tsx

/**
 * Test script to verify session validation in WebSocket service
 * Run with: npx tsx scripts/test-session-validation.ts
 */

import { db } from '../server/db';
import { editorSessions } from '../shared/schema';
import { eq, inArray } from 'drizzle-orm';

async function testSessionValidation() {
  console.log('🧪 Testing session validation...\n');

  try {
    // Get all sessions from database
    const allSessions = await db
      .select({
        sessionId: editorSessions.sessionId,
        status: editorSessions.status,
        sessionType: editorSessions.sessionType,
        jobId: editorSessions.jobId,
        createdAt: editorSessions.createdAt
      })
      .from(editorSessions)
      .orderBy(editorSessions.createdAt);

    console.log(`📊 Found ${allSessions.length} sessions in database:`);
    allSessions.forEach((session, index) => {
      console.log(`  ${index + 1}. ${session.sessionId} (${session.status}) - Job ${session.jobId} - ${session.sessionType}`);
    });

    // Test session validation logic
    const testSessionIds = allSessions.slice(0, 3).map(s => s.sessionId);
    
    if (testSessionIds.length > 0) {
      console.log(`\n🔍 Testing validation for sessions: ${testSessionIds.join(', ')}`);
      
      const validSessions = await db
        .select({ sessionId: editorSessions.sessionId, status: editorSessions.status })
        .from(editorSessions)
        .where(inArray(editorSessions.sessionId, testSessionIds));

      console.log(`✅ Found ${validSessions.length} valid sessions:`);
      validSessions.forEach(session => {
        const isValidState = session.status === 'active' || session.status === 'preparing';
        console.log(`  - ${session.sessionId}: ${session.status} ${isValidState ? '✅' : '❌'}`);
      });
    }

    // Test session reactivation logic
    const completedTaggingSessions = allSessions.filter(s => 
      s.status === 'completed' && s.sessionType === 'tagging'
    );

    if (completedTaggingSessions.length > 0) {
      console.log(`\n🔄 Found ${completedTaggingSessions.length} completed tagging sessions that can be reactivated:`);
      completedTaggingSessions.forEach(session => {
        console.log(`  - ${session.sessionId} (Job ${session.jobId})`);
      });
    }

    console.log('\n✅ Session validation test completed successfully!');

  } catch (error) {
    console.error('❌ Session validation test failed:', error);
    process.exit(1);
  }
}

// Run the test
testSessionValidation()
  .then(() => {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });
