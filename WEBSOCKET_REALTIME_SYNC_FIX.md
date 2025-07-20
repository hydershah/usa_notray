# WebSocket Real-Time Synchronization Fix Guide

## Problem Summary

WebSockets weren't working for real-time document synchronization due to:
1. **Vite proxy misconfiguration** - WebSocket path `/ws/editor` wasn't being proxied
2. **Missing WebSocket broadcasts** - Tag operations weren't broadcasting changes
3. **Server restarts** - Nodemon was restarting too frequently, killing connections

## Fixes Applied

### 1. ✅ Vite Configuration Update
Added WebSocket proxy for `/ws` path in `vite.config.js`:

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    ws: true,
    secure: false,
    // ... existing config
  },
  '/ws': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    ws: true,
    secure: false
  }
}
```

### 2. ✅ WebSocket Broadcasting in Routes
Added real-time synchronization to tag operations in `server/routes.ts`:

#### Tag Placement Broadcasting
```typescript
// After TagService.placeTag()
const syncMessage = {
  type: 'tag_placed',
  payload: { tag },
  userId: req.user.id.toString(),
  sessionId,
  timestamp: Date.now()
};
WebSocketService.broadcastToSession(sessionId, syncMessage);
```

#### Tag Update Broadcasting
```typescript
// After TagService.updateTag()
const syncMessage = {
  type: 'tag_updated',
  payload: {
    tagId: tag.id,
    updates: { coordinates: tag.coordinates, ...updates }
  },
  userId: req.user.id.toString(),
  sessionId,
  timestamp: Date.now()
};
WebSocketService.broadcastToSession(sessionId, syncMessage);
```

#### Tag Deletion Broadcasting
```typescript
// After TagService.deleteTag()
const syncMessage = {
  type: 'tag_deleted',
  payload: { tagId },
  userId: req.user.id.toString(),
  sessionId,
  timestamp: Date.now()
};
WebSocketService.broadcastToSession(sessionId, syncMessage);
```

### 3. ✅ Nodemon Configuration Update
Updated `nodemon.json` to prevent unnecessary restarts:

```json
"ignore": [
  "node_modules/**/*",
  "dist/**/*",
  "client/**/*",
  "uploads/**/*",
  "recordings/**/*",
  "temp/**/*",
  "*.log",
  "*.db",
  "*.sqlite*",
  "**/*.test.ts",
  "**/*.spec.ts",
  "performance-logs/**/*",
  "certificates/**/*",
  "**/.cache/**/*",
  "**/*.tmp",
  "**/*.cache",
  "**/cache-*"
]
```

## Testing WebSocket Connection

### 1. Manual Browser Test
1. Open two browser windows/tabs
2. Log in as notary in one, signer in another
3. Join the same live signing session
4. Place/move/delete tags in one window
5. Changes should appear instantly in the other window

### 2. Automated Test Script
Run the provided test script:

```bash
node test-websocket-connection.js
```

Expected output:
```
🧪 Starting WebSocket Connection Test...

📡 Test 1: Connecting as Notary...
✅ Notary connected successfully!

📡 Test 2: Connecting as Signer...
✅ Signer connected successfully!

📤 Sending tag placement message from Notary...
📥 Signer received: tag_placed (tag: S)
📥 Notary received: user_joined { user: {...} }

📤 Sending cursor movement from Signer...
📥 Notary received: cursor_moved { x: 250, y: 300, ... }

🏁 Tests complete. Closing connections...
```

### 3. Chrome DevTools Test
1. Open Chrome DevTools → Network tab
2. Filter by "WS" to see WebSocket connections
3. Click on the WebSocket connection
4. Watch the "Messages" tab for real-time events

## Verifying Real-Time Sync

### What Should Work Now:
- ✅ **Tag Placement** - New tags appear instantly for all users
- ✅ **Tag Movement** - Dragging tags updates position in real-time
- ✅ **Tag Deletion** - Removed tags disappear for all users
- ✅ **Tag Content** - Filling tag content (signatures, text) syncs instantly
- ✅ **Cursor Tracking** - See other users' cursor positions
- ✅ **Page Navigation** - Know which page other users are viewing

### Debugging Tips:

1. **Check WebSocket Connection**
   ```javascript
   // In browser console
   console.log(window.webSocket?.connectionState);
   ```

2. **Monitor Server Logs**
   Look for these messages:
   - `🔗 WebSocket service initialized for PDF Editor`
   - `✅ User [name] joined session [id]`
   - `🔄 Tag update broadcasted for tag [id]`

3. **Common Issues**:
   - **No connection**: Check if server is running and proxy is configured
   - **Connection drops**: Look for server restarts in logs
   - **No updates**: Verify broadcasts are being sent in server logs
   - **Authentication errors**: Check JWT token in WebSocket URL

## Architecture Overview

```
Browser 1 (Notary)          Browser 2 (Signer)
      ↓                           ↓
   WebSocket                   WebSocket
      ↓                           ↓
Vite Dev Server → Proxy → Express Server
                              ↓
                      WebSocketService
                              ↓
                   Broadcast to Session
                         ↙        ↘
                  Browser 1    Browser 2
```

## Next Steps

1. **Test in production**: Ensure WebSocket works without Vite proxy
2. **Add reconnection UI**: Show connection status to users
3. **Implement offline queue**: Queue changes when disconnected
4. **Add conflict resolution**: Handle simultaneous edits gracefully

## Related Files
- `/client/src/hooks/editor/useWebSocket.ts` - Client WebSocket hook
- `/server/services/editor/WebSocketService.ts` - Server WebSocket service
- `/server/routes.ts` - API endpoints with broadcasting
- `/vite.config.js` - Development proxy configuration
- `/nodemon.json` - Server restart configuration 