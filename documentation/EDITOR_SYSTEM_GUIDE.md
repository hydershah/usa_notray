# Digital Notary Editor and Tagging System

A comprehensive PDF editor and tagging system for digital notarization sessions, built according to the specifications provided.

## Overview

The editor system provides two main modes:
1. **Tagging Mode**: Prepare documents by placing tags where information needs to be filled
2. **Notary Session Mode**: Conduct live notarization sessions with video conferencing

## Features

### Document Tagging System
- **Tag Types**:
  - **Signer Tags**: A (Name), S (Signature), I (Initials)
  - **Notary Tags**: N (Commission Number), X (Expiration), O (Disclosure), E (Seal), W (Whiteout)
  - **Universal Tags**: T (Text), D (Date)

- **User Assignment**: Tags are color-coded and assigned to specific users
- **Keyboard Shortcuts**: Quick tag placement using hotkeys
- **Multi-document Support**: Handle up to 50 PDF files per session

### Notary Session Features
- **Video Conferencing**: Integrated video sessions for remote notarization
- **Real-time Collaboration**: All participants can view and interact with documents
- **ID Verification**: Built-in identity verification workflow
- **Audit Trail**: Complete logging of all actions and timestamps
- **Notary Log**: Automatic generation of notary log entries
- **Digital Certificates**: Support for applying digital certificates to completed documents

## Getting Started

### 1. Database Setup

Run the migration to create the necessary tables:

```bash
psql -d your_database -f migration-editor-system.sql
```

### 2. Install Dependencies

The system requires several PDF processing libraries:

```bash
npm install react-pdf pdfjs-dist uuid
npm install @types/uuid --save-dev
```

### 3. Configuration

Add the following environment variables:

```env
# Video conferencing (Whereby.com)
WHEREBY_API_KEY=your_whereby_api_key

# PDF processing
PDF_STORAGE_PATH=/uploads/pdfs
COMPLETED_PDF_PATH=/uploads/completed

# Digital certificates
CERTIFICATE_STORAGE_PATH=/certificates
```

## Usage

### Starting a Tagging Session

1. Navigate to `/editor/{jobId}?mode=tagging`
2. Select documents to tag
3. Use keyboard shortcuts to place tags:
   - `` ` `` - Switch to notary
   - `1-9` - Switch to signer 1-9
   - `A, S, I, N, X, O, E, W, T, D` - Place respective tag types
4. Click on PDF to place selected tag
5. Complete tagging and save session

### Conducting a Notary Session

1. Navigate to `/editor/{jobId}?mode=notary`
2. Start video conference
3. Admit participants from waiting room
4. Verify signer identities
5. Guide signers through completing tags
6. Place notary seals with notarization details
7. Complete all documents
8. End session and apply digital certificates

## API Endpoints

### Session Management
- `POST /api/editor/create-session` - Create new session
- `GET /api/editor/session/{sessionId}` - Get session details
- `POST /api/editor/session/{sessionId}/join` - Join session
- `POST /api/editor/session/{sessionId}/leave` - Leave session
- `POST /api/editor/session/{sessionId}/complete` - Complete session

### Tag Management
- `POST /api/editor/session/{sessionId}/place-tag` - Place tag on document
- `POST /api/editor/session/{sessionId}/complete-tag` - Complete tag with content
- `DELETE /api/editor/session/{sessionId}/tag/{tagId}` - Delete tag
- `GET /api/editor/session/{sessionId}/document/{documentId}/tags` - Get document tags

### Notary Features
- `POST /api/editor/session/{sessionId}/place-seal` - Place notary seal
- `POST /api/editor/session/{sessionId}/complete-document` - Complete document
- `GET /api/editor/session/{sessionId}/notary-log` - Get notary log
- `GET /api/editor/session/{sessionId}/audit-trail` - Get audit trail

## Tag Types Reference

| Hotkey | Type | Description | User Type |
|--------|------|-------------|-----------|
| A | Name | Signer name field | Signer |
| S | Signature | Signature field | Signer |
| I | Initials | Initial field | Signer |
| N | Commission Number | Notary commission number | Notary |
| X | Commission Expiration | Commission expiration date | Notary |
| O | Disclosure | Notary disclosure line | Notary |
| E | Seal | Notary seal/stamp | Notary |
| W | Whiteout | Cover original PDF content | Notary |
| T | Text | Text field | Universal |
| D | Date | Date field | Universal |

## User Colors

Each participant is assigned a color for tag identification:
- #FF6B6B (Red)
- #4ECDC4 (Teal) 
- #45B7D1 (Blue)
- #96CEB4 (Green)
- #FFEAA7 (Yellow)
- #DDA0DD (Plum)
- #98D8C8 (Mint)
- #F7DC6F (Light Yellow)
- #BB8FCE (Light Purple)
- #85C1E9 (Light Blue)

## Keyboard Shortcuts

### User Switching
- `` ` `` - Switch to notary user
- `1` - Switch to first signer
- `2` - Switch to second signer
- `3-9` - Switch to signers 3-9

