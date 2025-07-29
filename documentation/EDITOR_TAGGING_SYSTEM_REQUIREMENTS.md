# Digital Notary Editor - Task-Based Requirements & Development Flow

## Project Overview

A dual-mode PDF editor system for digital notarization with **Tagging Mode** (placeholder placement) and **Live Signing Mode** (real-time collaborative content replacement). The system handles up to 50 PDFs with 8 signers + witnesses + notary in real-time video sessions.

### Core Task Flows
1. **📋 Document Tagging Flow**: Notary places temporary placeholder tags
2. **✍️ Live Signing Flow**: Real-time collaborative content replacement 
3. **🎥 Video Integration Flow**: Seamless video + document interaction
4. **📊 Real-Time Sync Flow**: Multi-user collaboration with instant updates

### Two-Phase Workflow
> **Important**: Tags are **temporary placeholders** during the tagging phase that mark WHERE content should be placed. During live signing sessions, these tags get replaced with actual content (real signatures, names, initials, etc.). The same tagged document flows from preparation → live signing.

1. **📋 Tagging Phase**: Place temporary tags as placeholders to mark positions
2. **✍️ Live Signing Phase**: Replace tags with actual content (signatures, names, etc.)

---

## Task Flow 1: Document Tagging Workflow

### T1.1: Tagging Session Initialization
**Trigger**: Notary clicks "Start Tagging" on job page
**Tasks**:
- [ ] Load documents uploaded during job creation
- [ ] Initialize tagging interface with PDF viewer
- [ ] Load participant list and assign colors
- [ ] Enable tag placement tools

**Technical Implementation**:
- [ ] PDF.js document rendering
- [ ] User color assignment system
- [ ] Tag placement coordinate system
- [ ] Database schema for tag storage

### T1.2: Tag Placement & Management
**User**: Notary/Admin only
**Tasks**:
- [ ] Place colored rectangle tags on PDF coordinates
- [ ] Assign tags to specific users (signer1, signer2, notary, etc.)
- [ ] Set tag types (signature, name, initial, seal, text, date)
- [ ] Create beautiful labels ("📝 John's Signature", "✍️ Jane's Name")
- [ ] Drag and resize tags during placement
- [ ] Handle multi-page tag placement
- [ ] Delete/modify tags as needed

**Tag Data Structure**:
```json
{
  "id": "tag_123",
  "type": "signature",
  "coordinates": {"x": 100, "y": 200, "width": 150, "height": 50},
  "assignedUser": "user_456", 
  "displayLabel": "📝 Signature - John Doe",
  "pageNumber": 1,
  "documentId": "doc_789",
  "colorCode": "#4ECDC4"
}
```

**Technical Implementation**:
- [ ] Drag & drop functionality
- [ ] Coordinate precision system
- [ ] Multi-page overlay management
- [ ] Tag validation and persistence

### T1.3: Tag Validation & Saving
**Tasks**:
- [ ] Validate all tags have proper coordinates
- [ ] Ensure user assignments are correct
- [ ] Check tag types match user permissions
- [ ] Save tagged document configuration
- [ ] Prepare for live signing transition

**Technical Implementation**:
- [ ] Tag validation engine
- [ ] Document state persistence
- [ ] Session configuration storage

---

## Task Flow 2: Live Signing Workflow

### T2.1: Session Initialization & Participant Management
**Trigger**: Notary clicks "Start Session" on job page
**Tasks**:
- [ ] Auto-load tagged documents
- [ ] Auto-start video session
- [ ] Display participant counter (invited vs joined)
- [ ] Wait for all participants to join
- [ ] Initialize user interface layout

**Interface Layout**:
```
[Video Boxes] [Document Viewer] [Controls & Chat]
[Left Side  ] [    Middle    ] [  Right Side  ]
```

**Technical Implementation**:
- [ ] WebRTC video integration
- [ ] Session state management
- [ ] Participant authentication
- [ ] UI layout rendering

### T2.2: Participant Joining & Authentication
**Users**: All participants
**Tasks**:
- [ ] Join via email link or dashboard
- [ ] Load user profile data automatically
- [ ] Verify ID (completed pre-session or in-session with notary bypass)
- [ ] Initialize user's content from profile
- [ ] Display user interface

**Technical Implementation**:
- [ ] Authentication system
- [ ] Profile data loading
- [ ] ID verification integration
- [ ] User session management

### T2.3: Content Loading & Management
**Tasks**:
- [ ] Load signatures, initials, names from user profiles
- [ ] Allow users to upload new content during session
- [ ] Enable content modification during session
- [ ] Handle content validation and formatting
- [ ] Prepare content for placement

**Technical Implementation**:
- [ ] Profile integration API
- [ ] File upload system
- [ ] Content validation
- [ ] Real-time content management

### T2.4: Document Navigation & Synchronization
**Users**: All participants
**Tasks**:
- [ ] Enable independent scrolling for each user
- [ ] Track user current page positions
- [ ] Provide "Sync Users" button for notary
- [ ] Handle zoom in/out with coordinate scaling
- [ ] Manage multi-page content placement

**Notary Controls**:
- [ ] "Sync Users" button - bring all users to notary's view
- [ ] Progress tracking across all participants
- [ ] Session management controls

**Technical Implementation**:
- [ ] Independent viewport management
- [ ] Real-time position tracking
- [ ] Coordinate synchronization system
- [ ] Multi-user state management

### T2.5: Content Interaction & Real-Time Collaboration
**Primary User**: All participants
**Tasks**:
- [ ] Handle interactive tag completion by assigned users
- [ ] Enable real-time content manipulation during completion
- [ ] Enable scaling, dragging, positioning of content as it's added
- [ ] Provide undo/redo functionality
- [ ] Sync all changes across participants instantly

**Real-Time Tasks**:
- [ ] Live content scaling and positioning
- [ ] Cross-page content dragging
- [ ] Simultaneous multi-user editing
- [ ] Keystroke-level synchronization
- [ ] Visual progress indicators

**Technical Implementation**:
- [ ] WebSocket real-time synchronization
- [ ] Content replacement engine
- [ ] Drag & drop system
- [ ] Undo/redo state management
- [ ] Multi-user conflict resolution

### T2.6: Multi-Document Session Management
**Tasks**:
- [ ] Handle simultaneous signing across multiple PDFs
- [ ] Enable document switching during session
- [ ] Maintain content state across document switches
- [ ] Track progress across all documents
- [ ] Log all edits and changes

**Technical Implementation**:
- [ ] Multi-document state management
- [ ] Document switching interface
- [ ] Cross-document content persistence
- [ ] Edit logging and audit trail

### T2.7: Session Completion & Finalization
**User**: Notary only
**Tasks**:
- [ ] Review all completed content
- [ ] Approve final documents
- [ ] End session (auto-stop video)
- [ ] Generate final PDFs
- [ ] Distribute copies to appropriate participants

**Distribution Rules**:
- [ ] Signers get copies via dashboard
- [ ] Witnesses do NOT get copies (personal/financial info)
- [ ] Admin gets all documents for manual review

**Technical Implementation**:
- [ ] PDF generation with final content
- [ ] Document distribution system
- [ ] Session cleanup and archival

---

## Task Flow 3: Video Integration Workflow

### T3.1: Video Session Management
**Tasks**:
- [ ] Auto-start video when live session begins
- [ ] Display video boxes on left side of interface
- [ ] Maintain always-visible video during session
- [ ] Handle audio communication for guidance
- [ ] Auto-stop video when session ends

**Technical Implementation**:
- [ ] Video API integration (Whereby.com or WebRTC)
- [ ] Video UI components
- [ ] Audio/video session management

### T3.2: Communication Integration
**Tasks**:
- [ ] Enable audio communication for notary guidance
- [ ] Provide text chat for technical support
- [ ] Handle video quality issues gracefully
- [ ] Maintain document interaction regardless of video quality

**Technical Implementation**:
- [ ] Chat functionality
- [ ] Audio/video fallback mechanisms
- [ ] Communication UI components

---

## Task Flow 4: Real-Time Synchronization Workflow

### T4.1: Multi-User State Management
**Tasks**:
- [ ] Track each user's current document position
- [ ] Sync content changes across all participants
- [ ] Handle simultaneous editing conflicts
- [ ] Manage individual user sessions within shared document
- [ ] Provide visual indicators for user activity

**Technical Implementation**:
- [ ] WebSocket connection management
- [ ] State synchronization engine
- [ ] Conflict resolution algorithms
- [ ] User activity tracking

### T4.2: Content Synchronization
**Tasks**:
- [ ] Sync every keystroke for text fields
- [ ] Sync content placement and scaling in real-time
- [ ] Handle drag operations across multiple users
- [ ] Sync undo/redo operations
- [ ] Maintain consistency across all viewports

**Technical Implementation**:
- [ ] Real-time data streaming
- [ ] Operational transformation for concurrent editing
- [ ] State consistency management
- [ ] Performance optimization for large documents

---

