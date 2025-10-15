# Audit Trail Vultr Storage Fix

## Problem
Audit trail PDFs were being saved to local filesystem but the system was attempting to construct Vultr Object Storage URLs from these local paths, resulting in invalid S3 keys like:
```
https://usanotary.ewr1.vultrobjects.com//opt/usa_notray/releases/20251015_171133/uploads/job-111-1760550575896-job_52_audit_trail.pdf
```

This caused `NoSuchKey` errors when trying to download audit trails.

## Root Cause
The audit trail generation service (`server/services/audit-trail-service.ts`) was:
1. Saving PDFs to local filesystem: `uploads/audit-trails/job_${jobId}_audit_trail_${timestamp}.pdf`
2. Storing the local filesystem path in the database
3. These local paths were being incorrectly treated as Vultr keys elsewhere in the system

## Solution
Modified the audit trail system to properly support Vultr Object Storage with local filesystem fallback:

### 1. Updated Audit Trail Generation (`server/services/audit-trail-service.ts`)
- **Primary**: Upload generated PDFs directly to Vultr Object Storage using organized file structure
- **Fallback**: Save to local filesystem if Vultr is unavailable
- Store the Vultr key (not full URL) in the database when using cloud storage
- Use proper file organization via `VultrFileOrganizer` for professional structure

Key changes:
```typescript
// Generate organized Vultr key for audit trail
const organized = VultrFileOrganizer.generateOrganizedKey({
  fileType: 'documents',
  originalFilename: reportFileName,
  userId: reportData.job.userId,
  jobId: reportData.job.id,
  userRole: 'system'
});

// Upload to Vultr
const uploadResult = await cloudStorage.uploadFile(Buffer.from(pdfBytes), organized.vultrKey, {
  contentType: 'application/pdf',
  metadata: { /* ... */ },
  acl: 'private',
});

// Return the Vultr key (not the full URL)
return organized.vultrKey;
```

### 2. Updated Audit Trail Retrieval (`server/services/audit-trail-service.ts`)
Enhanced `getAuditTrailReport()` method to:
- Detect if stored path is a Vultr key or local path
- Generate signed URLs for Vultr-stored audit trails
- Return storage type information for proper handling

```typescript
const isVultrKey = reportPath.startsWith('production/') || reportPath.startsWith('development/');

if (isVultrKey) {
  const signedUrl = await cloudStorage.getSignedUrl(reportPath, 7200); // 2 hours
}

return {
  exists: true,
  reportPath,
  signedUrl,
  storageType: isVultrKey ? 'vultr' : 'local'
};
```

### 3. Updated Download Endpoint (`server/routes.ts`)
Modified `/api/jobs/:id/audit-trail/download` to:
- Check if the reportPath is a Vultr key or local path
- For Vultr keys: Generate signed URL and redirect
- For local paths: Stream from filesystem (legacy support)

```typescript
const isVultrKey = reportPath.startsWith('production/') || reportPath.startsWith('development/');

if (isVultrKey) {
  const signedUrl = await cloudStorage.getSignedUrl(reportPath, 300); // 5 minutes
  res.redirect(signedUrl);
} else {
  // Handle legacy local file system audit trails
  const fileBuffer = await fs.readFile(fullPath);
  res.send(fileBuffer);
}
```

### 4. Updated Frontend Component (`client/src/components/job/AuditTrail.tsx`)
Enhanced download functionality to:
- Use signed URLs directly when available (better performance)
- Fallback to API endpoint for local files
- Display proper storage type information

```typescript
if (auditInfo?.signedUrl && auditInfo?.storageType === 'vultr') {
  // Direct download from signed URL
  window.location.href = auditInfo.signedUrl;
} else {
  // Fallback to API endpoint for local files
  const response = await fetch(`/api/jobs/${jobId}/audit-trail/download`);
  // ... handle blob download
}
```

## Benefits

1. **Proper Cloud Storage**: Audit trails are now correctly stored in Vultr Object Storage
2. **Organized Structure**: Uses professional folder structure (production/documents/YYYY/MM/category/)
3. **Backward Compatibility**: Legacy local audit trails continue to work
4. **Better Performance**: Direct signed URL downloads skip server proxy
5. **Secure Access**: Private ACL with time-limited signed URLs
6. **Scalability**: No local disk space issues as audit trails grow

## Migration Notes

- **Existing Audit Trails**: Old audit trails stored locally will continue to work
- **New Audit Trails**: Will be automatically stored in Vultr Object Storage
- **No Database Migration Required**: The same `auditTrailReportPath` field stores either:
  - Vultr key: `production/documents/2025/10/notarizations/job-123/...`
  - Local path: `uploads/audit-trails/job_52_audit_trail_1729015782.pdf`

## Testing Checklist

- [ ] Generate new audit trail for a job
- [ ] Verify PDF is uploaded to Vultr (check logs for "✅ Uploaded audit trail to Vultr")
- [ ] Verify download works from job details page
- [ ] Verify old audit trails (if any) still download correctly
- [ ] Verify signed URLs expire after 2 hours
- [ ] Test fallback to local storage if Vultr is unavailable

## Related Files

- `server/services/audit-trail-service.ts` - Audit trail generation and retrieval
- `server/routes.ts` - Download endpoint
- `client/src/components/job/AuditTrail.tsx` - Frontend component
- `server/lib/cloud-storage-service.ts` - Vultr integration
- `server/lib/vultr-file-organizer.ts` - File organization logic

