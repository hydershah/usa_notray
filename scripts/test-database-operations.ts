#!/usr/bin/env npx tsx

/**
 * Test script to verify database operations issues
 * Tests the specific database-related TypeScript errors
 */

import { config } from 'dotenv';
import { db } from '../server/db.js';
import { users, jobs, jobDocuments, jobParticipants } from '../shared/schema.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

config();

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  message: string;
  details?: any;
  duration?: number;
}

const results: TestResult[] = [];

async function testUserInsertion() {
  const startTime = Date.now();
  console.log('👤 Testing user insertion...');

  try {
    const testUserData = {
      email: `dbtest-${Date.now()}@example.com`,
      username: `dbtest${Date.now()}`,
      password: await bcrypt.hash('TestPassword123!', 10),
      role: 'client' as const,
      firstName: 'Database',
      lastName: 'Test',
      phoneNumber: '+1234567890',
      isActive: true
    };

    // Test single user insertion
    const [newUser] = await db.insert(users).values(testUserData).returning();

    if (newUser && newUser.id) {
      results.push({
        test: 'Single User Insertion',
        status: 'PASS',
        message: 'User inserted successfully',
        details: { userId: newUser.id, email: newUser.email },
        duration: Date.now() - startTime
      });
      return newUser.id;
    } else {
      results.push({
        test: 'Single User Insertion',
        status: 'FAIL',
        message: 'User insertion returned unexpected result',
        details: { result: newUser },
        duration: Date.now() - startTime
      });
      return null;
    }
  } catch (error) {
    results.push({
      test: 'Single User Insertion',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
      duration: Date.now() - startTime
    });
    return null;
  }
}

async function testBulkUserInsertion() {
  const startTime = Date.now();
  console.log('👥 Testing bulk user insertion...');

  try {
    const bulkUsers = await Promise.all([
      {
        email: `bulk1-${Date.now()}@example.com`,
        username: `bulk1${Date.now()}`,
        password: await bcrypt.hash('BulkTest123!', 10),
        role: 'client' as const,
        firstName: 'Bulk',
        lastName: 'User1',
        isActive: true
      },
      {
        email: `bulk2-${Date.now()}@example.com`,
        username: `bulk2${Date.now()}`,
        password: await bcrypt.hash('BulkTest123!', 10),
        role: 'client' as const,
        firstName: 'Bulk',
        lastName: 'User2',
        isActive: true
      }
    ]);

    // Test bulk insertion - this is where the TypeScript error occurs
    const newUsers = await db.insert(users).values(bulkUsers).returning();

    if (Array.isArray(newUsers) && newUsers.length === 2) {
      results.push({
        test: 'Bulk User Insertion',
        status: 'PASS',
        message: `Successfully inserted ${newUsers.length} users`,
        details: { userIds: newUsers.map(u => u.id) },
        duration: Date.now() - startTime
      });
      return newUsers.map(u => u.id);
    } else {
      results.push({
        test: 'Bulk User Insertion',
        status: 'FAIL',
        message: 'Bulk insertion returned unexpected result type',
        details: { result: newUsers, isArray: Array.isArray(newUsers) },
        duration: Date.now() - startTime
      });
      return [];
    }
  } catch (error) {
    results.push({
      test: 'Bulk User Insertion',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
      duration: Date.now() - startTime
    });
    return [];
  }
}

async function testJobCreation(userId: number) {
  const startTime = Date.now();
  console.log('💼 Testing job creation...');

  try {
    const jobData = {
      userId: userId,
      titleCompany: 'Test Title Company',
      closingType: 'Purchase',
      status: 'pending' as const,
      createdAt: new Date()
    };

    const [newJob] = await db.insert(jobs).values(jobData).returning();

    if (newJob && newJob.id) {
      results.push({
        test: 'Job Creation',
        status: 'PASS',
        message: 'Job created successfully',
        details: { jobId: newJob.id, userId: newJob.userId },
        duration: Date.now() - startTime
      });
      return newJob.id;
    } else {
      results.push({
        test: 'Job Creation',
        status: 'FAIL',
        message: 'Job creation returned unexpected result',
        details: { result: newJob },
        duration: Date.now() - startTime
      });
      return null;
    }
  } catch (error) {
    results.push({
      test: 'Job Creation',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
      duration: Date.now() - startTime
    });
    return null;
  }
}