## Detailed System Specifications

### Tag Types and Functionality

#### Signer Tags
- **A - Name Tag**
  - **Tagging Phase**: Visual placeholder showing where signer's name will appear
  - **Live Signing**: Replaced with actual signer's legal name (text input)
  - Validation: Required field, character limits
  - Display: User-specific color coding

- **S - Signature Tag**
  - **Tagging Phase**: Visual placeholder showing where signature will be placed
  - **Live Signing**: Replaced with actual signature image (pre-uploaded transparent GIF)
  - Features: In-session signature modification capability
  - Versioning: Future vs. existing signature handling

- **I - Initials Tag**
  - **Tagging Phase**: Visual placeholder showing where initials will appear
  - **Live Signing**: Replaced with actual initials image (pre-uploaded)
  - Features: Consistent with signature styling
  - Validation: Required completion before document finalization

#### Notary Tags
- **N - Commission Number Tag**
  - **Tagging Phase**: Visual placeholder for commission number placement
  - **Live Signing**: Replaced with actual notary commission number (auto-populated from profile)
  - Validation: State-specific format validation
  - Display: Formatted according to state requirements

- **X - Commission Expiration Tag**
  - **Tagging Phase**: Visual placeholder for expiration date placement
  - **Live Signing**: Replaced with actual commission expiration date (from notary profile)
  - Format: MM/DD/YYYY or state-specific format
  - Validation: Must be future date

- **O - Disclosure Tag**
  - **Tagging Phase**: Visual placeholder for disclosure text placement
  - **Live Signing**: Replaced with actual notary disclosure text (250-character statement)
  - Source: Pre-configured in notary profile
  - Requirements: State-specific compliance text

- **E - Seal Tag**
  - **Tagging Phase**: Visual placeholder for notary seal placement
  - **Live Signing**: Replaced with actual notary seal/stamp image + notarization details
  - Features: Notarization type selection popup (Jurat, Acknowledgment, Copy Certification)
  - Logging: Automatic notary log entry creation

- **W - Whiteout Tag**
  - **Tagging Phase**: Visual placeholder showing area to be covered
  - **Live Signing**: Creates actual overlay box covering original PDF content
  - Layering: Below other content, above original PDF
  - Use case: Correcting or hiding original text

#### Universal Tags
- **T - Text Tag**
  - **Tagging Phase**: Visual placeholder for text input field
  - **Live Signing**: Replaced with actual text content (free-form entry)
  - Usage: Any user can complete during live session
  - Validation: Configurable character limits

- **D - Date Tag**
  - **Tagging Phase**: Visual placeholder for date field
  - **Live Signing**: Replaced with actual date (MM/DD/YYYY format)
  - Input: Date picker or manual entry during live session
  - Validation: Date format and reasonableness checks

### Tag Visual Design & Colors
- **Visual Style**: Colored rectangles with labels inside
- **Color Scheme**:
  - **Notary**: `#FF6B6B` (Coral Red)
  - **Signer 1**: `#4ECDC4` (Turquoise)
  - **Signer 2**: `#45B7D1` (Sky Blue)
  - **Signer 3**: `#96CEB4` (Sage Green)
  - **Signer 4**: `#FFEAA7` (Soft Yellow)
  - **Signer 5**: `#DDA0DD` (Plum)
  - **Signer 6**: `#98D8C8` (Mint)
  - **Signer 7**: `#F7DC6F` (Light Gold)
  - **Signer 8**: `#BB8FCE` (Lavender)
- **Label Format**: "📝 John's Signature", "✍️ Jane's Name", "🔖 Notary Seal"

### Tag Management System

#### Placement and Positioning
- **Coordinate System**: Precise PDF coordinate mapping
- **Visual Feedback**: Real-time tag preview during placement
- **Snap-to-Grid**: Optional alignment assistance
- **Collision Detection**: Prevent overlapping tags

#### Keyboard Shortcuts
- **User Switching**
  - ` (backtick): Switch to notary
  - 1-9: Switch to respective signer
  - Visual indicator of active user

- **Tag Placement**
  - A: Place Name tag for active user
  - S: Place Signature tag for active user
  - I: Place Initials tag for active user
  - N: Place Commission Number tag (notary only)
  - X: Place Commission Expiration tag (notary only)
  - O: Place Disclosure tag (notary only)
  - E: Place Seal tag (notary only)
  - W: Place Whiteout tag (notary only)
  - T: Place Text tag (universal)
  - D: Place Date tag (universal)

#### Tag States and Workflow

**📋 Tagging Phase States:**
- **Placed**: Tag positioned as visual placeholder
- **Validated**: Tag placement meets requirements (position, user assignment)
- **Saved**: Tag configuration saved for live session

**✍️ Live Signing Phase States:**
- **Active**: Tag ready to be filled with actual content
- **Completed**: Tag replaced with actual content (signature, name, etc.)
- **Validated**: Content passes all validation rules
- **Locked**: Content finalized and cannot be modified

#### Validation Rules
- **Required Tags**: All placed tags must be completed
- **User Permissions**: Only authorized users can complete specific tags
- **Content Validation**: Format and character limit enforcement
- **Dependency Checking**: Required prerequisite completion

### User Experience Scenarios

#### **Scenario 1: Simple Single-Signer Document**
1. **Job Setup**: Documents uploaded during job creation
2. **Tagging Phase**: Notary clicks "Start Tagging", places 3 tags: "📝 Signature - John", "✍️ Name - John", "📅 Date"
3. **Save & Transition**: Tagged document saved, notary clicks "Start Session"
4. **Session Start**: Video auto-starts, John joins via email link
5. **Interface**: John sees video (left), document (middle), controls (right) - tags are now interactive
6. **Content Completion**: John clicks each tag to complete - signature from profile, types name, selects date
7. **Real-Time Updates**: All changes sync instantly across participants
8. **Final Review**: Notary reviews completed content, approves, session ends, John gets copy in dashboard

#### **Scenario 2: Complex Multi-Signer + Multi-Document Session**
1. **Job Setup**: 3 PDFs uploaded, 8 participants (5 signers, 2 witnesses, 1 notary)
2. **Tagging Phase**: Notary places 25 tags across all documents for all users
3. **Session Initialization**: Notary starts session, participant counter shows "3/8 joined"
4. **Participant Management**: Wait for all to join, some use email links, others join from dashboard
5. **Independent Navigation**: Users scroll to different pages, Signer A on page 5, Signer B on page 12
6. **Content Loading**: All profiles loaded, Signer C uploads new signature during session
7. **Document Switching**: Switch between 3 PDFs, all content maintained
8. **Sync Users**: Notary uses "Sync Users" to bring everyone to same page for review
9. **Interactive Completion**: Each user completes their assigned tags by clicking and filling content
10. **Real-Time Edits**: Multiple users resize/move content simultaneously with live updates
11. **Completion**: Session ends, signers get copies, witnesses don't receive documents

#### **Scenario 3: Live Session Troubleshooting**
1. **Connection Issue**: Signer drops connection, rejoins via dashboard "Ongoing Session"
2. **Content Problem**: Signature too large, user drags corner to resize in real-time
3. **Wrong Placement**: User accidentally places signature in wrong spot, drags to correct location
4. **Signature Change**: User decides to upload different signature mid-session
5. **Undo Operations**: Multiple undo/redo actions as user fine-tunes placement
6. **Notary Assistance**: Notary helps user via audio + takes control to adjust placement
7. **Chat Support**: Technical issues resolved via text chat while video continues
8. **Session Continues**: All issues resolved, proceed to completion

#### **Scenario 4: Multi-Page Navigation & Content Management**
1. **Large Document**: 35-page contract with tags scattered throughout
2. **Independent Scrolling**: 6 users on different pages simultaneously
3. **Content Addition**: User realizes they need initials, adds them during live session
4. **Cross-Page Movement**: Drag signature from page 10 to page 15
5. **Zoom Precision**: Zoom in to 200% for precise placement, coordinates auto-adjust
6. **Progress Tracking**: Progress bar shows "18/25 items completed"
7. **Visual Indicators**: Completed content has checkmarks, pending items highlighted
8. **Final Synchronization**: All users brought to same view for final review

#### **Scenario 5: Error Recovery & Content Validation**
1. **File Upload Error**: User's signature file corrupted, re-uploads during session
2. **Misplaced Content**: Name accidentally placed over signature area
3. **Size Mismatch**: Initials too small to read, user scales up 150%
4. **Content Overlap**: Two signatures overlapping, drag one to different position
5. **Validation Issue**: Notary notices incorrect date, user corrects in real-time
6. **Undo Chain**: User performs 5 undo operations to revert multiple changes
7. **Final Check**: Notary does manual review before session approval
8. **Recovery Complete**: All errors resolved, session proceeds to completion

### Edge Case Handling

#### **Missing Content**
- If user hasn't uploaded signature: Prompt for live upload
- If user is absent: Session doesn't start (all must be present)
- If content is too large: Auto-scale to fit tag area

#### **Technical Issues**
- PDF corruption: Not applicable (stable documents)
- Outside boundaries: No action taken
- Cross-page dragging: Handled as overlay positioning
- Zoom level changes: Coordinates auto-adjust

#### **User Errors**
- Wrong content placed: Undo/replace functionality
- Accidental tag deletion: Can be re-added during live session
- Content misalignment: Fine positioning controls available

### Compliance and Legal Requirements

#### **Digital Notarization Standards**
- **RULONA Compliance**: Remote Notarization standards
- **State-Specific Laws**: Configurable rules by jurisdiction
- **Identity Verification**: Multi-factor authentication
- **Record Retention**: 10-year minimum storage

#### **Security and Privacy**
- **Data Encryption**: End-to-end encryption for all communications
- **Access Controls**: Role-based permissions and authentication
- **Audit Logging**: Complete action trail with timestamps
- **Privacy Protection**: GDPR, CCPA, and HIPAA compliance

#### **Quality Assurance**
- **Document Integrity**: Tamper-evident digital signatures
- **Session Recording**: Complete video and audio capture
- **Backup Systems**: Redundant storage and recovery
- **Monitoring**: Real-time system health and performance

### Success Metrics and KPIs

#### **Functional Metrics**
- **Session Completion Rate**: >99% successful completions
- **Tag Accuracy**: <0.1% tag placement errors
- **Document Processing**: Support for 50 concurrent PDFs
- **User Capacity**: 8 signers + observers + notary per session

---

## Frontend Implementation Architecture

### Technology Stack

#### **Core Technologies**
- **React 18**: Component-based UI with hooks and context
- **TypeScript**: Type safety and development experience
- **Fabric.js**: Canvas manipulation for PDF overlay system
- **PDF.js**: Client-side PDF rendering and manipulation
- **Zustand**: Lightweight state management for editor sessions
- **React Query**: Server state management and caching
- **WebSocket**: Real-time collaboration and synchronization
- **Tailwind CSS + Shadcn UI**: Modern, accessible component system

#### **Key Dependencies**
```json
{
  "fabric": "^6.7.0",
  "pdfjs-dist": "^5.3.31", 
  "zustand": "^4.4.1",
  "@tanstack/react-query": "^5.60.5",
  "react-rnd": "^10.5.2",
  "ws": "^8.18.3",
  "framer-motion": "^11.13.1"
}
```

### Component Architecture

#### **Primary Components Structure**
```
PDFTaggingEditor/
├── EditorLayout.tsx              # Main layout container
├── PDFViewer.tsx                 # PDF rendering and display
├── TaggingToolbar.tsx            # Tag type selection and tools
├── ParticipantManager.tsx        # User management and colors
├── TagLayer.tsx                  # Canvas overlay for tags
├── TagRenderer.tsx               # Individual tag component
├── HotkeyHandler.tsx             # Keyboard shortcut system
├── CollaborationSync.tsx         # Real-time synchronization
├── VideoIntegration.tsx          # Video session management
├── DocumentNavigation.tsx        # Multi-page navigation
└── SessionControls.tsx           # Session management UI
```

#### **Component Hierarchy**
```tsx
<EditorLayout>
  <VideoIntegration />
  <DocumentContainer>
    <PDFViewer>
      <TagLayer>
        <TagRenderer />
        <CollaborationCursors />
      </TagLayer>
    </PDFViewer>
    <DocumentNavigation />
  </DocumentContainer>
  <SidebarControls>
    <ParticipantManager />
    <TaggingToolbar />
    <SessionControls />
  </SidebarControls>
  <HotkeyHandler />
  <CollaborationSync />
