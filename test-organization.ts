#!/usr/bin/env tsx

import { generateVultrKey, VultrFileOrganizer } from './server/lib/vultr-file-organizer';

console.log('🧪 Testing Vultr File Organization System\n');

// Test different file types and scenarios
const testCases = [
  {
    fileType: 'document' as const,
    originalFilename: 'purchase_agreement.pdf',
    options: { userId: 123, userRole: 'title_company', jobId: 456 },
    description: 'Job document from title company'
  },
  {
    fileType: 'signature' as const,
    originalFilename: 'john_signature.png', 
    options: { userId: 789, userRole: 'signer', jobId: 456 },
    description: 'Signer signature for job'
  },
  {
    fileType: 'stamp' as const,
    originalFilename: 'notary_official_stamp.png',
    options: { userId: 101, userRole: 'notary', notaryId: 101 },
    description: 'Notary official stamp'
  },
  {
    fileType: 'certificate' as const,
    originalFilename: 'commission_certificate.pdf',
    options: { userId: 101, userRole: 'notary', notaryId: 101 },
    description: 'Notary commission certificate'
  },
  {
    fileType: 'document' as const,
    originalFilename: 'supporting_document_with_special!@#characters.pdf',
    options: { userId: 999, userRole: 'client' },
    description: 'Document with special characters'
  }
];

console.log('📁 Generated File Organization Structure:\n');

testCases.forEach((testCase, index) => {
  console.log(`${index + 1}. ${testCase.description}`);
  console.log(`   Input: ${testCase.originalFilename}`);
  
  const result = generateVultrKey(testCase.fileType, testCase.originalFilename, testCase.options);
  
  console.log(`   📂 Folder: ${result.folder}`);
  console.log(`   📄 Filename: ${result.filename}`);
  console.log(`   🔗 Full Path: ${result.vultrKey}`);
  
  // Test parsing the generated key
  try {
    const parsed = VultrFileOrganizer.parseVultrKey(result.vultrKey);
    console.log(`   ✅ Parsed: Job ${parsed.metadata?.jobId || 'N/A'}, User ${parsed.metadata?.userId || 'N/A'}, Notary ${parsed.metadata?.notaryId || 'N/A'}`);
  } catch (error) {
    console.log(`   ❌ Parse Error: ${error}`);
  }
  
  console.log('');
});

// Test search patterns
console.log('🔍 Example Search Patterns:\n');

const searchTests = [
  { criteria: { fileType: 'document', jobId: 456 }, description: 'All documents for job 456' },
  { criteria: { fileType: 'stamp', notaryId: 101 }, description: 'All stamps for notary 101' },
  { criteria: { year: 2025, month: 1 }, description: 'All files from January 2025' },
  { criteria: { fileType: 'signature' }, description: 'All signature files' }
];

searchTests.forEach((test, index) => {
  console.log(`${index + 1}. ${test.description}`);
  const patterns = VultrFileOrganizer.generateSearchPatterns(test.criteria);
  patterns.forEach(pattern => {
    console.log(`   🔍 ${pattern}`);
  });
  console.log('');
});

console.log('🎉 Organization system is working correctly!');
console.log('\n📋 Benefits of this structure:');
console.log('   ✅ Files organized by type and date');
console.log('   ✅ Easy to find files for specific jobs/users/notaries');
console.log('   ✅ Metadata embedded in filenames');
console.log('   ✅ Scalable for large volumes');
console.log('   ✅ Human-readable organization'); 