import dotenv from 'dotenv';
dotenv.config();

import { db } from './db';
import { jobs, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function createTestJobForUpload() {
  console.log('🔧 Fixing Upload Issue...\n');
  
  try {
    // First, check if we have any users
    console.log('👥 Checking users...');
    const allUsers = await db.select().from(users).limit(5);
    
    if (allUsers.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    console.log(`✅ Found ${allUsers.length} users:`);
    allUsers.forEach(user => {
      console.log(`   - User ${user.id}: ${user.email} (${user.role})`);
    });
    
    // Check if job with ID 1 exists
    console.log('\n🔍 Checking for job with ID 1...');
    const existingJob = await db.select().from(jobs).where(eq(jobs.id, 1)).limit(1);
    
    if (existingJob.length > 0) {
      console.log('✅ Job with ID 1 already exists:');
      console.log(`   Title Company: ${existingJob[0].titleCompany}`);
      console.log(`   Job Status: ${existingJob[0].jobStatus}`);
      console.log(`   User ID: ${existingJob[0].userId}`);
      return existingJob[0];
    }
    
    // Create a test job for upload testing with all required fields
    console.log('📝 Creating test job for upload testing...');
    const firstUser = allUsers[0];
    
    const [newJob] = await db.insert(jobs).values({
      // Required fields based on schema
      titleCompany: 'Test Title Company LLC',
      closingType: 'purchase',
      propertyAddressOne: '123 Test Street',
      propertyCity: 'Test City',
      propertyState: 'CA',
      propertyZipCode: '90210',
      // Optional but useful fields
      userId: firstUser.id,
      jobStatus: 'open',
      internalReference: 'TEST-REF-001',
      kbaRequired: false,
      propertyAddressTwo: 'Suite 100',
      notaryOption: 'assign',
      jobType: 'title_company',
      requiresNSA: false,
      requiresSpanishSpeaking: false,
      assignmentAttempts: 0,
      rejectedNotaries: [],
      isRandomAssignment: false,
      notaryApprovalStatus: 'pending_assignment',
      signerNotificationsSent: false,
      createdAt: new Date()
    }).returning();
    
    console.log('✅ Test job created successfully:');
    console.log(`   Job ID: ${newJob.id}`);
    console.log(`   Title Company: ${newJob.titleCompany}`);
    console.log(`   User ID: ${newJob.userId}`);
    
    return newJob;
    
  } catch (error) {
    console.error('❌ Error creating test job:', error);
    throw error;
  }
}

async function testDocumentUpload(jobId: number) {
  console.log(`\n🧪 Testing document upload with Job ID ${jobId}...`);
  
  try {
    const response = await fetch('http://localhost:3000/api/uploads/document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Send a test upload request to validate the endpoint
        test: true,
        jobId: jobId
      })
    });
    
    if (response.ok) {
      console.log('✅ Document upload endpoint is accessible');
    } else {
      console.log(`⚠️ Document upload endpoint returned: ${response.status}`);
    }
    
  } catch (error) {
    console.log('⚠️ Could not test upload endpoint (server may not be running)');
  }
}

// Main execution
async function main() {
  try {
    const job = await createTestJobForUpload();
    if (job) {
      await testDocumentUpload(job.id);
      
      console.log('\n🎯 Upload Issue Fix Summary:');
      console.log('✅ Test job created for document uploads');
      console.log(`✅ You can now test document uploads with jobId=${job.id}`);
      console.log('\n📝 Test Command:');
      console.log(`curl -X POST http://localhost:3000/api/uploads/document \\`);
      console.log(`  -F "document=@test-document.txt" \\`);
      console.log(`  -F "jobId=${job.id}" \\`);
      console.log(`  -F "sessionId=test-session"`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to fix upload issue:', error);
    process.exit(1);
  }
}

main(); 