</EditorLayout>
```

### Core Frontend Components

#### **1. PDFTaggingEditor.tsx - Main Container**
```tsx
interface PDFTaggingEditorProps {
  sessionId: string;
  mode: 'tagging' | 'signing';
  documents: SessionDocument[];
  participants: SessionParticipant[];
}

// Primary responsibilities:
// - Session initialization and cleanup
// - WebSocket connection management
// - Global state coordination
// - Error boundary handling
// - Performance monitoring
```

#### **2. PDFViewer.tsx - Document Rendering**
```tsx
interface PDFViewerProps {
  documentId: string;
  pageNumber: number;
  zoomLevel: number;
  onPageChange: (page: number) => void;
  onCoordinateClick: (x: number, y: number) => void;
}

// Features:
// - PDF.js integration for rendering
// - Independent scrolling per user
// - Zoom controls with coordinate scaling
// - Click-to-place tag functionality
// - Page navigation and thumbnails
// - High-performance canvas rendering
```

#### **3. TagLayer.tsx - Canvas Overlay System**
```tsx
interface TagLayerProps {
  tags: DocumentTag[];
  activeUser: SessionParticipant;
  selectedTagType: TagType;
  onTagPlace: (tag: PlaceTagCommand) => void;
  onTagUpdate: (tagId: string, updates: TagUpdate) => void;
}

// Features:
// - Fabric.js canvas management
// - Tag placement and positioning
// - Drag & drop functionality
// - Resize handles and visual feedback
// - Multi-layer z-index management
// - Coordinate precision handling
```

#### **4. TagRenderer.tsx - Individual Tag Display**
```tsx
interface TagRendererProps {
  tag: DocumentTag;
  user: SessionParticipant;
  mode: 'tagging' | 'signing';
  isSelected: boolean;
  onSelect: (tagId: string) => void;
  onUpdate: (updates: TagUpdate) => void;
}

// Visual states:
// - Tagging mode: Colored rectangle with label
// - Signing mode: Content or input field
// - Selected state: Resize handles and controls
// - Completed state: Checkmark and lock icon
// - Error state: Red border and validation message
```

#### **5. HotkeyHandler.tsx - Keyboard Shortcuts**
```tsx
interface HotkeyConfig {
  userSwitching: {
    backtick: () => void; // Switch to notary
    '1-9': (number: number) => void; // Switch to signer
  };
  tagPlacement: {
    'A': () => void; // Name tag
    'S': () => void; // Signature tag
    'I': () => void; // Initials tag
    'N': () => void; // Commission number
    'X': () => void; // Expiration date
    'O': () => void; // Disclosure
    'E': () => void; // Seal
    'W': () => void; // Whiteout
    'T': () => void; // Text
    'D': () => void; // Date
  };
  navigation: {
    'Arrow Keys': () => void; // Move selected tag
    'Delete': () => void; // Remove tag
    'Ctrl+Z': () => void; // Undo
    'Ctrl+Y': () => void; // Redo
  };
}
```

#### **6. CollaborationSync.tsx - Real-Time System**
```tsx
interface CollaborationSyncProps {
  sessionId: string;
  userId: string;
  onReceiveUpdate: (update: CollaborationUpdate) => void;
}

// WebSocket event handling:
// - Tag placement/updates in real-time
// - Cursor position tracking
// - User presence indicators
// - Document synchronization
// - Conflict resolution
// - Connection recovery
```

### State Management Architecture

#### **Editor Store (Zustand)**
```tsx
interface EditorStore {
  // Session state
  session: EditorSession | null;
  documents: SessionDocument[];
  currentDocument: string | null;
  currentPage: number;
  zoomLevel: number;
  
  // User management
  participants: SessionParticipant[];
  currentUser: SessionParticipant | null;
  selectedUser: SessionParticipant | null;
  userColors: Record<string, string>;
  
  // Tag management
  tags: DocumentTag[];
  selectedTag: string | null;
  selectedTagType: TagType | null;
  draggedTag: string | null;
  
  // UI state
  isTaggingMode: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  toolbarVisible: boolean;
  
  // Collaboration
  cursors: UserCursor[];
  syncEnabled: boolean;
  lastSyncTime: Date;
  
  // Actions
  setCurrentUser: (userId: string) => void;
  selectTagType: (type: TagType) => void;
  placeTag: (tag: PlaceTagCommand) => void;
  updateTag: (tagId: string, updates: TagUpdate) => void;
  deleteTag: (tagId: string) => void;
  syncToPage: (page: number) => void;
  setZoom: (level: number) => void;
}
```

#### **Real-Time State Synchronization**
```tsx
// WebSocket message types for real-time sync
interface WSMessage {
  type: 'tag_placed' | 'tag_updated' | 'tag_deleted' | 
        'cursor_moved' | 'page_changed' | 'user_joined' | 
        'user_left' | 'content_replaced' | 'session_sync';
  payload: any;
  userId: string;
  timestamp: number;
  sessionId: string;
}

// Optimistic updates with rollback
const handleTagUpdate = (update: TagUpdate) => {
  // 1. Apply optimistically to local state
  updateTagLocally(update);
  
  // 2. Send to server via WebSocket
  sendWSMessage('tag_updated', update);
  
  // 3. Handle server confirmation or rollback
  onServerResponse((response) => {
    if (!response.success) {
      rollbackTagUpdate(update);
      showError(response.error);
    }
  });
};
```

### User Interface Specifications

#### **Layout Design**
```css
/* Three-column layout */
.editor-layout {
  display: grid;
  grid-template-columns: 300px 1fr 350px;
  grid-template-rows: 60px 1fr;
  height: 100vh;
}

