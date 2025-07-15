import { db } from './server/db.js';
import { eq } from 'drizzle-orm';
import { jobDocuments } from './shared/schema.js';

async function testDatabaseConnection() {
  console.log('🔄 Testing database connection...');

  try {
    // Test basic query
    console.log('📊 Querying jobDocuments...');
    const allDocs = await db.select().from(jobDocuments).limit(5);
    console.log(`✅ Found ${allDocs.length} documents`);
    
    // Look for signed documents
    const signedDocs = await db
      .select()
      .from(jobDocuments)
      .where(eq(jobDocuments.documentType, 'signed_document'));
    
    console.log(`📄 Found ${signedDocs.length} signed documents`);
    
    if (signedDocs.length > 0) {
      console.log('Signed documents found:');
      signedDocs.forEach((doc, index) => {
        console.log(`  ${index + 1}. ${doc.fileName} (Job ID: ${doc.jobId})`);
      });
    }

  } catch (error) {
    console.error('❌ Database test failed:', error);
    process.exit(1);
  }
}

testDatabaseConnection().then(() => {
  console.log('✅ Database test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Database test failed:', error);
  process.exit(1);
}); 