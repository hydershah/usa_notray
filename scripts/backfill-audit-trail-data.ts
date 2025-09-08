#!/usr/bin/env tsx

/**
 * Backfill Audit Trail Data Script
 * This script backfills audit trail entries from system activity logs
 * to ensure comprehensive audit trail data for existing sessions
 */

import { db } from '../server/db';
import { eq, desc, and } from 'drizzle-orm';
import { systemActivityLogs, auditTrail, editorSessions, jobs } from '../shared/schema';
import { AuditTrailService } from '../server/services/audit-trail-service';
import crypto from 'crypto';

async function backfillAuditTrailData() {
  console.log('🔄 Starting Audit Trail Data Backfill Process');
  console.log('=' .repeat(60));
  
  try {
    // Get all jobs that might need audit trail backfill
    const jobsWithSessions = await db
      .select({
        job: jobs,
        session: editorSessions
      })
      .from(jobs)
      .innerJoin(editorSessions, eq(jobs.id, editorSessions.jobId))
      .where(eq(jobs.jobStatus, 'completed'))
      .orderBy(desc(jobs.updatedAt))
      .limit(50); // Process last 50 completed jobs

    console.log(`📊 Found ${jobsWithSessions.length} completed jobs with sessions to process`);

    for (const { job, session } of jobsWithSessions) {
      console.log(`\n🔍 Processing Job ${job.id} - Session ${session.id}`);
      
      // Check existing audit trail entries for this session
      const existingAuditEntries = await db
        .select()
        .from(auditTrail)
        .where(eq(auditTrail.sessionId, session.id));

      console.log(`   Existing audit entries: ${existingAuditEntries.length}`);

      // Get system activity logs for this job
      const systemLogs = await db
        .select()
        .from(systemActivityLogs)
        .where(eq(systemActivityLogs.jobId, job.id))
        .orderBy(desc(systemActivityLogs.createdAt));

      console.log(`   System activity logs: ${systemLogs.length}`);

      // If we have fewer than 5 audit entries but more system logs, backfill
      if (existingAuditEntries.length < 5 && systemLogs.length > 0) {
        console.log(`   🔄 Backfilling audit trail data...`);
        
        let backfilledCount = 0;
        
        for (const log of systemLogs.slice(0, 20)) { // Process up to 20 most recent logs
          try {
            // Create audit trail entry from system log
            await AuditTrailService.createAuditEntry({
              sessionId: session.id,
              userId: log.userId || 1, // Default to system user if no user
              userRole: log.userRole || 'system',
              eventType: log.action || 'system_activity',
              eventDetails: log.actionDescription || log.action || 'Backfilled from system log',
              ipAddress: log.ipAddress,
              deviceFingerprint: log.userAgent ? 
                crypto.createHash('md5').update(log.userAgent).digest('hex').substring(0, 16) : undefined,
              authenticationMethod: log.action?.includes('login') ? 'email_password' : undefined,
              verificationResult: log.isSuccessful ? 'success' : 'failure',
              credentialReference: log.action?.includes('login') ? 
                `backfill_auth_${log.userId}_${log.createdAt.getTime()}` : undefined,
              systemSource: 'BACKFILL_FROM_SYSTEM_LOG',
              retentionMetadata: {
                retentionYears: 10,
                policy: 'WORM',
                source: 'backfill',
                originalLogId: log.id,
                backfilledAt: new Date().toISOString(),
                location: {
                  city: log.city,
                  state: log.state,
                  country: log.country,
                  timezone: log.timezone,
                  latitude: log.latitude,
                  longitude: log.longitude,
                  ispName: log.ispName
                }
              }
            });
            
            backfilledCount++;
          } catch (error) {
            console.error(`     ❌ Failed to backfill log ${log.id}:`, error.message);
          }
        }
        
        console.log(`   ✅ Backfilled ${backfilledCount} audit trail entries`);
      } else {
        console.log(`   ✅ Session already has sufficient audit trail data`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎯 Audit Trail Backfill Process Complete');
    
    // Generate a summary report
    const totalAuditEntries = await db
      .select()
      .from(auditTrail);
    
    console.log(`📈 Total audit trail entries in system: ${totalAuditEntries.length}`);
    
  } catch (error) {
    console.error('💥 Error during backfill process:', error);
  }
}

// Create sample audit trail entries for testing
async function createSampleAuditTrailEntries() {
  console.log('🧪 Creating Sample Audit Trail Entries for Testing');
  console.log('=' .repeat(60));
  
  try {
    // Get a recent session to add sample data to
    const [recentSession] = await db
      .select()
      .from(editorSessions)
      .orderBy(desc(editorSessions.createdAt))
      .limit(1);

    if (!recentSession) {
      console.log('❌ No sessions found to add sample data to');
      return;
    }

    console.log(`📋 Adding sample audit trail entries to session ${recentSession.id}`);

    // Sample audit trail entries with comprehensive data
    const sampleEntries = [
      {
        sessionId: recentSession.id,
        userId: 1,
        userRole: 'notary',
        eventType: 'user_login',
        eventDetails: 'Notary logged in successfully with 2FA',
        ipAddress: '192.168.1.100',
        deviceFingerprint: 'fp_abc123def456',
        authenticationMethod: 'email_password_2fa',
        verificationResult: 'success',
        credentialReference: 'auth_1_' + Date.now(),
        systemSource: 'AUTHENTICATION'
      },
      {
        sessionId: recentSession.id,
        userId: 1,
        userRole: 'notary',
        eventType: 'session_started',
        eventDetails: 'RON session initiated by notary',
        ipAddress: '192.168.1.100',
        deviceFingerprint: 'fp_abc123def456',
        systemSource: 'SESSION_MANAGER'
      },
      {
        sessionId: recentSession.id,
        userId: 2,
        userRole: 'signer',
        eventType: 'identity_verification',
        eventDetails: 'ID verification completed successfully',
        ipAddress: '10.0.1.50',
        deviceFingerprint: 'fp_xyz789uvw012',
        authenticationMethod: 'ID_VERIFICATION',
        verificationResult: 'pass',
        credentialReference: 'id_verify_2_' + Date.now(),
        systemSource: 'IDENTITY_VERIFICATION'
      },
      {
        sessionId: recentSession.id,
        userId: 2,
        userRole: 'signer',
        eventType: 'document_signed',
        eventDetails: 'Digital signature applied to document',
        ipAddress: '10.0.1.50',
        deviceFingerprint: 'fp_xyz789uvw012',
        coordinatesPageReference: 'Page 1, X:150, Y:300',
        digitalSignatureHash: crypto.createHash('sha256').update('signature_data_' + Date.now()).digest('hex'),
        systemSource: 'DOCUMENT_MANAGER'
      },
      {
        sessionId: recentSession.id,
        userId: 1,
        userRole: 'notary',
        eventType: 'notary_seal_applied',
        eventDetails: 'Notary digital seal applied to document',
        ipAddress: '192.168.1.100',
        deviceFingerprint: 'fp_abc123def456',
        coordinatesPageReference: 'Page 1, X:200, Y:400',
        sealApplied: { sealType: 'digital', timestamp: new Date().toISOString() },
        notaryCertificateReference: 'CERT_2024_NOTARY_001',
        digitalSignatureHash: crypto.createHash('sha256').update('seal_data_' + Date.now()).digest('hex'),
        systemSource: 'NOTARIZATION'
      }
    ];

    for (const entry of sampleEntries) {
      await AuditTrailService.createAuditEntry(entry);
    }

    console.log(`✅ Created ${sampleEntries.length} sample audit trail entries`);
    console.log('🎯 Sample data creation complete');

  } catch (error) {
    console.error('💥 Error creating sample data:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--sample')) {
    await createSampleAuditTrailEntries();
  } else {
    await backfillAuditTrailData();
  }
}

main().catch(console.error);