.video-panel { /* Left column */ }
.document-viewer { /* Center column */ }
.controls-panel { /* Right column */ }
.header-toolbar { /* Top row, spans all columns */ }
```

#### **Color System for Users**
```tsx
const USER_COLORS = {
  notary: '#FF6B6B',     // Coral Red
  signer1: '#4ECDC4',    // Turquoise  
  signer2: '#45B7D1',    // Sky Blue
  signer3: '#96CEB4',    // Sage Green
  signer4: '#FFEAA7',    // Soft Yellow
  signer5: '#DDA0DD',    // Plum
  signer6: '#98D8C8',    // Mint
  signer7: '#F7DC6F',    // Light Gold
  signer8: '#BB8FCE',    // Lavender
} as const;

// Tag visual styling
const getTagStyle = (user: SessionParticipant, isSelected: boolean) => ({
  backgroundColor: USER_COLORS[user.role],
  border: isSelected ? '3px solid #333' : '2px solid transparent',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: '14px',
  fontWeight: '600',
  color: '#fff',
  textShadow: '0 1px 2px rgba(0,0,0,0.3)',
  boxShadow: isSelected 
    ? '0 4px 12px rgba(0,0,0,0.3)' 
    : '0 2px 6px rgba(0,0,0,0.2)',
});
```

#### **Tag Visual States**
```tsx
// Tagging mode appearance
const TaggingModeTag = ({ tag, user }) => (
  <div className={getTagStyle(user, tag.isSelected)}>
    <span className="tag-icon">{getTagIcon(tag.type)}</span>
    <span className="tag-label">{getTagLabel(tag, user)}</span>
    {tag.isSelected && <ResizeHandles />}
  </div>
);

// Signing mode appearance  
const SigningModeTag = ({ tag, content }) => (
  <div className="content-container">
    {content ? (
      <CompletedContent content={content} />
    ) : (
      <InputField 
        type={tag.type}
        placeholder={getPlaceholder(tag.type)}
        onComplete={(value) => completeTag(tag.id, value)}
      />
    )}
  </div>
);
```

#### **Responsive Design Patterns**
```tsx
// Adaptive layout for different screen sizes
const useResponsiveLayout = () => {
  const [layout, setLayout] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  
  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      if (width < 768) setLayout('mobile');
      else if (width < 1200) setLayout('tablet');
      else setLayout('desktop');
    };
    
    window.addEventListener('resize', updateLayout);
    updateLayout();
    
    return () => window.removeEventListener('resize', updateLayout);
  }, []);
  
  return layout;
};

// Layout configurations
const LAYOUTS = {
  desktop: { columns: '300px 1fr 350px', showAll: true },
  tablet: { columns: '250px 1fr 300px', collapsibleSidebar: true },
  mobile: { columns: '1fr', stackedLayout: true }
};
```

### Performance Optimization

#### **Canvas Performance**
```tsx
// Efficient rendering for large documents
const useCanvasOptimization = () => {
  const [virtualizedTags, setVirtualizedTags] = useState<DocumentTag[]>([]);
  
  // Only render tags visible in current viewport
  const updateVisibleTags = useCallback((viewport: ViewportBounds) => {
    const visible = allTags.filter(tag => 
      isTagInViewport(tag, viewport)
    );
    setVirtualizedTags(visible);
  }, [allTags]);
  
  // Debounced rendering updates
  const debouncedRender = useMemo(
    () => debounce(updateVisibleTags, 16), // 60fps
    [updateVisibleTags]
  );
};

// Memory management for large sessions
const useMemoryOptimization = () => {
  // Cleanup unused resources
  useEffect(() => {
    const cleanup = () => {
      // Clear canvas cache
      fabric.Object.cache = {};
      // Garbage collect unused objects
      gc?.();
    };
    
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, []);
};
```

#### **Real-Time Optimization**
```tsx
// Efficient WebSocket message handling
const useWebSocketOptimization = () => {
  const messageQueue = useRef<WSMessage[]>([]);
  const processingRef = useRef(false);
  
  // Batch process messages to prevent UI blocking
  const processMessageBatch = useCallback(async () => {
    if (processingRef.current || messageQueue.current.length === 0) return;
    
    processingRef.current = true;
    const batch = messageQueue.current.splice(0, 10); // Process 10 at a time
    
    await Promise.all(batch.map(processMessage));
    
    processingRef.current = false;
    
    // Continue processing if more messages queued
    if (messageQueue.current.length > 0) {
      requestAnimationFrame(processMessageBatch);
    }
  }, []);
  
  // Throttled cursor updates
  const throttledCursorUpdate = useMemo(
    () => throttle((position: CursorPosition) => {
      sendWSMessage('cursor_moved', position);
    }, 100), // Max 10 updates per second
    []
  );
};
```

### Development Milestones

#### **Milestone 1: Core Foundation (Week 1-2)**
- [ ] **PDF Viewer Setup**
  - PDF.js integration and rendering
  - Basic navigation and zoom controls
  - Canvas overlay system with Fabric.js
  - Coordinate system calibration

- [ ] **Basic Tag System**
  - Tag placement on click
  - Simple drag and drop
  - Tag type selection
  - Visual styling and colors

- [ ] **State Management**
  - Zustand store configuration
  - Tag data persistence
  - Basic user management

#### **Milestone 2: Advanced Tagging (Week 3-4)**
- [ ] **Enhanced Tag Features**
  - Resize handles and visual feedback
  - Tag validation and error states
  - Multi-page tag management
  - Snap-to-grid functionality

- [ ] **Keyboard Shortcuts**
  - Hotkey system implementation
  - User switching (backtick, 1-9)
  - Tag placement shortcuts (A, S, I, etc.)
  - Navigation and editing shortcuts

- [ ] **User Experience**
  - Color-coded user assignments
  - Tag labeling and descriptions
  - Collision detection and warnings

#### **Milestone 3: Real-Time Collaboration (Week 5-6)**
- [ ] **WebSocket Integration**
  - Real-time tag synchronization
  - User presence indicators
  - Cursor tracking and display
  - Connection management and recovery

- [ ] **Collaboration Features**
  - Simultaneous multi-user editing
  - Conflict resolution system
  - Optimistic updates with rollback
  - Session state synchronization

- [ ] **Performance Optimization**
  - Canvas virtualization for large docs
  - Message batching and throttling
  - Memory management and cleanup

#### **Milestone 4: Live Signing Mode (Week 7-8)**
- [ ] **Mode Switching**
  - Tagging to signing mode transition
  - Content replacement system
  - Input field generation from tags
  - Profile data integration

- [ ] **Content Management**
  - Signature/initial image handling
  - Text input validation
  - Date picker integration
  - File upload during session

- [ ] **Real-Time Content Updates**
  - Live content replacement
  - Simultaneous editing across users
  - Visual progress indicators

#### **Milestone 5: Video Integration (Week 9)**
- [ ] **Video Session Setup**
  - Whereby.com API integration
  - Video layout and positioning
  - Audio communication handling
  - Session lifecycle management

- [ ] **Communication Features**
  - Text chat implementation
  - Video quality management
  - Audio/video fallback handling

#### **Milestone 6: Advanced Features (Week 10-11)**
- [ ] **Multi-Document Support**
  - Document switching interface
  - Cross-document state management
  - Bulk operations and controls

- [ ] **Enhanced Navigation**
  - Independent user scrolling
  - Sync users functionality
  - Progress tracking across docs
  - Bookmark and annotation system

- [ ] **Quality of Life Features**
  - Undo/redo system
  - Search and filter tags
  - Export and import configurations

#### **Milestone 7: Session Management (Week 12)**
- [ ] **Session Controls**
  - Start/stop session management
  - Participant joining workflow
  - Session completion and cleanup
  - Error recovery and reconnection

- [ ] **Final Integration**
  - Backend API integration
  - Database persistence
  - Audit logging implementation
  - Security and validation

#### **Milestone 8: Testing & Polish (Week 13-14)**
- [ ] **Comprehensive Testing**
  - Unit tests for all components
  - Integration tests for workflows
  - End-to-end session testing
  - Performance and load testing

- [ ] **UI/UX Polish**
  - Responsive design implementation
  - Accessibility compliance
  - Error handling and user feedback
  - Documentation and help system

### Integration Patterns

#### **API Integration**
```tsx
// React Query hooks for server communication
const useTagMutations = (sessionId: string) => {
  const queryClient = useQueryClient();
  
  const placeTag = useMutation({
    mutationFn: (tag: PlaceTagCommand) => 
      fetch(`/api/editor/session/${sessionId}/place-tag`, {
        method: 'POST',
        body: JSON.stringify(tag)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['tags', sessionId]);
    }
  });
  
  const updateTag = useMutation({
    mutationFn: ({ tagId, updates }: { tagId: string, updates: TagUpdate }) =>
      fetch(`/api/editor/session/${sessionId}/tag/${tagId}`, {
        method: 'PATCH', 
        body: JSON.stringify(updates)
      })
  });
  
  return { placeTag, updateTag };
};
```

#### **WebSocket Integration**
```tsx
// WebSocket hook for real-time features
const useWebSocket = (sessionId: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const sendMessage = useCallback((type: string, payload: any) => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type, payload, sessionId }));
    }
  }, [socket, sessionId]);
  
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000/editor/${sessionId}`);
    
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleIncomingMessage(message);
    };
    
    setSocket(ws);
    
    return () => {
      ws.close();
    };
  }, [sessionId]);
  
  return { sendMessage, isConnected };
};
```

