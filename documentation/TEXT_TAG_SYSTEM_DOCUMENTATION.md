# Text Tag System Documentation

## Overview

This document describes the comprehensive text tag system implemented in the USA Notary application, including rendering, resizing, dragging, and font size management functionality.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Font Size Management](#font-size-management)
4. [Resize Functionality](#resize-functionality)
5. [Drag Functionality](#drag-functionality)
6. [User Controls](#user-controls)
7. [Visual Indicators](#visual-indicators)
8. [Code Changes](#code-changes)
9. [Technical Implementation](#technical-implementation)
10. [Performance Optimizations](#performance-optimizations)

## System Architecture

The text tag system is built around several key principles:

- **Uniform Font Sizing**: All text tags share the same font size globally
- **Real-time Synchronization**: Changes are broadcast via WebSocket to all users
- **Proportional Resizing**: Font size adjusts proportionally with container height
- **Single-line Text**: Text remains on one line with overflow handling
- **Visual Feedback**: Clear indicators for user interactions

## Core Components

### 1. StreamlinedTextInput Component
**Location**: `client/src/components/editor/StreamlinedTextInput.tsx`

Primary component responsible for:
- Text input rendering and editing
- Drag and resize functionality using `react-rnd`
- Font size management
- WebSocket synchronization
- Visual feedback and indicators

**Key Features**:
```typescript
// Font size limits
const MIN_FONT_SIZE = 10; // px
const MAX_FONT_SIZE = 40; // px

// Proportional font calculation
const newFontSize = Math.min(Math.max(Math.round(newHeight * 0.6), 10), 40);
```

### 2. Editor Store (useEditorStore)
**Location**: `client/src/hooks/editor/useEditorStore.ts`

Manages global state including:
- Global font size across all text tags
- Custom tag dimensions
- Persistence to localStorage

**Key Properties**:
```typescript
interface EditorStore {
  globalFontSize: number;
  setGlobalFontSize: (fontSize: number) => void;
  getGlobalFontSize: () => number;
}
```

## Font Size Management

### Global Font Size System

All text tags share a unified font size managed through the editor store:

```typescript
// Font size is stored globally and persists across sessions
const currentFontSize = globalFontSize;

// Font size updates affect all text tags immediately
setGlobalFontSize(newFontSize);
```

### Font Size Calculation

Font size is calculated proportionally based on container height:

```typescript
const calculateFontSize = (containerHeight: number): number => {
  return Math.min(Math.max(Math.round(containerHeight * 0.6), 10), 40);
};
```

**Examples**:
- Container height 25px → Font size 15px
- Container height 50px → Font size 30px  
- Container height 67px → Font size 40px (max)

### Persistence

Font size preferences are automatically saved to localStorage:

```typescript
try {
  localStorage.setItem('editorGlobalFontSize', fontSize.toString());
} catch (error) {
  console.warn('Failed to save font size to localStorage:', error);
}
```

## Resize Functionality

### Resize Handles

Text tags display resize handles when selected:

```typescript
enableResizing={isSelected && !isEditing ? {
  top: false,
  right: false,
  bottom: false,
  left: false,
  topRight: false,
  bottomRight: true, // Only bottom-right handle
  bottomLeft: false,
  topLeft: false,
} : false}
```

### Resize Handle Styling

```typescript
resizeHandleStyles={{
  bottomRight: {
    width: '28px',
    height: '28px',
    backgroundColor: '#2563eb',
    border: '4px solid white',
    borderRadius: '50%',
    right: '-14px',
    bottom: '-14px',
    cursor: 'se-resize',
    opacity: 1,
    boxShadow: '0 8px 25px rgba(37, 99, 235, 0.5)',
    zIndex: 1001
  }
}}
```

### Resize Logic

During resize operations:

1. **Dimension Update**: Container dimensions are updated in real-time
2. **Font Size Calculation**: Font size is recalculated based on new height
3. **Global Update**: New font size is applied to all text tags
4. **Persistence**: Final dimensions are saved for future text tags

```typescript
const handleResize = useCallback((e, direction, ref, delta, position) => {
  const newWidth = parseInt(ref.style.width) / scaleFactor;
  const newHeight = parseInt(ref.style.height) / scaleFactor;
  
  // Update dimensions
  setDimensions({ width: newWidth, height: newHeight });
  
  // Calculate and apply new font size
  const newFontSize = Math.min(Math.max(Math.round(newHeight * 0.6), 10), 40);
  if (newFontSize !== currentFontSize) {
    setGlobalFontSize(newFontSize);
  }
}, [scaleFactor, setGlobalFontSize]);
```

## Drag Functionality

### Drag Conditions

Text tags can be dragged when:
- Not in editing mode (`!isEditing`)
- User has appropriate permissions

```typescript
disableDragging={isEditing}
```

### Drag Boundaries

Dragging is constrained to the PDF page boundaries:

```typescript
bounds="parent" // Constrains to parent container
```

### Drag Feedback

Visual feedback during drag operations:
- Cursor changes to move cursor
- Real-time position updates
- WebSocket broadcasting for collaborative editing

## User Controls

### 1. Keyboard Shortcuts

**Font Size Control** (works when text tag is selected):
```typescript
// Global keyboard handler
const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      const newSize = Math.min(currentFontSize + 2, 40);
      setGlobalFontSize(newSize);
    } else if (e.key === '-') {
      e.preventDefault();
      const newSize = Math.max(currentFontSize - 2, 10);
      setGlobalFontSize(newSize);
    }
  }
};
```

**Available Shortcuts**:
- `Ctrl/Cmd + Plus (+)`: Increase font size by 2px
- `Ctrl/Cmd + Minus (-)`: Decrease font size by 2px
- `Enter`: Save and exit editing mode
- `Escape`: Cancel editing and restore original text

**Text Editing** (works when in editing mode):
```typescript
const handleInputKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSave(inputValue);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    setInputValue(content);
    setIsEditing(false);
  }
  // Font size shortcuts also work during editing
  else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    const newSize = Math.min(currentFontSize + 2, 40);
    setGlobalFontSize(newSize);
  }
};
```

### 2. Mouse Controls

- **Single Click**: Enter editing mode
- **Drag**: Move text tag position
- **Resize Handle Drag**: Resize container and adjust font size proportionally
- **Click Outside**: Exit editing mode and save changes

## Visual Indicators

### 1. Selection Indicator

When a text tag is selected:
```typescript
// Blue dashed border
border: isSelected ? '3px dashed #3b82f6' : '1px solid transparent'
```

### 2. Font Size Indicator

Floating tooltip showing current font size and controls:

```typescript
{isSelected && !isEditing && (
  <div style={{
    position: 'absolute',
    top: '-30px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    zIndex: 1002,
    pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    animation: 'fontSizeIndicatorFadeIn 0.2s ease-out'
  }}>
    {currentFontSize}px • Drag handle or Ctrl +/-
  </div>
)}
```

### 3. Editing State Indicator

Different styling based on state:
- **Editing**: Blue dashed border (3px)
- **Selected**: Blue dashed border (2px)
- **Default**: Transparent border

### 4. Placeholder Text

Dynamic placeholder text based on state:
```typescript
{inputValue || (
  <span style={{ 
    color: 'rgba(0, 0, 0, 0.4)',
    fontStyle: 'italic',
    fontSize: '0.9em'
  }}>
    {isNew && !hasStartedEditing ? 'Text' : 'Click to edit'}
  </span>
)}
```

## Code Changes

### 1. Font Size Management System

**Added to useEditorStore.ts**:
```typescript
// Global font size state
globalFontSize: number;

// Font size actions
setGlobalFontSize: (fontSize: number) => void;
getGlobalFontSize: () => number;

// Persistence logic
globalFontSize: (() => {
  try {
    const saved = localStorage.getItem('editorGlobalFontSize');
    return saved ? Math.min(Math.max(parseInt(saved), 10), 40) : 16;
  } catch (error) {
    return 16;
  }
})(),
```

### 2. Proportional Font Sizing

**Modified handleResize in StreamlinedTextInput.tsx**:
```typescript
// Calculate font size based on container height (but with limits)
const newFontSize = Math.min(Math.max(Math.round(newHeight * 0.6), 10), 40);
if (newFontSize !== currentFontSize) {
  setGlobalFontSize(newFontSize);
}
```

### 3. Text Overflow Handling

**Updated text styling**:
```typescript
style={{
  whiteSpace: 'nowrap', // Keep text on single line
  overflow: 'hidden',   // Hide overflow
  textOverflow: 'ellipsis', // Show ellipsis for long text
  fontSize: `${Math.min(Math.max(currentFontSize, 10), 40)}px`,
}}
```

### 4. Keyboard Shortcuts Implementation

**Added global keyboard handler**:
```typescript
useEffect(() => {
  if (!isSelected || isEditing) return;
  
  const handleGlobalKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        const newSize = Math.min(currentFontSize + 2, 40);
        setGlobalFontSize(newSize);
      } else if (e.key === '-') {
        e.preventDefault();
        const newSize = Math.max(currentFontSize - 2, 10);
        setGlobalFontSize(newSize);
      }
    }
  };
  
  document.addEventListener('keydown', handleGlobalKeyDown);
  return () => document.removeEventListener('keydown', handleGlobalKeyDown);
}, [isSelected, isEditing, currentFontSize, setGlobalFontSize]);
```

### 5. Visual Feedback Enhancements

**Added font size indicator**:
```typescript
{/* Font Size Indicator - show when selected */}
{isSelected && !isEditing && (
  <div className="font-size-indicator">
    {currentFontSize}px • Drag handle or Ctrl +/-
  </div>
)}
```

## Technical Implementation

### 1. Component Architecture

```
StreamlinedTextInput (Main Component)
├── react-rnd (Drag & Resize Library)
├── useEditorStore (Global State)
├── WebSocket Integration
├── Event Handlers
│   ├── handleResize
│   ├── handleDrag  
│   ├── handleKeyDown
│   └── handleSave
└── Visual Indicators
    ├── Selection Border
    ├── Font Size Tooltip
    └── Resize Handles
```

### 2. State Management Flow

```
User Action → Event Handler → Store Update → All Components Re-render → WebSocket Broadcast
```

### 3. Font Size Calculation Logic

```typescript
const FONT_SIZE_RATIO = 0.6; // 60% of container height
const MIN_FONT_SIZE = 10;    // Minimum readable size
const MAX_FONT_SIZE = 40;    // Maximum practical size

const calculateFontSize = (height: number): number => {
  const proportionalSize = Math.round(height * FONT_SIZE_RATIO);
  return Math.min(Math.max(proportionalSize, MIN_FONT_SIZE), MAX_FONT_SIZE);
};
```

### 4. WebSocket Integration

Real-time synchronization for collaborative editing:

```typescript
// Broadcast font size changes
if (webSocket && webSocket.readyState === WebSocket.OPEN) {
  webSocket.send(JSON.stringify({
    type: 'font_size_updated',
    payload: { fontSize: newFontSize },
    userId: assignedUserId.toString(),
    sessionId
  }));
}
```

### 5. Performance Considerations

- **Debounced Save Operations**: Prevents excessive server calls during rapid changes
- **Request Deduplication**: Avoids duplicate API calls for the same operation
- **Efficient Re-rendering**: Only updates when necessary using React.memo and useCallback
- **WebSocket Throttling**: Limits broadcast frequency during continuous operations

## Performance Optimizations

### 1. Debounced Operations

```typescript
const debouncedSave = useCallback(
  debounce((sessionId, id, x, y, width, height, pageNumber) => {
    // Save operation
  }, 300),
  []
);
```

### 2. Memoized Components

```typescript
const StreamlinedTextInput = React.memo(({ ... }) => {
  // Component logic
});
```

### 3. Optimized Event Handlers

```typescript
const handleResize = useCallback((e, direction, ref, delta, position) => {
  // Resize logic
}, [scaleFactor, setGlobalFontSize, /* other dependencies */]);
```

### 4. Smart Cache Invalidation

Server-side cache invalidation based on operation type:
```typescript
// Only invalidate relevant cache keys
🎯 Smart invalidation: font_update affecting [session_tags, user_preferences]
```

## Troubleshooting

### Common Issues

1. **Font Size Not Updating**: Check if globalFontSize is properly connected to the store
2. **Resize Handle Not Visible**: Ensure `isSelected && !isEditing` conditions are met
3. **Text Overflow**: Verify `whiteSpace: 'nowrap'` and overflow settings
4. **Keyboard Shortcuts Not Working**: Check if event listeners are properly attached
5. **WebSocket Issues**: Verify connection status and message format

### Debug Information

The system provides comprehensive logging:
```typescript
console.log('🎯 StreamlinedTextInput rendering:', {
  id,
  isEditing,
  isSelected,
  currentFontSize,
  enableResizing: isSelected && !isEditing,
  canDrag: !isEditing
});
```

## Future Enhancements

### Planned Features

1. **Multi-line Text Support**: Allow text to wrap to multiple lines
2. **Font Family Selection**: Support for different font families
3. **Text Styling**: Bold, italic, underline options
4. **Color Picker**: Text and background color customization
5. **Alignment Options**: Left, center, right, justify alignment
6. **Template Text**: Pre-defined text snippets for common use cases

### Architecture Improvements

1. **Component Splitting**: Break down large components into smaller ones
2. **Custom Hooks**: Extract complex logic into reusable hooks
3. **Type Safety**: Improve TypeScript coverage and types
4. **Testing**: Add comprehensive unit and integration tests
5. **Accessibility**: Improve keyboard navigation and screen reader support

---

*This documentation was last updated on: January 30, 2025*
*Version: 1.0.0*
*Author: Development Team*