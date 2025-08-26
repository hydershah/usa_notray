# Enhanced Text Tag Editing Implementation

## Overview

This document describes the implementation of enhanced text tag editing functionality that allows users to click on text input tags, enter data in edit mode, and automatically save the data to the database.

## Features

### Core Functionality
- **Click to Edit**: Text tags become editable when clicked
- **Real-time Input**: Users can type text content directly on the document
- **Auto-save**: Content is automatically saved when the input loses focus
- **Manual Save/Cancel**: Explicit save and cancel buttons for better UX
- **Database Persistence**: All text content is saved to the database
- **Real-time Sync**: Changes are broadcasted to all session participants

### User Experience Enhancements
- **Visual Feedback**: Loading states, error indicators, and status messages
- **Keyboard Shortcuts**: Enter to save, Escape to cancel
- **Smart Validation**: Prevents saving unchanged content
- **Error Handling**: Clear error messages and recovery options
- **Accessibility**: Proper focus management and screen reader support

## Architecture

### Components

#### 1. `useTextTagEditing` Hook
A custom React hook that manages all text tag editing state and logic.

**Location**: `client/src/hooks/editor/useTextTagEditing.ts`

**Key Features**:
- State management for editing, saving, and error states
- API integration for saving content to the database
- Event handlers for keyboard and mouse interactions
- Toast notifications for user feedback

**Usage**:
```typescript
const textEditing = useTextTagEditing({
  tag,
  sessionId: session?.id,
  currentUserId: currentUser?.userId,
  onTagClick
});
```

#### 2. Enhanced `TagLayer` Component
The main component that renders tags and handles text editing interactions.

**Location**: `client/src/components/editor/TagLayer.tsx`

**Key Features**:
- Integration with the text editing hook
- Enhanced visual feedback for text tags
- Improved click handling for text tags
- Status indicators for different tag states

#### 3. Database API Endpoint
Server-side endpoint for saving text tag content.

**Location**: `server/routes.ts` (line ~11380)

**Endpoint**: `PUT /api/editor/session/:sessionId/tag/:tagId/content`

**Features**:
- Content validation and sanitization
- Database updates with proper error handling
- Real-time WebSocket broadcasting
- Audit logging and security checks

## Implementation Details

### Text Tag State Management

The `useTextTagEditing` hook manages several key states:

```typescript
interface TextEditingState {
  isEditingText: boolean;      // Whether the tag is currently being edited
  textInputValue: string;      // Current input value
  isSaving: boolean;           // Whether a save operation is in progress
  saveError: string | null;    // Any error that occurred during saving
  textInputRef: RefObject<HTMLInputElement>; // Reference to the input element
}
```

### Content Saving Flow

1. **User clicks text tag** → `startEditing()` is called
2. **Input becomes focused** → User can type content
3. **Content changes** → `handleTextInputChange()` updates local state
4. **Save triggered** → Either by blur event, Enter key, or manual save button
5. **API call made** → Content sent to server via `PUT /api/editor/session/:sessionId/tag/:tagId/content`
6. **Database updated** → Tag content and completion status updated
7. **Real-time sync** → WebSocket message broadcasted to all session participants
8. **UI updated** → Tag shows new content and completion status

### Database Schema

Text tag content is stored in the `document_tags` table:

```sql
-- Key fields for text tags
content: text,                    -- The actual text content
contentType: text,               -- Always 'text' for text tags
contentData: text,               -- JSON string with metadata
isCompleted: boolean,            -- Whether the tag has content
completedBy: integer,            -- User ID who completed the tag
completedAt: timestamp,          -- When the tag was completed
```

### Security and Permissions

Text tag editing is controlled by several permission checks:

1. **User Authentication**: Valid JWT token required
2. **Session Access**: User must be part of the editing session
3. **Tag Assignment**: User can edit tags assigned to them
4. **Role-based Access**: Notaries and admins can edit most tags
5. **Universal Tags**: Text tags (T) are generally editable by session participants

## Usage Examples

### Basic Text Tag Editing

```typescript
// In a component that renders text tags
const textEditing = useTextTagEditing({
  tag: documentTag,
  sessionId: 'session-123',
  currentUserId: 'user-456',
  onTagClick: (updatedTag) => {
    // Handle tag updates
    console.log('Tag updated:', updatedTag);
  }
});

// The hook provides all necessary state and handlers
return (
  <input
    ref={textEditing.textInputRef}
    value={textEditing.textInputValue}
    onChange={textEditing.handleTextInputChange}
    onKeyDown={textEditing.handleKeyDown}
    onBlur={textEditing.handleBlur}
  />
);
```

### Custom Save Logic