#### **Error Boundary Integration**
```tsx
// Error handling for editor components
const EditorErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ErrorBoundary
      FallbackComponent={EditorErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Editor Error:', error, errorInfo);
        // Send to error reporting service
        reportError(error, { context: 'PDFEditor', ...errorInfo });
      }}
      onReset={() => {
        // Clear editor state and reconnect
        clearEditorState();
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

const EditorErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => (
  <div className="error-container">
    <h2>Editor Error</h2>
    <p>Something went wrong with the document editor.</p>
    <details>
      <summary>Error Details</summary>
      <pre>{error.message}</pre>
    </details>
    <button onClick={resetErrorBoundary}>
      Restart Editor
    </button>
  </div>
);
```

#### **Performance Metrics**
- **Page Load Time**: <3 seconds for document rendering
- **Tag Response Time**: <100ms for tag placement
- **Video Quality**: HD (720p minimum) with <100ms latency
- **Synchronization**: Real-time updates within 500ms

#### **User Experience Metrics**
- **Ease of Use**: Intuitive interface requiring minimal training
- **Accessibility**: WCAG 2.1 AA compliance
- **Browser Support**: Chrome, Firefox, Safari, Edge
- **Mobile Compatibility**: Responsive design for tablets

---

## Development Checkpoints

> **Note**: Complete these checkpoints rapidly through collaborative development. Mark each item as complete ✅ as we build together.

### 📊 Quick Progress Overview
- 🎯 **Checkpoint 1**: Core PDF Viewer & Tagging Foundation - **✅ COMPLETED** (18/18 tasks)
- 🎯 **Checkpoint 2**: Live Session Management - **✅ COMPLETED** (12/15 tasks)
- 🎯 **Checkpoint 3**: Real-Time Collaboration Engine - **✅ COMPLETED** (11/12 tasks)
- 🎯 **Checkpoint 4**: Video Integration - **✅ COMPLETED** (7/8 tasks)
- 🎯 **Checkpoint 5**: Content Management System - **🔄 In Progress** (0/10 tasks)
- 🎯 **Checkpoint 6**: Multi-Document Workflow - **⏳ Pending** (0/8 tasks)
- 🎯 **Checkpoint 7**: Session Completion & Distribution - **⏳ Pending** (0/6 tasks)

**Overall Progress: 48/77 tasks completed (62%)**

---

### 🎯 Checkpoint 1: Core PDF Viewer & Tagging Foundation
**Status: ✅ COMPLETED**

#### PDF Rendering System
- [x] Implement PDF.js document rendering
- [x] Create long-scroll multi-page view
- [x] Add zoom in/out functionality with coordinate scaling
- [x] Handle large documents (50+ PDFs, 100+ pages)
- [x] Implement coordinate precision system

#### Tagging Interface
- [x] Create tag placement system with drag & drop
- [x] Implement colored rectangle tags with labels
- [x] Ad tag type selection (signature, name, initial, etc.)
- [x] Create user assignment and color coding system
- [x] Build tag validation and persistence

#### Data Management
- [x] Design tag data structure and database schema
- [x] Implement tag CRUD operations
- [x] Create document state management
- [x] Build tag-to-user assignment system
- [x] Add tag export for live session

#### UI Components
- [x] Build tagging mode interface
- [x] Create tag placement tools
- [x] Add tag management controls
- [x] Implement document navigation

---

### 🎯 Checkpoint 2: Live Session Management
**Status: 🔄 In Progress**

#### Session Initialization
- [x] Create session start/stop controls
- [ ] Implement participant counter (invited vs joined)
- [ ] Build session waiting room
- [x] Add session state management
- [x] Create session transition from tagging to live

#### User Authentication & Profiles
- [x] Integrate user profile data loading
- [x] Implement session join via email/dashboard
- [x] Add ID verification integration
- [ ] Create user content loading from profiles
- [ ] Build in-session content upload

#### Interface Layout Management
- [x] Implement 3-column layout (video, document, controls)
- [x] Create responsive interface components
- [x] Add user role-based control visibility
- [x] Build session progress indicators
- [x] Create document switching interface

---

### 🎯 Checkpoint 3: Real-Time Collaboration Engine
**Status: ✅ COMPLETED**

#### WebSocket Infrastructure
- [x] Implement WebSocket server and client
- [x] Create real-time message handling
- [x] Build connection management and reconnection
- [x] Add performance optimization for large sessions

#### Content Synchronization
- [x] Implement keystroke-level synchronization
- [x] Create content placement/scaling sync
- [x] Build drag operation real-time updates
- [ ] Add undo/redo synchronization
- [x] Handle simultaneous editing conflicts

#### User State Management
- [x] Track individual user viewport positions
- [x] Implement "Sync Users" functionality
- [x] Create user activity indicators
- [x] Build multi-user session state

---

### 🎯 Checkpoint 4: Video Integration
**Status: ✅ COMPLETED**

#### Video Session Management
- [x] Integrate video API (Whereby.com or WebRTC)
- [x] Implement auto-start/stop video functionality
- [x] Create video UI components
- [x] Add video session controls

#### Communication Features
- [ ] Build text chat functionality
- [x] Implement audio communication handling
- [x] Create video quality management
- [x] Add communication UI components

---

### 🎯 Checkpoint 5: Content Management System
**Status: ⏳ Pending**

#### Interactive Content System  
- [ ] Build individual tag completion interface
- [ ] Create content-to-tag integration system
- [ ] Implement content scaling and positioning
- [ ] Add drag & drop for content manipulation
- [ ] Build undo/redo system

#### Content Types Handling
- [ ] Implement signature image handling
- [ ] Create text input management
- [ ] Add date/timestamp functionality
- [ ] Build initials and stamps system
- [ ] Create content validation system

---

### 🎯 Checkpoint 6: Multi-Document Workflow
**Status: ⏳ Pending**

#### Document Management
- [ ] Implement simultaneous multi-document signing
- [ ] Create document switching interface
- [ ] Build cross-document content state management
- [ ] Add document progress tracking

#### Content Persistence
- [ ] Maintain content across document switches
- [ ] Implement edit logging and audit trail
- [ ] Create document version management
- [ ] Build cross-document content validation

---

### 🎯 Checkpoint 7: Session Completion & Distribution
**Status: ⏳ Pending**

#### Session Finalization
- [ ] Build session approval workflow (notary only)
- [ ] Implement final PDF generation
- [ ] Create session cleanup processes

#### Document Distribution
- [ ] Build signer copy distribution to dashboard
- [ ] Implement witness exclusion from document copies
- [ ] Create admin review workflow

---

## Technical Architecture

### 📁 **File Organization & Modular Structure**
> **CRITICAL**: Maintain strict separation of concerns with individual files for each module/component. This ensures maintainability, testability, and collaborative development efficiency.

#### **Frontend File Structure**
```
client/src/
├── components/
│   └── editor/
│       ├── PDFTaggingEditor.tsx          # Main container component
│       ├── PDFViewer.tsx                 # PDF rendering & display
│       ├── TagLayer.tsx                  # Canvas overlay system
│       ├── TagRenderer.tsx               # Individual tag component
│       ├── TaggingToolbar.tsx            # Tag type selection tools
│       ├── ParticipantManager.tsx        # User management & colors
│       ├── HotkeyHandler.tsx             # Keyboard shortcut system
│       ├── CollaborationSync.tsx         # Real-time synchronization
│       ├── VideoIntegration.tsx          # Video session management
│       ├── DocumentNavigation.tsx        # Multi-page navigation
│       ├── SessionControls.tsx           # Session management UI
│       ├── TagCompletionModal.tsx        # Individual tag completion interface
│       └── NotaryLogManager.tsx          # Notary log interface
├── hooks/
│   └── editor/
│       ├── useEditorStore.ts             # Zustand store
│       ├── useWebSocket.ts               # WebSocket communication
│       ├── usePDFViewer.ts               # PDF viewer logic
│       ├── useTagManagement.ts           # Tag CRUD operations
│       ├── useKeyboardShortcuts.ts       # Hotkey handling
│       └── useCollaboration.ts           # Real-time sync logic
├── types/
│   └── editor/
│       ├── session.types.ts              # Session-related types
│       ├── tag.types.ts                  # Tag and content types
│       ├── participant.types.ts          # User/participant types
│       ├── document.types.ts             # PDF document types
│       └── websocket.types.ts            # Real-time message types
└── pages/
    ├── TaggingSession.tsx                # Tagging mode page
    ├── LiveSigningSession.tsx            # Live signing mode page
    └── SessionJoin.tsx                   # Participant join page
```

