# PDF Upload and Audit Trail Fix - Complete Migration to Local Storage

## Issue
ALL documents were being uploaded to Vultr cloud storage, causing:
- Dependency on external service
- Slower upload times
- Mixed file paths in database
- Errors when Vultr is unavailable

## Root Cause
The system was using Vultr for ALL file uploads:
1. Job documents (when creating jobs)
2. Signed PDFs (when completing sessions)
3. Audit trails (when generating reports)
4. This created dependency on Vultr availability and credentials

## Changes Made

### 1. Job Document Uploads (`server/vultr-upload-handler.ts` lines 26-89)

**Before:**
- `VultrUploadHandler.handleJobDocumentUpload()` uploaded to Vultr
- Fell back to local storage only if Vultr failed
- Database records had Vultr keys
- Used for all job creation uploads

**After:**
- **Directly saves to local storage** (`uploads/documents/` directory)
- No Vultr upload attempts at all
- Database records have local file paths only
- Consistent behavior across all job creation

### 2. Signed PDF Storage (`server/routes.ts` lines 9675-9717)

**Before:**
- Tried to upload to Vultr via `VultrUploadHandler.handleJobDocumentUpload()`
- Saved local backup if Vultr succeeded
- Fell back to local-only if Vultr failed
- Mixed database records (some Vultr keys, some local paths)

**After:**
- **Directly saves to local storage** (`uploads/signed/` directory)
- Creates proper database records with local file paths
- No Vultr upload attempts
- Clean, predictable behavior

### 3. Audit Trail Storage (`server/services/audit-trail-service.ts` lines 786-787)

**Before:**
- Tried to upload to Vultr first
- Fell back to local storage if Vultr failed
- Returned Vultr keys instead of local paths

**After:**
- **Directly saves to local storage** (`uploads/audit-trails/` directory)
- Skips Vultr entirely
- Returns local file path for database storage

## File Locations

### Job Documents (Uploaded when creating jobs)
- **Directory:** `/home/hyder/usa_notray/uploads/documents/`
- **Format:** `job-{jobId}-{timestamp}-{sanitizedFilename}`
- **Example:** `job-114-1760559414123-RON_seller_doc_pkg.pdf`
- **Temp Format (job requests):** `temp-{timestamp}-{sanitizedFilename}`

### Signed PDFs (Generated after session completion)
- **Directory:** `/home/hyder/usa_notray/uploads/signed/`
- **Format:** `{originalFileName}_signed_{timestamp}.pdf`
- **Example:** `RON seller doc pkg_signed_1757526977174.pdf`

### Audit Trails (Generated with signed PDFs)
- **Directory:** `/home/hyder/usa_notray/uploads/audit-trails/`
- **Format:** `job_{jobId}_audit_trail_{timestamp}.pdf`
- **Example:** `job_42_audit_trail_1729048123456.pdf`

## Benefits

1. **Reliability:** No dependency on Vultr connectivity
2. **Performance:** Faster uploads (no network latency)
3. **Simplicity:** Single storage method, easier to debug
4. **Consistency:** All signed documents use the same storage approach
5. **Database Integrity:** Proper file paths in database records

## Testing Checklist

- [ ] Complete a live signing session
- [ ] Verify signed PDF is created in `uploads/signed/`
- [ ] Check database `job_documents` table for correct file path
- [ ] Verify audit trail is generated in `uploads/audit-trails/`
- [ ] Check `jobs` table for `auditTrailReportPath` field
- [ ] Download completed document from job details page
- [ ] Download audit trail from job details page

## Migration Notes

**For existing Vultr-stored files:**
- Old files remain in Vultr and can still be accessed
- New files will be stored locally
- Consider migration script if you need to pull old files from Vultr

## Environment Variables

The following Vultr variables are no longer used for PDF/audit trail storage:
- `VULTR_ACCESS_KEY`
- `VULTR_SECRET_KEY`
- `VULTR_REGION`
- `VULTR_BUCKET_NAME`
- `VULTR_ENDPOINT`

*Note: These may still be used for other upload types (signatures, stamps, recordings)*

## Related Files Modified

1. `server/vultr-upload-handler.ts` - Job document upload handler (PRIMARY FIX)
2. `server/routes.ts` - Session completion endpoint (signed PDF logic)
3. `server/services/audit-trail-service.ts` - Audit trail generation service

## Next Steps

1. Test the complete session workflow
2. Verify files are being created locally
3. Check database records have correct paths
4. Monitor server logs for any errors
5. Consider implementing backup strategy for `uploads/` directory

