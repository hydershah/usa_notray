# PDF Editor System Usage Guide

## Overview

The PDF Editor system provides a comprehensive solution for document tagging, signing, and notarization with real-time collaboration features. It supports multiple participants, digital signatures, and tamper-evident document certification.

## Architecture

### Backend Components

1. **PDF Processing Service** (`server/services/pdf-processor.service.ts`)
   - Handles PDF manipulation, overlay application, and digital certificate signing
   - Supports text, image, and signature overlays
   - Generates audit trail PDFs

2. **WebSocket Service** (`server/services/editor-websocket.service.ts`)
   - Real-time collaboration for multiple users
   - Synchronizes tag placement, edits, and document state
   - Handles cursor tracking and page synchronization

3. **API Routes** (`server/routes/editor.routes.ts`)
   - RESTful endpoints for session management
   - Document upload and processing
   - Notary log and audit trail generation

### Frontend Components

1. **PDFEditor Component** (`client/src/components/editor/PDFEditor.tsx`)
   - Main editor interface with PDF viewer
   - Toolbar for tag placement
   - Participant management panels

2. **TagLayer Component** (`client/src/components/editor/TagLayer.tsx`)
   - Interactive tag rendering and editing
   - Drag-and-drop tag positioning
   - Tag completion workflows

3. **Supporting Components**
   - `ToolBar`: Tag selection and navigation controls
   - `ParticipantList`: Active session participants
   - `DocumentList`: Session document management
   - `NotaryControls`: Notary-specific actions
   - `SignatureCapture`: Signature/initials creation

## User Workflows

### 1. Creating a Tagging Session

```javascript
// Navigate to editor with job ID
/editor/123?mode=tagging

// System automatically creates session
// Redirects to: /editor-session/{sessionId}
```

### 2. Document Upload

- Click "Upload Documents" in the documents panel
- Select up to 50 PDF files
- System validates and stores documents

### 3. Tag Placement

**Available Tag Types:**

| Tag | Type | Description | Hotkey |
|-----|------|-------------|---------|
| A | Name | Signer name field | A |
| S | Signature | Signature placement | S |
| I | Initials | Initials placement | I |
| N | Commission # | Notary commission number | N |
| X | Expiry | Commission expiration date | X |
| O | Disclosure | Notary disclosure text | O |
| E | Seal | Notary seal/stamp | E |
| W | Whiteout | Cover existing content | W |
| T | Text | Universal text field | T |
| D | Date | Universal date field | D |

**Placing Tags:**
1. Select tag type from toolbar
2. Click on document to place tag
3. Drag to reposition, resize handles to adjust size
4. Assign to specific participant (optional)

### 4. Live Signing Session

**For Signers:**
1. Join session via invitation link
2. Complete ID verification
3. Fill in assigned tags when prompted
4. Create/update signature if needed

**For Notary:**
1. Control document navigation
2. Guide signers through completion
3. Place notary seal and complete log entries
4. Apply digital certificate when finished

### 5. Document Completion

1. Verify all tags are completed
2. Click "Complete Document"
3. System merges overlays and creates final PDF
4. Apply digital certificate for tamper-evidence

## API Integration

### Create Session

```javascript
POST /api/pdf-editor/sessions
{
  "jobId": 123,
  "sessionType": "tagging", // or "notary"
  "settings": {
    "autoSyncScreens": true,
    "recordSession": true
  }
}
```

### Add Participants

```javascript
POST /api/pdf-editor/sessions/{sessionId}/participants
{
  "userId": 456,
  "role": "signer",
  "color": "#4ECDC4"
}
```

### Upload Documents

```javascript
POST /api/pdf-editor/sessions/{sessionId}/documents
FormData: {
  documents: File[]
}
```

### WebSocket Events

Connect to: `ws://host/ws/editor`

**Client Events:**
- `session:join`: Join editing session
- `tag:add`: Add new tag
- `tag:update`: Update tag position/assignment
- `tag:complete`: Complete tag with content
- `page:sync`: Synchronize page view

**Server Events:**
- `session:participants`: Participant list update
- `tag:added`: New tag added by another user
- `tag:updated`: Tag modified
- `cursor:moved`: Another user's cursor position

## Security Features

1. **Authentication**: All routes require valid JWT token
2. **Authorization**: Role-based access control
3. **ID Verification**: Required before signing
4. **Audit Trail**: Complete action history
5. **Digital Certificates**: PFX-based document signing
6. **Tamper Detection**: Certified PDFs prevent modifications

## Best Practices

1. **Session Management**
   - Create sessions before inviting participants
   - Set appropriate timeouts for security
   - Clean up abandoned sessions

2. **Tag Placement**
   - Use consistent sizing for similar fields
   - Group related tags together
   - Assign tags to specific users when possible

3. **Performance**
   - Limit concurrent editors to 10 users
   - Use page-by-page loading for large documents
   - Enable compression for final PDFs

4. **Error Handling**
   - Implement reconnection logic for WebSocket
   - Save draft state periodically
   - Provide clear error messages to users

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check firewall settings
   - Verify WebSocket URL protocol (ws/wss)
   - Ensure authentication token is valid

2. **PDF Not Loading**
   - Verify file is valid PDF format
   - Check file size limits (10MB per file)
   - Ensure proper CORS configuration

3. **Tags Not Saving**
   - Confirm user has edit permissions
   - Check WebSocket connection status
   - Verify session is still active

### Debug Mode

Enable debug logging:
```javascript
localStorage.setItem('PDF_EDITOR_DEBUG', 'true');
```

## Migration from Legacy System

If migrating from SimpleSessionManager:

1. Update route from `/editor/{jobId}` to use new system
2. Sessions are created automatically
3. WebSocket replaces polling mechanisms
4. Tag data structure remains compatible

## Future Enhancements

- [ ] Offline mode support
- [ ] Mobile-responsive design
- [ ] Batch operations for tags
- [ ] Template system for common documents
- [ ] Advanced signature verification
- [ ] Multi-language support 