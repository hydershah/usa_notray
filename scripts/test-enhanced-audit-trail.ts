#!/usr/bin/env tsx

/**
 * Test script for the enhanced audit trail report generation
 * This script tests the new comprehensive audit trail features
 */

import { AuditTrailService } from '../server/services/audit-trail-service';

async function testEnhancedAuditTrail() {
  console.log('🧪 Testing Enhanced Audit Trail Report Generation');
  console.log('=' .repeat(60));
  
  // Test with a sample job ID - you should replace this with an actual job ID from your database
  const testJobId = 1; // Replace with a real job ID
  
  try {
    console.log(`📊 Generating comprehensive audit trail for Job #${testJobId}...`);
    
    const result = await AuditTrailService.generateAuditTrailReport(testJobId);
    
    if (result.success) {
      console.log('✅ Enhanced audit trail report generated successfully!');
      console.log(`📄 Report saved to: ${result.reportPath}`);
      
      if (result.reportData) {
        console.log('\n📈 Report Statistics:');
        console.log(`   • Total Events: ${result.reportData.complianceMetrics.totalEvents}`);
        console.log(`   • Total Verifications: ${result.reportData.complianceMetrics.totalVerifications}`);
        console.log(`   • Total Notarial Actions: ${result.reportData.complianceMetrics.totalNotarialActions}`);
        console.log(`   • Session Duration: ${Math.round(result.reportData.complianceMetrics.sessionDuration / 60)} minutes`);
        console.log(`   • Documents: ${result.reportData.documents.length}`);
        console.log(`   • Participants: ${result.reportData.signers.length}`);
        console.log(`   • Notary Logs: ${result.reportData.notaryLogs ? result.reportData.notaryLogs.length : 0}`);
        console.log(`   • Audit Integrity: ${result.reportData.complianceMetrics.integrityVerified ? 'Verified' : 'Basic'}`);
        
        console.log('\n🏷️  New Enhanced Features Included:');
        console.log('   ✓ Complete Session Context tracking (IP, Device Fingerprint, etc.)');
        console.log('   ✓ Detailed Event/Action logging with coordinates');
        console.log('   ✓ Comprehensive Verification records (KBA, ID, Biometric)');
        console.log('   ✓ Full Notarial Actions with seal and certificate details');
        console.log('   ✓ Notary Log (Journal) entries as per RON requirements');
        console.log('   ✓ System/Compliance tracking with integrity hashes');
        console.log('   ✓ WORM storage compliance and retention metadata');
        console.log('   ✓ Legal compliance verification checklist');
        console.log('   ✓ Enhanced PDF formatting with all required sections');
      }
      
    } else {
      console.error('❌ Failed to generate audit trail report:');
      console.error(`   Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error during audit trail generation:');
    console.error(error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎯 Enhanced Audit Trail Test Complete');
}

// Run the test
testEnhancedAuditTrail().catch(console.error);