### Tag Placement
- `A` - Place Name tag
- `S` - Place Signature tag
- `I` - Place Initials tag
- `N` - Place Commission Number tag
- `X` - Place Commission Expiration tag
- `O` - Place Disclosure tag
- `E` - Place Seal tag
- `W` - Place Whiteout tag
- `T` - Place Text tag
- `D` - Place Date tag

## Workflow

### 1. Pre-Session Preparation (Tagging)
1. Notary or administrator creates tagging session
2. Documents are uploaded and reviewed
3. Tags are placed where information will be needed
4. Session is saved for later use

### 2. Notary Session
1. Notary starts session and video conference
2. Participants join and are admitted from waiting room
3. ID verification is completed for all signers
4. Documents are reviewed and tags completed
5. Notary places seals with notarization details
6. All documents are completed and session ended
7. Digital certificates are applied

### 3. Post-Session
1. Completed PDFs are generated
2. Notary log is finalized
3. Audit trail is stored
4. Documents are delivered to client

## Security Features

- **Audit Trail**: Every action is logged with timestamps
- **Digital Certificates**: Tamper-evident document completion
- **Session Recording**: Video sessions are recorded and stored
- **Access Control**: Role-based permissions for all actions
- **ID Verification**: Required identity verification before signing

## Technical Architecture

### Frontend Components
- `SessionManager`: Orchestrates the entire workflow
- `DocumentEditor`: Main PDF editing interface
- `TaggingSession`: Document preparation interface

### Backend Services
- `editor-routes.ts`: API endpoints for all editor functionality
- Database schema with 7 new tables for complete tracking

### Database Tables
- `editor_sessions`: Session management
- `document_tags`: Tag placement and completion
- `session_participants`: User participation tracking
- `notary_log_entries`: Notary action logging
- `audit_trail`: Complete action audit
- `document_versions`: Document version control
- `session_settings`: Session configuration

## Compliance

The system is designed to meet digital notarization requirements:
- **10-year retention**: Video and audit trails stored for 10 years
- **Notary log maintenance**: Automatic notary log generation
- **Identity verification**: Required ID verification workflow
- **Tamper evidence**: Digital certificates prevent document tampering
- **Complete audit trail**: Every action is logged and timestamped

## Integration Points

### Video Conferencing
- Primary: Whereby.com integration
- Configurable for other providers
- Waiting room functionality
- Recording capabilities

### Document Processing
- PDF overlay and editing
- Digital certificate application
- Multi-document session support
- Version control and tracking

### Storage
- Local file storage for documents
- Cloud storage options available
- Secure certificate storage
- Video archive management

## Support and Maintenance

### Monitoring
- Session status tracking
- Performance metrics
- Error logging and alerts
- User activity monitoring

### Backup and Recovery
- Database backup procedures
- Document archive management
- Video storage lifecycle
- Certificate backup protocols

## Future Enhancements

- Mobile device support
- Advanced PDF annotation tools
- Multi-language support
- Enhanced video features
- AI-powered document analysis
- Advanced reporting and analytics 