```typescript
const customSave = async () => {
  const success = await textEditing.saveTextContent();
  if (success) {
    // Custom success handling
    showCustomSuccessMessage();
  } else {
    // Custom error handling
    showCustomErrorMessage();
  }
};
```

## API Reference

### `useTextTagEditing` Hook

#### Props
- `tag: DocumentTag` - The text tag to edit
- `sessionId?: string` - Current session ID
- `currentUserId?: string | number` - Current user's ID
- `onTagClick?: (tag: DocumentTag) => void` - Callback when tag is updated

#### Return Value
```typescript
{
  // State
  isEditingText: boolean;
  textInputValue: string;
  isSaving: boolean;
  saveError: string | null;
  textInputRef: RefObject<HTMLInputElement>;
  
  // Computed values
  canEdit: boolean;
  hasChanges: boolean;
  isReadyToSave: boolean;
  
  // Actions
  startEditing: () => void;
  stopEditing: () => void;
  saveTextContent: () => Promise<boolean>;
  cancelEditing: () => void;
  
  // Event handlers
  handleTextInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  handleBlur: () => void;
}
```

### Database API Endpoint

#### Request
```http
PUT /api/editor/session/:sessionId/tag/:tagId/content
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "content": "User entered text",
  "completedBy": "user-id",
  "completedAt": "2025-01-27T10:00:00.000Z"
}
```

#### Response
```json
{
  "success": true,
  "tag": {
    "id": "123",
    "content": "User entered text",
    "isCompleted": true,
    "completedBy": "user-id",
    "completedAt": "2025-01-27T10:00:00.000Z"
  },
  "message": "Tag content updated successfully"
}
```

## Error Handling

### Common Error Scenarios

1. **Network Errors**: Connection failures during save operations
2. **Permission Errors**: User lacks permission to edit specific tags
3. **Validation Errors**: Invalid content or malformed requests
4. **Database Errors**: Server-side database operation failures

### Error Recovery

- **Automatic Retry**: Save operations can be retried manually
- **Error Display**: Clear error messages shown to users
- **State Preservation**: User input is preserved during errors
- **Graceful Degradation**: UI remains functional even with errors

## Performance Considerations

### Optimization Strategies

1. **Debounced Updates**: Text input changes don't trigger immediate saves
2. **Lazy Loading**: Toast notifications loaded only when needed
3. **Efficient Re-renders**: Minimal component re-renders during editing
4. **Memory Management**: Proper cleanup of event listeners and refs

### Scalability

- **WebSocket Broadcasting**: Efficient real-time updates for multiple users
- **Database Indexing**: Optimized queries for tag content updates
- **Caching**: Smart cache invalidation for updated tags
- **Batch Operations**: Support for bulk tag updates when needed

## Testing

### Demo Component

A comprehensive demo component is available at:
`client/src/components/examples/TextTagEditingDemo.tsx`

This component demonstrates all features and can be used for:
- Manual testing of functionality
- UI/UX review and feedback
- Development and debugging
- User training and documentation

### Testing Scenarios

1. **Basic Editing**: Click tag, type text, save
2. **Keyboard Navigation**: Enter to save, Escape to cancel
3. **Auto-save**: Type text, click elsewhere to trigger blur save
4. **Error Handling**: Simulate network failures and permission errors
5. **Real-time Sync**: Test with multiple users in same session

## Future Enhancements

### Planned Features

1. **Rich Text Editing**: Support for formatting, bold, italic, etc.
2. **File Attachments**: Allow attaching documents to text tags
3. **Version History**: Track changes and allow rollbacks
4. **Collaborative Editing**: Real-time collaborative text editing
5. **Advanced Validation**: Custom validation rules and constraints

### Technical Improvements

1. **Offline Support**: Save content locally when offline
2. **Conflict Resolution**: Handle concurrent edits from multiple users
3. **Performance Monitoring**: Track and optimize save operation performance
4. **Accessibility**: Enhanced screen reader and keyboard navigation support

## Troubleshooting

### Common Issues

1. **Tag not becoming editable**: Check user permissions and tag assignment
2. **Content not saving**: Verify API endpoint and network connectivity
3. **Real-time sync not working**: Check WebSocket connection and session state
4. **Performance issues**: Monitor component re-renders and API call frequency

### Debug Information

Enable debug logging by setting:
```typescript
console.log('Text editing state:', textEditing);
console.log('Tag data:', tag);
console.log('Session info:', { sessionId, currentUserId });
```

## Conclusion

The enhanced text tag editing implementation provides a robust, user-friendly way for users to interact with text tags in the digital notarization system. It combines excellent user experience with reliable data persistence and real-time collaboration features.

The modular architecture makes it easy to extend and customize the functionality for different use cases, while the comprehensive error handling ensures a stable user experience even in challenging conditions.
