# Tag Bouncing Fix - WebSocket Message Loop Prevention

## Problem Description

Tags were bouncing and acting weird on live servers due to WebSocket message loops where:
1. Client A makes a tag update → sends optimistic update locally
2. Client A sends update to server via API
3. Server broadcasts the update to all clients (including Client A)
4. Client A receives its own broadcast → updates tag again
5. Client B receives broadcast → updates tag
6. Client B might also be making updates → creates more broadcasts
7. Loop continues causing tags to bounce between positions

## Root Causes

1. **Self-Broadcast Reception**: Clients were processing their own WebSocket broadcasts
2. **Insufficient Deduplication**: No mechanism to prevent processing duplicate messages
3. **Race Conditions**: Multiple users making simultaneous updates created conflicting broadcasts
4. **Rapid-Fire Updates**: Low debounce delays caused too many messages

## Solutions Implemented

### 1. Client-Side Deduplication (`useWebSocket.ts`)

- **Message Deduplication**: Track processed messages to prevent duplicate processing
- **Self-Broadcast Filtering**: Skip processing messages from the current user
- **Coordinate Tolerance**: Ignore updates with very similar coordinates (within 2px)
- **Time Window**: 2-second window for duplicate detection

### 2. Server-Side Deduplication (`WebSocketService.ts`)

- **Message Tracking**: Track recent messages to prevent duplicate broadcasts
- **Coordinate Comparison**: Check if tag coordinates are very similar before broadcasting
- **Time-Based Filtering**: 2-second window for server-side deduplication

### 3. Increased Debounce Delays (`useTagOperations.ts`)

- **Tag Operations**: Increased from 100ms to 300ms to prevent rapid-fire updates
- **Better Throttling**: More conservative timing to reduce message frequency

### 4. Configuration System (`websocket-config.ts`)

- **Environment-Specific Settings**: Different behavior for development vs production
- **Debug Controls**: Configurable logging for troubleshooting
- **Performance Tuning**: Adjustable deduplication windows and tolerances

## Key Changes Made

### Client-Side (`client/src/hooks/editor/useWebSocket.ts`)

```typescript
// Added deduplication logic
const isDuplicateMessage = (message: WSMessage): boolean => {
  // Check for exact duplicates
  // Check for similar coordinates within time window
  // Track processed messages
};

// Skip own broadcasts
if (message.userId === userId) {
  return; // Skip processing own messages
}
```

### Server-Side (`server/services/editor/WebSocketService.ts`)

```typescript
// Added server-side deduplication
private isDuplicateMessage(message: WSMessage): boolean => {
  // Check for recent similar messages
  // Compare coordinates within tolerance
  // Prevent duplicate broadcasts
};
```

### Configuration (`client/src/lib/websocket-config.ts`)

```typescript
export const defaultWebSocketConfig: WebSocketConfig = {
  enabled: true,
  deduplicationWindow: 2000, // 2 seconds
  coordinateTolerance: 2, // 2 pixels
  maxMessagesPerSecond: 10,
  logDroppedMessages: process.env.NODE_ENV === 'development',
  logDuplicateMessages: process.env.NODE_ENV === 'development'
};
```

## Testing

### Local Development
- Tags should work smoothly without bouncing
- WebSocket sync should be responsive but not excessive
- Console logs should show deduplication working

### Production Deployment
- Tags should be stable and not bounce
- Performance should be improved with fewer unnecessary updates
- Real-time collaboration should still work effectively

## Monitoring

### Console Logs to Watch For
- `🔄 Skipping duplicate message` - Deduplication working
- `🔄 Skipping own broadcast` - Self-filtering working
- `🔄 Server: Skipping duplicate tag update` - Server-side deduplication

### Performance Metrics
- Reduced WebSocket message frequency
- Stable tag positions during collaboration
- Improved responsiveness

## Future Improvements

1. **Adaptive Throttling**: Adjust debounce delays based on user activity
2. **Conflict Resolution**: Better handling of simultaneous edits
3. **Connection Quality**: Adjust behavior based on network conditions
4. **User Feedback**: Visual indicators for sync status

## Rollback Plan

If issues occur, the configuration can be adjusted:

```typescript
// Disable deduplication temporarily
const config = {
  ...defaultWebSocketConfig,
  deduplicationWindow: 0, // Disable
  coordinateTolerance: 0 // Disable
};
```

Or increase debounce delays:

```typescript
// More conservative timing
const debouncedSave = debounce(operation => {
  // ... operation logic
}, 500); // Increase to 500ms
```