async function testJobParticipantCreation(jobId: number, userIds: number[]) {
  const startTime = Date.now();
  console.log('👨‍👩‍👧‍👦 Testing job participant creation...');

  try {
    const participantData = userIds.map(userId => ({
      jobId: jobId,
      userId: userId,
      role: 'signer' as const,
      invitationToken: `token-${Date.now()}-${userId}`,
      invitationStatus: 'pending' as const
    }));

    const newParticipants = await db.insert(jobParticipants).values(participantData).returning();

    if (Array.isArray(newParticipants) && newParticipants.length === userIds.length) {
      results.push({
        test: 'Job Participant Creation',
        status: 'PASS',
        message: `Successfully created ${newParticipants.length} job participants`,
        details: { participantIds: newParticipants.map(p => p.id) },
        duration: Date.now() - startTime
      });
    } else {
      results.push({
        test: 'Job Participant Creation',
        status: 'FAIL',
        message: 'Participant creation returned unexpected result',
        details: { result: newParticipants, expected: userIds.length },
        duration: Date.now() - startTime
      });
    }
  } catch (error) {
    results.push({
      test: 'Job Participant Creation',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
      duration: Date.now() - startTime
    });
  }
}

async function testComplexQuery() {
  const startTime = Date.now();
  console.log('🔍 Testing complex database queries...');

  try {
    // Test a complex query that might reveal type issues
    const result = await db
      .select({
        userId: users.id,
        userEmail: users.email,
        jobId: jobs.id,
        jobTitle: jobs.titleCompany
      })
      .from(users)
      .leftJoin(jobs, eq(jobs.userId, users.id))
      .where(eq(users.isActive, true))
      .limit(10);

    if (Array.isArray(result)) {
      results.push({
        test: 'Complex Query',
        status: 'PASS',
        message: `Query executed successfully, returned ${result.length} rows`,
        details: { rowCount: result.length, sample: result[0] },
        duration: Date.now() - startTime
      });
    } else {
      results.push({
        test: 'Complex Query',
        status: 'FAIL',
        message: 'Query returned unexpected result type',
        details: { result, isArray: Array.isArray(result) },
        duration: Date.now() - startTime
      });
    }
  } catch (error) {
    results.push({
      test: 'Complex Query',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error,
      duration: Date.now() - startTime
    });
  }
}

async function testTransactionRollback() {
  const startTime = Date.now();
  console.log('🔄 Testing transaction rollback...');

  try {
    await db.transaction(async (tx) => {
      // Insert a user
      const [testUser] = await tx.insert(users).values({
        email: `transaction-test-${Date.now()}@example.com`,
        username: `txtest${Date.now()}`,
        password: await bcrypt.hash('TxTest123!', 10),
        role: 'client' as const,
        firstName: 'Transaction',
        lastName: 'Test',
        isActive: true
      }).returning();

      // Intentionally cause an error to test rollback
      throw new Error('Intentional rollback test');
    });

    results.push({
      test: 'Transaction Rollback',
      status: 'FAIL',
      message: 'Transaction should have been rolled back',
      duration: Date.now() - startTime
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Intentional rollback test') {
      results.push({
        test: 'Transaction Rollback',
        status: 'PASS',
        message: 'Transaction rolled back successfully',
        duration: Date.now() - startTime
      });
    } else {
      results.push({
        test: 'Transaction Rollback',
        status: 'ERROR',
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error,
        duration: Date.now() - startTime
      });
    }
  }
}

function printResults() {
  console.log('\n📊 DATABASE OPERATIONS TEST RESULTS');
  console.log('=' .repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`🚨 Errors: ${errors}`);
  console.log(`📋 Total: ${results.length}`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms\n`);
  
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '🚨';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${index + 1}. ${result.test}${duration}`);
    console.log(`   ${result.message}`);
    if (result.details && Object.keys(result.details).length > 0) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
    console.log('');
  });

  if (failed > 0 || errors > 0) {
    process.exit(1);
  }
}

async function main() {
  console.log('🧪 DATABASE OPERATIONS TESTING SUITE');
  console.log('=' .repeat(60));
  console.log('Testing database operations that have TypeScript errors...\n');

  try {
    const userId = await testUserInsertion();
    const bulkUserIds = await testBulkUserInsertion();
    
    if (userId) {
      const jobId = await testJobCreation(userId);
      if (jobId && bulkUserIds.length > 0) {
        await testJobParticipantCreation(jobId, bulkUserIds);
      }
    }
    
    await testComplexQuery();
    await testTransactionRollback();
    
  } catch (error) {
    console.error('Fatal error during testing:', error);
    process.exit(1);
  }
  
  printResults();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
