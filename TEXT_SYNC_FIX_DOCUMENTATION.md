# Text Tag Synchronization Fix

## Problem Description

When a notary added text content to a text tag, the content was not properly synchronized to the signer side. Instead of showing the actual text content that the notary entered, the signer side continued to display the placeholder message "Click to add text".

## Root Cause Analysis

The issue was in the WebSocket message handling and synchronization flow:

1. **Server Side**: When text content was saved, the server properly broadcasted `tag_content_updated` WebSocket messages
2. **Client WebSocket Handler**: The `useWebSocket` hook received `tag_content_updated` messages but did NOT call the text input synchronization callback
3. **Text Input Sync**: The `useStreamlinedTextInputs` hook was missing a handler for `tag_content_updated` messages

## The Synchronization Flow

### Before Fix (Broken)
```
Notary saves text → Server broadcasts `tag_content_updated` → 
useWebSocket receives message → Updates tag state only →
Text input system NOT notified → Signer still sees placeholder
```

### After Fix (Working)
```
Notary saves text → Server broadcasts `tag_content_updated` → 
useWebSocket receives message → Updates tag state AND calls textInputSyncCallback →
useStreamlinedTextInputs handles `tag_content_updated` → Updates text input content →
Signer sees actual text content
```

## Changes Made

### 1. Added Missing WebSocket Sync Handler

**File**: `client/src/hooks/editor/useStreamlinedTextInputs.ts`

Added a new case in the WebSocket sync callback to handle `tag_content_updated` messages:

```typescript
case 'tag_content_updated':
  // Update text input content when notary/other user saves content
  if (data.tagType === 'T') {
    // Only update if this text input is not currently selected/being edited
    if (selectedTextInputId !== data.tagId) {
      setTextInputs(prev => prev.map(input => {
        if (input.id === data.tagId) {
          return { 
            ...input, 
            content: data.content || '',
            isNew: false // Mark as not new since it has content
          };
        }
        return input;
      }));
    }
  }
  break;
```

### 2. Added Missing Callback Invocation

**File**: `client/src/hooks/editor/useWebSocket.ts`

Added the missing call to the text input sync callback in the `tag_content_updated` case:

```typescript
// 🔧 FIX: Update text inputs for text tags (T)
if (message.payload.tagType === 'T') {
  if (typeof window !== 'undefined' && (window as any).textInputSyncCallback) {
    (window as any).textInputSyncCallback('tag_content_updated', {
      tagId: message.payload.tagId,
      tagType: message.payload.tagType,
      content: message.payload.content,
      contentType: message.payload.contentType,
      contentData: processedContentData,
      isCompleted: message.payload.isCompleted,
      source: message.payload.source || 'manual'
    });
  }
}
```

## How It Works Now

1. **Notary adds text**: Uses StreamlinedTextInput component to type text
2. **Content saved**: Component calls API endpoint to save content to database
3. **Server broadcasts**: Server sends `tag_content_updated` WebSocket message to all session participants
4. **WebSocket handler**: `useWebSocket` receives message and calls `textInputSyncCallback`
5. **Text input sync**: `useStreamlinedTextInputs` updates the text input state with new content
6. **Signer sees content**: StreamlinedTextInput component renders the actual text instead of placeholder

## Key Features

- **Real-time sync**: Changes appear immediately on all participants' screens
- **Edit conflict prevention**: Won't overwrite content if someone else is currently editing the same field
- **Proper logging**: Comprehensive console logs for debugging synchronization issues
- **Fallback handling**: Gracefully handles missing or malformed data

## Testing

To verify the fix works:

1. Open session as notary
2. Place a text tag and add content
3. Open same session as signer
4. Verify signer sees the actual text content, not "Click to add text" placeholder
5. Both users should see real-time updates when either edits the text 