#!/usr/bin/env node

const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

console.log('🔍 Analyzing differences between staging-v7.5 and current completion logic...\n');

async function analyzeCompletion() {
  try {
    // Get the current session completion logic
    console.log('📄 Getting current completion logic...');
    const { stdout: currentRoutes } = await execAsync('git show HEAD:server/routes.ts | grep -A 200 "session.*complete"');
    
    // Get the staging-v7.5 completion logic  
    console.log('📄 Getting staging-v7.5 completion logic...');
    const { stdout: stagingRoutes } = await execAsync('git show origin/staging-v7.5:server/routes.ts | grep -A 200 "session.*complete"');
    
    // Key differences to look for
    console.log('\n🔍 KEY DIFFERENCES ANALYSIS:\n');
    
    // 1. Document processing return type
    console.log('1. DOCUMENT PROCESSING RETURN TYPE:');
    const currentProcessing = currentRoutes.includes('processedDocs') ? 'Array (processedDocs)' : 'Single (processedDoc)';
    const stagingProcessing = stagingRoutes.includes('processedDocs') ? 'Array (processedDocs)' : 'Single (processedDoc)';
    console.log(`   Current: ${currentProcessing}`);
    console.log(`   Staging: ${stagingProcessing}`);
    
    if (currentProcessing !== stagingProcessing) {
      console.log('   ❌ MISMATCH: Document processing return type changed!');
    } else {
      console.log('   ✅ MATCH: Same return type');
    }
    
    // 2. Job status update logic
    console.log('\n2. JOB STATUS UPDATE:');
    const currentJobUpdate = currentRoutes.includes('jobStatus.*completed') || currentRoutes.includes('status.*completed');
    const stagingJobUpdate = stagingRoutes.includes('jobStatus.*completed') || stagingRoutes.includes('status.*completed');
    console.log(`   Current has job status update: ${currentJobUpdate}`);
    console.log(`   Staging has job status update: ${stagingJobUpdate}`);
    
    // 3. File storage approach
    console.log('\n3. FILE STORAGE APPROACH:');
    const currentVultr = currentRoutes.includes('VultrUploadHandler');
    const stagingVultr = stagingRoutes.includes('VultrUploadHandler');
    const currentLocal = currentRoutes.includes('uploads/signed');
    const stagingLocal = stagingRoutes.includes('uploads/signed');
    
    console.log(`   Current uses Vultr: ${currentVultr}, Local: ${currentLocal}`);
    console.log(`   Staging uses Vultr: ${stagingVultr}, Local: ${stagingLocal}`);
    
    // 4. Database table usage
    console.log('\n4. DATABASE STORAGE:');
    const currentVersions = currentRoutes.includes('documentVersions');
    const stagingVersions = stagingRoutes.includes('documentVersions');
    const currentJobDocs = currentRoutes.includes('jobDocuments');
    const stagingJobDocs = stagingRoutes.includes('jobDocuments');
    
    console.log(`   Current uses documentVersions: ${currentVersions}, jobDocuments: ${currentJobDocs}`);
    console.log(`   Staging uses documentVersions: ${stagingVersions}, jobDocuments: ${stagingJobDocs}`);
    
    // Check PDF processor differences
    console.log('\n5. PDF PROCESSOR CHANGES:');
    try {
      const { stdout: currentPdf } = await execAsync('git show HEAD:server/services/pdf-processor.service.ts | grep -A 10 "processCompletedDocument"');
      const { stdout: stagingPdf } = await execAsync('git show origin/staging-v7.5:server/services/pdf-processor.service.ts | grep -A 10 "processCompletedDocument"');
      
      const currentReturnsArray = currentPdf.includes('ProcessedDocument[]') || currentPdf.includes('processedDocs');
      const stagingReturnsArray = stagingPdf.includes('ProcessedDocument[]') || stagingPdf.includes('processedDocs');
      
      console.log(`   Current processCompletedDocument returns array: ${currentReturnsArray}`);
      console.log(`   Staging processCompletedDocument returns array: ${stagingReturnsArray}`);
      
      if (currentReturnsArray !== stagingReturnsArray) {
        console.log('   ❌ CRITICAL: PDF processor return type changed between versions!');
      }
    } catch (error) {
      console.log('   ⚠️ Could not analyze PDF processor changes');
    }
    
    console.log('\n📋 SUMMARY:');
    console.log('The comparison shows that the current version has been significantly modified');
    console.log('from the working staging-v7.5 version. Key areas to investigate:');
    console.log('1. Document processing return type (single vs array)');
    console.log('2. File storage strategy (Vultr vs local vs both)'); 
    console.log('3. Database table usage (documentVersions vs jobDocuments)');
    console.log('4. PDF processor interface changes');
    
    console.log('\n💡 RECOMMENDATION:');
    console.log('Create a hybrid approach that:');
    console.log('- Uses the proven working logic from staging-v7.5');
    console.log('- Maintains backward compatibility');
    console.log('- Preserves the multi-document enhancements where they work');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeCompletion();

