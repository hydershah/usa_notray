# Delete Functionality Guide

## Overview

The USA Notary Platform now supports comprehensive deletion of jobs and documents with proper file cleanup from both local storage and Vultr cloud storage.

## Features Implemented

### ✅ Job Deletion
- **Individual job deletion** via `DELETE /api/jobs/:id`
- **Bulk job deletion** via frontend job table interface
- **Complete file cleanup** - removes all associated documents from storage
- **Permission control** - only job creator or admin can delete jobs
- **Database cleanup** - removes job and all related records

### ✅ Document Deletion
- **Individual document deletion** via `DELETE /api/jobs/:jobId/documents/:documentId`
- **Hybrid storage support** - handles both local files and Vultr cloud files
- **Permission control** - job creator, document uploader, or admin can delete
- **Graceful error handling** - continues with database cleanup even if file deletion fails

## API Endpoints

### Delete Job
```http
DELETE /api/jobs/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Job and associated files deleted successfully"
}
```

**Error Responses:**
- `404` - Job not found
- `403` - Access denied (only job creator or admin)
- `500` - Internal server error

### Delete Document
```http
DELETE /api/jobs/:jobId/documents/:documentId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Document deleted successfully"
}
```

**Error Responses:**
- `404` - Job or document not found
- `403` - Access denied (only job creator, document uploader, or admin)
- `500` - Internal server error

## Frontend Integration

### Job Table Bulk Actions
The job table component includes:
- **Select multiple jobs** with checkboxes
- **Bulk delete option** in the actions dropdown
- **Confirmation dialog** to prevent accidental deletions
- **Progress feedback** during deletion process

### Document Manager
The enhanced document manager provides:
- **Individual delete buttons** for each document
- **Delete confirmation** before removing documents
- **Real-time updates** after successful deletion

## Technical Implementation

### File Storage Cleanup

The delete operations intelligently handle both storage systems:

```typescript
// Determines if file is in Vultr cloud storage
const isVultrFile = !filePath.startsWith('/') && 
                   !filePath.includes('\\') && 
                   !filePath.includes('uploads/');

if (isVultrFile) {
  // Delete from Vultr cloud storage
  const { cloudStorage } = await import('./lib/cloud-storage-service');
  await cloudStorage.deleteFile(filePath);
} else {
  // Delete local file (legacy support)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
```

### Permission Model

**Job Deletion:**
- ✅ Job creator (user who created the job)
- ✅ Admin users
- ❌ Other users (including assigned notaries)

**Document Deletion:**
- ✅ Job creator
- ✅ Document uploader
- ✅ Admin users
- ❌ Other users

## Database Relationships

When deleting jobs, the system handles cascading relationships:

1. **Job Documents** - All associated documents are deleted
2. **Job Participants** - Signer and participant records are removed
3. **Fee Breakdowns** - Financial records are preserved for audit
4. **Payment Records** - Payment history is maintained
5. **Transaction History** - Account transactions remain for compliance

## Safety Features

### Error Handling
- **Graceful degradation** - Database cleanup continues even if file deletion fails
- **Detailed logging** - All deletion attempts are logged with success/failure status
- **Transaction safety** - Database operations use transactions where appropriate

### Validation
- **Existence checks** - Verifies job/document exists before attempting deletion
- **Permission validation** - Strict access control before any deletion operations
- **File verification** - Checks file existence before attempting removal

## Usage Examples

### Frontend Usage

```typescript
// Delete a job
const deleteJob = async (jobId: number) => {
  const response = await apiRequest('DELETE', `/api/jobs/${jobId}`);
  if (response.ok) {
    // Refresh job list
    queryClient.invalidateQueries(['jobs']);
  }
};

// Delete a document
const deleteDocument = async (jobId: number, documentId: number) => {
  const response = await apiRequest('DELETE', `/api/jobs/${jobId}/documents/${documentId}`);
  if (response.ok) {
    // Refresh document list
    refetch();
  }
};
```

### Bulk Operations

The frontend supports bulk job deletion:

```typescript
// Bulk delete selected jobs
const bulkDeleteJobs = async (jobIds: number[]) => {
  const promises = jobIds.map(id => 
    apiRequest('DELETE', `/api/jobs/${id}`)
  );
  await Promise.all(promises);
};
```

## Migration Notes

### Existing Files
- **Legacy local files** are properly handled during deletion
- **Vultr cloud files** are identified and deleted using cloud storage API
- **Mixed storage** scenarios are supported (jobs with both local and cloud files)

### Backwards Compatibility
- **Existing workflows** continue to work without changes
- **Old file paths** are recognized and handled appropriately
- **Database schema** remains unchanged

## Monitoring & Logging

All deletion operations generate detailed logs:

```
✅ Deleted file from Vultr: organized/documents/job-123/original_document.pdf
✅ Deleted local file: /uploads/documents/legacy_file.pdf
❌ Failed to delete file from Vultr: file_not_found.pdf
```

## Best Practices

1. **Always confirm** before bulk deletions
2. **Check permissions** before allowing delete actions
3. **Backup important data** before major cleanup operations
4. **Monitor logs** for failed file deletions
5. **Use cascade deletes** carefully to maintain data integrity

## Troubleshooting

### Common Issues

**File deletion fails but database deletion succeeds:**
- This is by design for data consistency
- Check cloud storage connectivity
- Verify file paths in database match actual storage

**Permission denied errors:**
- Verify user has appropriate role (job creator/admin)
- Check job ownership in database
- Ensure valid authentication token

**Bulk operations timing out:**
- Consider smaller batch sizes
- Implement client-side retry logic
- Monitor server performance during large deletions 