import { db } from '../server/db';
import { jobRequests } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { JobRequestService } from '../server/services/job-request-service';

async function testJobRequestDocuments() {
  try {
    console.log('🧪 Testing job request document transformation...');
    
    // Get all job requests
    const allRequests = await db.select().from(jobRequests).limit(5);
    console.log(`📋 Found ${allRequests.length} job requests`);
    
    if (allRequests.length === 0) {
      console.log('❌ No job requests found in database');
      return;
    }
    
    // Test the transformation for each request
    for (const request of allRequests) {
      console.log(`\n🔍 Testing request ID: ${request.id}`);
      console.log(`📄 Title: ${request.title}`);
      console.log(`📊 Metadata:`, request.metadata);
      
      // Test the transformation
      const transformed = await JobRequestService.transformJobRequestWithDocuments(request);
      console.log(`✅ Transformed documents:`, transformed.documents);
      
      // Test the getJobRequestDocuments method
      const documents = await JobRequestService.getJobRequestDocuments(request.id);
      console.log(`📁 Direct documents fetch:`, documents);
    }
    
    console.log('\n✅ Document transformation test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testJobRequestDocuments(); 