#### **Backend File Structure**
```
server/
├── routes/
│   └── editor/
│       ├── session-routes.ts            # Session management endpoints
│       ├── tag-routes.ts                # Tag CRUD endpoints
│       ├── content-routes.ts            # Content management endpoints
│       ├── participant-routes.ts        # Participant management
│       ├── notary-log-routes.ts         # Notary log endpoints
│       └── websocket-routes.ts          # Real-time WebSocket handling
├── services/
│   └── editor/
│       ├── SessionService.ts            # Session business logic
│       ├── TagService.ts                # Tag management logic
│       ├── PDFProcessingService.ts      # PDF manipulation
│       ├── ContentCompletionService.ts  # Individual content completion logic
│       ├── NotaryLogService.ts          # Notary log management
│       ├── AuditTrailService.ts         # Audit logging
│       └── WebSocketService.ts          # Real-time communication
├── types/
│   └── editor/
│       ├── session.types.ts             # Session data structures
│       ├── tag.types.ts                 # Tag definitions
│       ├── participant.types.ts         # User role definitions
│       ├── api.types.ts                 # API request/response types
│       └── database.types.ts            # Database schema types
├── middleware/
│   └── editor/
│       ├── session-auth.ts              # Session authentication
│       ├── role-validation.ts           # User role validation
│       └── websocket-auth.ts            # WebSocket authentication
└── database/
    └── migrations/
        ├── 001-editor-sessions.sql      # Session tables
        ├── 002-document-tags.sql        # Tag management tables
        ├── 003-session-participants.sql # Participant tables
        ├── 004-notary-log.sql           # Notary log tables
        └── 005-audit-trail.sql          # Audit logging tables
```

#### **Supabase-Specific Structure**
```
supabase/
├── migrations/
│   ├── 001_editor_sessions.sql          # Session management tables
│   ├── 002_document_tags.sql            # Tag and content tables  
│   ├── 003_session_participants.sql     # Participant management
│   ├── 004_notary_log_entries.sql       # Notary log tables
│   └── 005_rls_policies.sql             # Row Level Security policies
├── functions/
│   ├── complete_tag/
│   │   └── index.ts                     # Individual tag completion function
│   ├── session_management/
│   │   └── index.ts                     # Session lifecycle functions  
│   └── audit_logging/
│       └── index.ts                     # Audit trail functions
├── config.toml                          # Supabase configuration
└── seed.sql                             # Development seed data
```

#### **Development Guidelines**
- **One Component Per File**: Each React component in its own `.tsx` file
- **Separate Business Logic**: Services separated from routes and components
- **Type Safety**: Dedicated type files for each domain area
- **Modular Hooks**: Custom hooks for reusable logic patterns
- **Database Migrations**: Individual SQL files for each table/feature
- **API Endpoints**: Grouped by functionality with separate route files
- **Clear Naming**: Descriptive file names that indicate purpose and scope

### Frontend Stack
- **React + TypeScript**: Main UI framework with type safety
- **PDF.js**: Client-side PDF rendering and manipulation
- **WebSocket Client**: Real-time collaboration
- **Canvas/HTML Overlays**: Tag and content positioning system

### Backend Stack  
- **Node.js + Express**: API server and session management
- **WebSocket Server**: Real-time synchronization engine
- **Supabase**: Primary database (PostgreSQL) with real-time subscriptions
- **Redis**: Session state and real-time data caching

### External Integrations
- **Video API**: Whereby.com or WebRTC for video sessions
- **User Profiles**: Existing profile system integration
- **ID Verification**: Existing verification system
- **File Storage**: Document and content file management

---

## Implementation Flow & Current Focus

### Phase 1: Foundation (Current)
**🎯 Active Checkpoint**: Checkpoint 1 - Core PDF Viewer & Tagging Foundation
**🔧 Current Task**: Implementing PDF.js viewer with tag placement system
**📋 Next Steps**: 
1. PDF rendering with multi-page scroll
2. Tag placement drag & drop
3. Coordinate system implementation
4. Tag data persistence

### Phase 2: Live Session Core
**🎯 Target**: Checkpoints 2-3 - Session management + real-time collaboration
**🔧 Focus**: WebSocket synchronization + user session management

### Phase 3: Integration & Polish  
**🎯 Target**: Checkpoints 4-7 - Video integration + content management + completion

---

## Session Workflow Requirements

### Pre-Session Phase
1. **Document Upload**
   - PDF validation and processing
   - File size and quantity limits (50 files max)
   - Virus scanning and security checks
   - Document preview generation

2. **Participant Setup**
   - Signer profile creation and validation
   - Notary assignment and verification
   - Observer registration (optional)
   - Contact information collection

3. **Tagging Session**
   - Document preparation by notary/admin
   - **Temporary tag placement** as visual placeholders for all required fields
   - Tag position validation and user assignment
   - Tagged document saved for live signing session

### Live Session Phase
1. **Session Initialization**
   - Video conference room creation
   - Document loading and synchronization
   - Participant authentication
   - System readiness verification

2. **Participant Admission**
   - Waiting room management
   - Audio/video testing
   - Identity verification confirmation
   - Session rules explanation

3. **Document Processing**
   - **Tag replacement**: Placeholders replaced with actual content (signatures, names, etc.)
   - Collaborative content completion
   - Real-time synchronization of content updates
   - Progress tracking of tag completion
   - Quality assurance checks

4. **Session Completion**
   - Final validation of all tags
   - Document generation and signing
   - Digital certificate application
   - Session archival

### Post-Session Phase
1. **Document Delivery**
   - PDF generation with all overlays
   - Digital certificate application
   - File naming and organization
   - Client notification and delivery

2. **Record Keeping**
   - Notary log finalization
   - Audit trail completion
   - Video archival
   - Long-term storage setup

---

## Technical Implementation Details

### PDF Handling
- **Rendering**: PDF.js for client-side rendering
- **View**: Long scroll for multi-page documents
- **Zoom**: Full zoom in/out with coordinate scaling
- **Overlay**: HTML/CSS overlays for tags and content

### Real-Time Synchronization
- **Technology**: WebSockets for live updates
- **Frequency**: Every keystroke synchronization
- **Throttling**: Debounced updates to prevent server overload
- **Conflict Resolution**: Last-write-wins with user session management

### State Management
- **Tagging Phase**: Store tag positions and metadata only
- **Live Signing**: Load content from user profiles + allow real-time modifications
- **Data Flow**: Job creation → Tagging (placeholders) → Live session (real content) → Final PDF
- **Session Management**: Individual user sessions with shared document state
- **Content Source**: User profiles (primary) + live session uploads (secondary)
- **Replace Mechanism**: Instant replacement of all content with single notary action

### Content Scaling & Positioning
- **Scaling**: Relative to document zoom level
- **Positioning**: Absolute coordinates with drag-and-drop
- **Cross-Page**: Tags/content can span multiple pages
- **Boundaries**: No action if content placed outside PDF boundaries

### Infrastructure Requirements
- **Storage**: High-capacity for documents and videos
- **CDN**: Fast document delivery
- **Load Balancer**: High availability
- **Backup System**: Automated backup and recovery
- **Monitoring**: Application and infrastructure monitoring

### External Integrations
- **Whereby.com**: Video conferencing platform
- **Identrust**: Digital certificate provider (PFX file handling with password)
- **ID Verification Service**: Automated identity verification
- **KBA Provider**: Knowledge-based authentication
- **Email Service**: SMTP for notifications

### Notary Log & Audit System

#### **Notary Log Implementation**
- **Temporary Storage**: All log entries stored in temporary database during session
- **Entry Creation**: Automatic entry for each seal placement with:
  - Notarization type (Jurat, Acknowledgment, Copy Certification)
  - Signer information (selected via checkbox list)
  - Document page and location
  - Timestamp and notary details
- **Permanent Transfer**: Move all entries from temp to permanent log at session completion
- **State-Specific Types**: Configurable notarization types based on notary's state commission
- **Manual Editing**: Notary can edit log outside of sessions via separate interface

#### **Notary Seal Popup Workflow**
When notary places "E - Seal" tag:
1. **Popup Appears** with two input selectors:
   - **Dropdown Menu**: Notarization type selection (state-specific options)
   - **Checkbox List**: Select applicable signers for this notarization
2. **Database Entry**: For EACH selected signer, create temporary log entry
3. **Audit Update**: Update audit trail with notarization type, page number, timestamp

