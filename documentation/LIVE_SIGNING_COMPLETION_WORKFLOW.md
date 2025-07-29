# Live Signing Session Completion Workflow

## Overview

When a live signing session is completed, the system generates a final PDF document with all signatures, text, dates, stamps, and other content that was placed during the session. This document is then saved and made available for download in the job details.

## Step-by-Step Workflow

### 1. **User Completes Content in Live Signing**
- Users place signatures, initials, text, dates, and stamps on the document
- Each placement updates the tag's content in the database with:
  - `content`: The actual text or data
  - `contentData`: JSON containing type and value (e.g., signature images)
  - `isCompleted`: Set to true
  - `completedBy`: User ID who completed it
  - `completedAt`: Timestamp

### 2. **Session Completion Triggered**
When the notary clicks "Complete Session":
- Frontend validates all required tags are completed
- Calls `/api/session/:sessionId/complete`
- This endpoint redirects to `/api/editor/session/:sessionId/complete`

### 3. **PDF Generation Process**

#### A. Validation
```typescript
// Check if all required tags are completed
const incompleteTags = tags.filter(tag => !tag.isCompleted && tag.isRequired !== false);
if (incompleteTags.length > 0) {
  return error("Cannot complete: required tags not filled");
}
```

#### B. PDF Processing
The `PDFProcessorService` handles the actual PDF generation:

1. **Load Original PDF**: Retrieves the original uploaded document
2. **Get All Tags**: Fetches all tags with their content from the database
3. **Apply Content to PDF**:
   - **Signatures/Initials**: Embedded as PNG/JPG images
   - **Text Fields**: Drawn as text with appropriate fonts
   - **Dates**: Formatted and placed as text
   - **Names**: Drawn from user profiles
   - **Notary Seals**: Special handling with border and text
   - **Whiteout**: White rectangles to cover existing content

### 4. **File Storage**
- Generated PDF is saved to `uploads/signed/` directory
- Filename format: `job_{jobId}_signed_{timestamp}.pdf`
- A `documentVersions` record is created with:
  - Reference to original document
  - Session ID
  - File path and size
  - Version number
  - Status: 'completed'

### 5. **Job Status Update**
- Job status is updated to 'completed'
- `completedAt` timestamp is set
- `signedDocumentId` references the document version

### 6. **Display in Job Details**
The job details modal:
- Fetches document versions via `/api/jobs/:id/document-versions`
- Displays each signed document with:
  - Filename and completion date
  - File size
  - Download button
  - Preview button
  - Copy link functionality

## Technical Implementation

### Database Schema
```sql
-- Tags store the content
document_tags:
  - content: TEXT (actual content)
  - contentData: TEXT (JSON with type and value)
  - contentType: TEXT (signature, text, date, etc.)
  - isCompleted: BOOLEAN
  - completedBy: INTEGER (user ID)
  - completedAt: TIMESTAMP

-- Signed documents stored as versions
document_versions:
  - originalDocumentId: INTEGER (job ID)
  - sessionId: INTEGER
  - fileName: TEXT
  - filePath: TEXT
  - fileSize: INTEGER
  - status: TEXT ('completed')
  - digitalCertificateApplied: BOOLEAN
```

### Content Types and Handling

1. **Signature Images**
   - Stored as base64 data URLs in `contentData`
   - Extracted and embedded as PNG/JPG in PDF
   - Scaled to fit tag dimensions

2. **Text Content**
   - Plain text stored in `content` field
   - Drawn with appropriate font size based on tag dimensions
   - Color coding: Blue for notary, black for others

3. **Special Fields**
   - Dates: Auto-formatted to locale string
   - Names: Pulled from user profiles
   - Notary info: Commission number, expiration, etc.

## API Endpoints

### Complete Session
```
POST /api/session/:sessionId/complete
POST /api/editor/session/:sessionId/complete
```

### Get Signed Documents
```
GET /api/jobs/:id/document-versions
```

### Download Signed PDF
```
GET /api/documents/signed/:fileName
```

## Security Considerations

1. **Access Control**: Only authorized users can complete sessions
2. **File Access**: Signed documents require authentication
3. **Audit Trail**: All actions logged with timestamps and user IDs
4. **Data Integrity**: Original documents preserved, signed versions are separate

## Error Handling

- Incomplete required tags prevent completion
- PDF generation failures logged but don't block session completion
- Fallback display for missing signature images
- Graceful handling of malformed content data

## Future Enhancements

1. **Digital Certificates**: Apply PKI certificates to PDFs
2. **Batch Processing**: Handle multiple documents in one session
3. **Cloud Storage**: Direct upload to Vultr instead of local storage
4. **Webhook Notifications**: Notify external systems on completion
5. **Audit Reports**: Generate detailed signing ceremony reports 