# Multi-Document Tagging System

This guide explains how the enhanced multi-document tagging system works in the USA Notary platform.

## Overview

The platform now supports tagging multiple documents within a single session. Users can switch between documents using a dropdown selector while maintaining separate tag states for each document.

## Key Features

### 1. Document Selector
- **Location**: Top header of the tagging interface
- **Functionality**: Dropdown showing all documents in the session
- **Progress Tracking**: Shows tagging completion percentage for each document
- **Overall Progress**: Displays summary progress across all documents

### 2. Per-Document Tag Management
- **Isolated Tags**: Each document maintains its own set of tags
- **Automatic Loading**: Tags are loaded automatically when switching documents
- **State Preservation**: Tag progress is preserved when switching between documents

### 3. Progress Indicators
- **Individual Progress**: Each document shows completion percentage
- **Visual Indicators**: Color-coded badges (green=complete, yellow=partial, gray=not started)
- **Overall Summary**: Progress bar showing total completion across all documents

## How It Works

### Document Switching Flow
1. User selects document from dropdown
2. System switches to new document and clears current view
3. Tags for the new document are loaded from backend
4. PDF viewer displays the new document
5. Tag layer shows only tags for current document

### Tag Management
- **Placement**: Tags are placed only on the currently selected document
- **Storage**: Each tag is linked to its specific document via `documentId`
- **Filtering**: UI automatically filters tags to show only current document's tags

### Data Structure
```typescript
interface DocumentTag {
  id: string;
  documentId: string;  // Links tag to specific document
  sessionId: string;   // Links to tagging session
  tagType: TagType;
  coordinates: TagCoordinates;
  isCompleted: boolean;
  // ... other fields
}
```

## User Experience

### Single Document Mode
- When only one document exists, the selector shows as a simple info card
- No dropdown functionality is shown
- Interface remains clean and uncluttered

### Multiple Document Mode  
- Document selector appears as a dropdown in the header
- Current document is highlighted with a checkmark
- Progress indicators help users track completion status
- Seamless switching between documents

### Visual Design
- **Clean Header**: Document selector integrates smoothly with existing UI
- **Progress Feedback**: Clear visual indicators of completion status
- **Responsive Layout**: Adapts to different screen sizes
- **Consistent Styling**: Follows existing design patterns

## Technical Implementation

### Frontend Components
- **DocumentSelector**: Main dropdown component with progress tracking
- **PDFTaggingEditor**: Enhanced to handle document switching
- **useEditorStore**: Updated with per-document tag management methods

### Backend Support
- **Existing Routes**: Uses existing `/api/editor/session/:sessionId/tags` with `documentId` filter
- **TagService**: Enhanced with document-specific tag operations
- **Database**: Existing schema already supports multi-document via `documentId` field

### State Management
- **Document Switching**: `switchToDocument()` method handles clean transitions
- **Tag Loading**: `loadTagsForDocument()` loads tags for specific documents
- **Progress Calculation**: Real-time calculation of completion percentages

## Usage Examples

### Basic Usage
```typescript
// Switch to a different document
handleDocumentChange(newDocument);

// Get tags for current document only
const currentTags = getCurrentDocumentTags();

// Load tags for specific document
await loadTagsForDocument(documentId);
```

### Progress Tracking
```typescript
// Calculate completion percentage
const progress = (completedTags / totalTags) * 100;

// Check if all documents are complete
const allComplete = documents.every(doc => 
  getDocumentProgress(doc.id).percentage === 100
);
```

## Benefits

1. **Improved Workflow**: Users can efficiently tag multiple documents in one session
2. **Clear Progress Tracking**: Visual indicators help users understand completion status
3. **Preserved State**: Tag progress is maintained when switching between documents
4. **Scalable Design**: System handles any number of documents per session
5. **Seamless Integration**: Built on existing architecture with minimal changes

## Future Enhancements

- **Bulk Operations**: Apply tags across multiple documents
- **Template System**: Save tag layouts for reuse across documents
- **Advanced Progress**: More detailed completion analytics
- **Document Reordering**: Allow users to change document order
- **Quick Navigation**: Keyboard shortcuts for document switching 