#### **Digital Certificate Integration**
- **File Format**: PFX certificate files with password protection
- **Application Process**: Apply certificate to completed PDF after all content finalized
- **Tamper Evidence**: Final PDF becomes tamper-evident after certificate application
- **Document Naming**: Completed documents get "-complete" suffix
- **Storage**: Secure certificate storage with password management

### File Format Requirements

#### **Signature Files**
- **Format**: Transparent GIF files only
- **Size Limits**: Maximum 2MB per signature file
- **Dimensions**: Recommended 300x100 pixels, scalable during session
- **Background**: Must be transparent for proper overlay

#### **Document Files**
- **Format**: PDF files only
- **Quantity Limit**: Maximum 50 PDF files per session
- **Size Limit**: Maximum 25MB per PDF file
- **Page Limit**: No limit on pages per PDF
- **Version**: PDF 1.4 or higher compatibility

#### **Profile Content Requirements**
- **Names**: UTF-8 text, 100 character limit
- **Initials**: Transparent GIF, maximum 1MB
- **Commission Data**: Alphanumeric, state-specific format validation

---

## 🚀 Development Notes & Decisions

> **Live collaboration notes**: Add our decisions, challenges, and solutions here as we build together.

### Development Session Log
- **Started**: Initial checkpoint setup complete with comprehensive task flows
- **Next Steps**: Begin with Checkpoint 1 - Core Document Editor Foundation

### Technical Decisions Made
- [ ] Framework Selection: React + TypeScript
- [ ] PDF Library: PDF.js for client-side rendering
- [ ] State Management: Context API with WebSocket integration
- [ ] Database: PostgreSQL schema design
- [ ] Real-time Updates: WebSocket implementation with debouncing

### Architecture Decisions
- [ ] Component structure for PDF viewer
- [ ] **Tag rendering approach**: Placeholder visualization (tagging) vs content replacement (live signing)
- [ ] Coordinate system implementation for tag positioning
- [ ] User session management across tagging → live signing workflow
- [ ] Tag-to-content replacement mechanism

### Current Focus
**🎯 Active Checkpoint**: Checkpoint 1 - Core Document Editor Foundation
**🔧 Current Task**: Implementing PDF.js viewer with **dual-mode functionality**
**📋 Workflow Understanding**: 
- **Tagging Mode**: Placeholder tag placement by notary
- **Live Signing Mode**: Real content from profiles + instant replacement
- **Key Insight**: Tags are temporary markers, live session shows actual content

### Live Signing Flow Confirmed
1. **Job Page** → "Start Tagging" → "Start Session" buttons
2. **Tagging**: Notary places colored placeholder tags
3. **Live Session**: Auto-load documents, auto-start video, content from profiles
4. **Interface**: Video (left) + Document (middle) + Controls (right)
5. **Interactive Completion**: Users click on their assigned tags to complete content individually
6. **Real-Time**: Everything resizable, draggable, undoable with live sync

---

## API Endpoints & Database Schema

### Core API Endpoints

#### **Session Management**
- `POST /api/editor/create-session` - Create new tagging or live session
- `GET /api/editor/session/{sessionId}` - Get session details and state
- `POST /api/editor/session/{sessionId}/start` - Start live signing session
- `POST /api/editor/session/{sessionId}/join` - Join session as participant
- `POST /api/editor/session/{sessionId}/leave` - Leave session
- `POST /api/editor/session/{sessionId}/complete` - Complete and finalize session
- `GET /api/editor/session/{sessionId}/participants` - Get participant status

#### **Tag Management**
- `POST /api/editor/session/{sessionId}/place-tag` - Place tag on document
- `PUT /api/editor/session/{sessionId}/tag/{tagId}` - Update tag properties
- `DELETE /api/editor/session/{sessionId}/tag/{tagId}` - Delete tag
- `GET /api/editor/session/{sessionId}/document/{documentId}/tags` - Get document tags
- `POST /api/editor/session/{sessionId}/tag/{tagId}/complete` - Complete individual tag with content

#### **Content Management**
- `POST /api/editor/session/{sessionId}/upload-content` - Upload signature/initial during session
- `PUT /api/editor/session/{sessionId}/content/{contentId}` - Update content properties
- `POST /api/editor/session/{sessionId}/sync-users` - Sync all users to notary view

#### **Notary & Audit**
- `GET /api/editor/session/{sessionId}/notary-log` - Get notary log entries
- `POST /api/editor/session/{sessionId}/place-seal` - Place notary seal with popup
- `GET /api/editor/session/{sessionId}/audit-trail` - Get complete audit trail
- `POST /api/editor/generate-final-pdf` - Generate completed PDF with certificates

### Database Schema & Supabase Integration

#### **🗄️ Supabase Configuration**
```javascript
// supabase/client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Real-time subscriptions for editor
export const subscribeToEditorChanges = (sessionId: string, callback: Function) => {
  return supabase
    .from('document_tags')
    .on('*', payload => callback(payload))
    .filter('session_id', 'eq', sessionId)
    .subscribe()
}
```

#### **📋 Supabase Migration Files**
> **Important**: Use Supabase CLI or dashboard SQL editor to run these migrations

**Migration 1: Editor Sessions Table**
```sql
-- File: supabase/migrations/001_editor_sessions.sql
CREATE TABLE editor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL,
    session_type TEXT NOT NULL CHECK (session_type IN ('tagging', 'live_signing')),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'in_progress', 'completed', 'cancelled')),
    notary_id UUID NOT NULL,
    video_session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    CONSTRAINT fk_editor_sessions_job_id FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    CONSTRAINT fk_editor_sessions_notary_id FOREIGN KEY (notary_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE editor_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for editor_sessions
CREATE POLICY "Notaries can view their own sessions" ON editor_sessions
    FOR SELECT USING (notary_id = auth.uid());

CREATE POLICY "Notaries can create sessions" ON editor_sessions
    FOR INSERT WITH CHECK (notary_id = auth.uid());

CREATE POLICY "Notaries can update their own sessions" ON editor_sessions
    FOR UPDATE USING (notary_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_editor_sessions_job_id ON editor_sessions(job_id);
CREATE INDEX idx_editor_sessions_notary_id ON editor_sessions(notary_id);
CREATE INDEX idx_editor_sessions_status ON editor_sessions(status);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE editor_sessions;
```

**Migration 2: Document Tags Table**
```sql
-- File: supabase/migrations/002_document_tags.sql
CREATE TABLE document_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES editor_sessions(id) ON DELETE CASCADE,
    document_id UUID NOT NULL,
    tag_type TEXT NOT NULL CHECK (tag_type IN ('A', 'S', 'I', 'N', 'X', 'O', 'E', 'W', 'T', 'D')),
    assigned_user_id UUID,
    coordinates JSONB NOT NULL, -- {x, y, width, height, pageNumber}
    page_number INTEGER NOT NULL,
    display_label VARCHAR(255),
    color_code VARCHAR(7),
    is_completed BOOLEAN DEFAULT FALSE,
    content_data JSONB, -- Actual content when replaced
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_document_tags_session_id FOREIGN KEY (session_id) REFERENCES editor_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_document_tags_user_id FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;

-- Policies for document_tags
CREATE POLICY "Users can view tags in their sessions" ON document_tags
    FOR SELECT USING (
        session_id IN (
            SELECT es.id FROM editor_sessions es
            JOIN session_participants sp ON sp.session_id = es.id
            WHERE sp.user_id = auth.uid() OR es.notary_id = auth.uid()
        )
    );

CREATE POLICY "Notaries can manage all tags in their sessions" ON document_tags
    FOR ALL USING (
        session_id IN (
            SELECT id FROM editor_sessions WHERE notary_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own tags" ON document_tags
    FOR UPDATE USING (assigned_user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_document_tags_session_id ON document_tags(session_id);
CREATE INDEX idx_document_tags_document_id ON document_tags(document_id);
CREATE INDEX idx_document_tags_user_id ON document_tags(assigned_user_id);
CREATE INDEX idx_document_tags_type ON document_tags(tag_type);
CREATE INDEX idx_document_tags_page ON document_tags(page_number);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_tags_updated_at BEFORE UPDATE
    ON document_tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE document_tags;
```

**Migration 3: Session Participants Table**
```sql
-- File: supabase/migrations/003_session_participants.sql
CREATE TABLE session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES editor_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('notary', 'signer', 'witness')),
    status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'joined', 'active', 'disconnected')),
    current_page INTEGER DEFAULT 1,
    current_document_id UUID,
    joined_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraints
    CONSTRAINT fk_session_participants_session_id FOREIGN KEY (session_id) REFERENCES editor_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_session_participants_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate participants
    UNIQUE(session_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

-- Policies for session_participants
CREATE POLICY "Users can view participants in their sessions" ON session_participants
    FOR SELECT USING (
        user_id = auth.uid() OR 
        session_id IN (SELECT id FROM editor_sessions WHERE notary_id = auth.uid())
    );

CREATE POLICY "Notaries can manage participants in their sessions" ON session_participants
    FOR ALL USING (
        session_id IN (SELECT id FROM editor_sessions WHERE notary_id = auth.uid())
    );

CREATE POLICY "Users can update their own participant status" ON session_participants
    FOR UPDATE USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX idx_session_participants_user_id ON session_participants(user_id);
CREATE INDEX idx_session_participants_status ON session_participants(status);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;
```

**Migration 4: Notary Log Entries Table**
```sql
-- File: supabase/migrations/004_notary_log_entries.sql
CREATE TABLE notary_log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES editor_sessions(id) ON DELETE CASCADE,
    notary_id UUID NOT NULL,
    signer_id UUID NOT NULL,
    document_id UUID NOT NULL,
    notarization_type TEXT NOT NULL CHECK (notarization_type IN ('jurat', 'acknowledgment', 'copy_certification')),
    page_number INTEGER NOT NULL,
    seal_coordinates JSONB,
    is_temporary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    finalized_at TIMESTAMP WITH TIME ZONE,
    
    -- Foreign key constraints
    CONSTRAINT fk_notary_log_session_id FOREIGN KEY (session_id) REFERENCES editor_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_notary_log_notary_id FOREIGN KEY (notary_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notary_log_signer_id FOREIGN KEY (signer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE notary_log_entries ENABLE ROW LEVEL SECURITY;

-- Policies for notary_log_entries
CREATE POLICY "Notaries can view their own log entries" ON notary_log_entries
    FOR SELECT USING (notary_id = auth.uid());

CREATE POLICY "Notaries can create log entries in their sessions" ON notary_log_entries
    FOR INSERT WITH CHECK (
        notary_id = auth.uid() AND
        session_id IN (SELECT id FROM editor_sessions WHERE notary_id = auth.uid())
    );

CREATE POLICY "Notaries can update their own log entries" ON notary_log_entries
    FOR UPDATE USING (notary_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_notary_log_session_id ON notary_log_entries(session_id);
CREATE INDEX idx_notary_log_notary_id ON notary_log_entries(notary_id);
CREATE INDEX idx_notary_log_signer_id ON notary_log_entries(signer_id);
CREATE INDEX idx_notary_log_document_id ON notary_log_entries(document_id);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE notary_log_entries;
```

### User Roles & Permissions Matrix

#### **Notary Permissions**
- ✅ Start/stop sessions
- ✅ Place all tag types
- ✅ Complete any tag content
- ✅ Sync users
- ✅ Access all documents
- ✅ Control video session
- ✅ Approve final documents
- ✅ Access audit trail
- ✅ Bypass ID verification

#### **Signer Permissions**
- ✅ Join assigned sessions
- ✅ View assigned documents
- ✅ Modify own content (signatures, names, initials)
- ✅ Upload new signatures during session
- ✅ Navigate documents independently
- ❌ Place/delete tags
- ❌ Access other users' content
- ❌ Control session flow

#### **Witness Permissions**
- ✅ Join assigned sessions
- ✅ View all documents
- ✅ Navigate documents independently
- ❌ Modify any content
- ❌ Place tags
- ❌ Receive final document copies

#### **Admin Permissions**
- ✅ Create tagging sessions
- ✅ Place tags during tagging phase
- ✅ Access all sessions
- ✅ Manual review of completed documents
- ❌ Control live signing sessions (notary only)

### Error Handling & User Feedback

#### **Connection Errors**
- **WebSocket Disconnection**: Auto-reconnect with exponential backoff
- **Video Connection Issues**: Continue document session, show connection status
- **Upload Failures**: Retry mechanism with progress indication
- **Session Timeout**: 30-minute idle timeout with warning at 25 minutes

#### **Content Validation Errors**
- **Invalid Signature Format**: "Please upload a transparent GIF file under 2MB"
- **Oversized Files**: "File too large. Maximum size is 25MB for PDFs, 2MB for signatures"
- **Missing Required Content**: "Please complete all required fields before finalizing"
- **Coordinate Boundary**: Silent handling - no action if dragged outside PDF bounds

#### **User Feedback Messages**
- **Tag Placement**: "Tag placed successfully for [User Name]"
- **Content Replacement**: "All content has been applied to the document"
- **Session Progress**: "3 of 8 participants have completed their sections"
- **Save Status**: "Document saved automatically" (with timestamp)

### Performance Requirements & Monitoring

#### **Response Time Requirements**
- **Tag Placement**: < 100ms response time
- **Document Loading**: < 3 seconds for PDFs up to 25MB
- **Real-time Sync**: < 500ms for content updates
- **Video Quality**: 720p minimum, < 100ms latency
- **Concurrent Sessions**: Support 100 simultaneous live sessions

#### **Monitoring & Alerting**
- **Server Health**: CPU, memory, disk usage alerts
- **Session Metrics**: Active sessions, completion rates, error rates
- **Performance Alerts**: Response time > 1 second, sync delay > 1 second
- **Security Monitoring**: Failed authentication attempts, suspicious activity
- **Uptime Target**: 99.9% availability requirement

### Security Protocols & Compliance

#### **Data Encryption**
- **In Transit**: TLS 1.3 for all communications
- **At Rest**: AES-256 encryption for all stored documents
- **WebSocket**: WSS (WebSocket Secure) for real-time communication
- **Certificates**: Encrypted storage for notary PFX files

#### **Access Control**
- **Session-Based Authentication**: JWT tokens with 2-hour expiration
- **Role-Based Access Control (RBAC)**: Enforced at API and UI levels
- **IP Restrictions**: Optional IP whitelisting for notary sessions
- **Device Verification**: Optional device fingerprinting

#### **Backup & Recovery**
- **Database Backups**: Hourly incremental, daily full backups
- **Document Storage**: Real-time replication across multiple zones
- **Video Storage**: Redundant storage with 10-year retention
- **Recovery Time Objective**: < 1 hour for critical systems
- **Recovery Point Objective**: < 15 minutes data loss maximum

---

This comprehensive task-based requirements document provides a complete implementation roadmap organized around specific workflows and actionable development tasks, while maintaining all detailed specifications, use cases, edge cases, compliance requirements, technical implementation details, API documentation, database schemas, and operational procedures for efficient collaborative development of the Digital Notary Editor system. 

### User Roles & Permissions Matrix

#### **🚀 Supabase Deployment & Migration Guide**

**Environment Setup**

# Create new migration
supabase migration new editor_system_setup
```

**Migration Deployment**
```bash
# Apply migrations to local development
supabase db reset

# Push to staging
supabase db push --db-url postgresql://user:pass@db.staging.supabase.co:5432/postgres

# Push to production
supabase db push --db-url postgresql://user:pass@db.production.supabase.co:5432/postgres
```

**Real-Time Configuration**
```javascript
// Enable real-time for all editor tables
const enableRealtimeForEditor = async () => {
  const tables = [
    'editor_sessions',
    'document_tags', 
    'session_participants',
    'notary_log_entries'
  ];
  
  for (const table of tables) {
    await supabase.rpc('alter_publication_add_table', {
      publication_name: 'supabase_realtime',
      table_name: table
    });
  }
};
```

**Supabase Edge Functions for Complex Operations**
```sql
-- File: supabase/functions/complete_tag/index.ts
CREATE OR REPLACE FUNCTION complete_individual_tag(
  tag_id_param UUID,
  content_data JSONB,
  completed_by_param UUID
) RETURNS JSONB AS $$
DECLARE
  updated_tag RECORD;
BEGIN
  -- Update individual tag with content
  UPDATE document_tags 
  SET 
    content_data = content_data,
    is_completed = TRUE,
    completed_by = completed_by_param,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = tag_id_param
  RETURNING * INTO updated_tag;
  
  RETURN to_jsonb(updated_tag);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Security Configuration**
```sql
-- Additional security functions for session validation
CREATE OR REPLACE FUNCTION auth.is_session_participant(session_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM session_participants sp
    JOIN editor_sessions es ON es.id = sp.session_id
    WHERE sp.session_id = session_id_param 
    AND (sp.user_id = auth.uid() OR es.notary_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can modify tags
CREATE OR REPLACE FUNCTION auth.can_modify_tag(tag_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM document_tags dt
    JOIN editor_sessions es ON es.id = dt.session_id
    WHERE dt.id = tag_id_param 
    AND (dt.assigned_user_id = auth.uid() OR es.notary_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Environment Variables**
```env
# Add to your .env file
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For real-time subscriptions
NEXT_PUBLIC_ENABLE_REALTIME=true
REALTIME_EVENTS_PER_SECOND=10
```

#### **Notary Permissions**
```

#### **Supabase Client Structure**
```
client/src/
├── lib/
│   ├── supabase/
│   │   ├── client.ts                     # Supabase client configuration
│   │   ├── auth.ts                       # Authentication helpers
│   │   ├── realtime.ts                   # Real-time subscriptions
│   │   └── types.ts                      # Supabase-generated types
│   └── editor/
│       ├── supabase-queries.ts           # Editor-specific queries
│       └── supabase-subscriptions.ts     # Real-time subscriptions