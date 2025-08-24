# WebSocket Session Validation Fix

## Problem Description

The application was experiencing "Session not found" errors when deployed to production, while working fine locally. This was caused by the WebSocket service not properly validating sessions against the database before allowing connections.

### Root Cause

1. **In-Memory Session Management**: The WebSocket service was managing sessions in memory (`this.sessions` Map)
2. **No Database Validation**: WebSocket connections were allowed without verifying session existence in the database
3. **Server Restart Issues**: When the server restarted or when there were multiple instances, in-memory sessions were lost
4. **Production vs Development**: Local development worked because sessions persisted in memory, but production deployments caused session loss

### Error Flow

1. Client attempts to connect to WebSocket with session ID
2. WebSocket service accepts connection without database validation
3. Client tries to place tags or perform operations
4. TagService validates session against database and throws "Session not found"
5. Client receives error and fails to save operations

## Solution Implemented

### 1. Database Session Validation

Added session validation in the WebSocket connection handler:

```typescript
// Validate session exists in database before allowing connection
const [session] = await db
  .select()
  .from(editorSessions)
  .where(eq(editorSessions.sessionId, sessionId))
  .limit(1);

if (!session) {
  console.error(`❌ WebSocket connection rejected: Session ${sessionId} not found in database`);
  ws.close(1008, 'Session not found');
  return;
}
```

### 2. Session State Validation

Added validation for session status:

```typescript
// Check if session is active or preparing (allow connections to these states)
if (session.status === 'completed' && session.sessionType === 'tagging') {
  // Reactivate completed tagging sessions for continued editing
  await db
    .update(editorSessions)
    .set({ status: 'active', updatedAt: new Date() })
    .where(eq(editorSessions.sessionId, sessionId));
  
  console.log(`🔄 Reactivated completed tagging session: ${sessionId} for WebSocket connection`);
} else if (session.status !== 'active' && session.status !== 'preparing') {
  console.error(`❌ WebSocket connection rejected: Session ${sessionId} is in ${session.status} state`);
  ws.close(1008, 'Session not active');
  return;
}
```

### 3. Periodic Session Cleanup

Added database validation in the cleanup process:

```typescript
// Validate sessions against database and clean up invalid ones
try {
  const sessionIds = Array.from(this.sessions.keys());
  if (sessionIds.length === 0) return;
  
  // Get all valid sessions from database in one query
  const validSessions = await db
    .select({ sessionId: editorSessions.sessionId, status: editorSessions.status })
    .from(editorSessions)
    .where(inArray(editorSessions.sessionId, sessionIds));
  
  const validSessionMap = new Map(validSessions.map(s => [s.sessionId, s]));
  
  // Remove sessions that don't exist in database or are in invalid states
  for (const sessionId of sessionIds) {
    const session = this.sessions.get(sessionId);
    if (!session) continue;
    
    const dbSession = validSessionMap.get(sessionId);
    
    if (!dbSession) {
      // Session doesn't exist in database - close all connections
      console.log(`🗑️ Removing invalid session (not in DB): ${sessionId}`);
      session.users.forEach(user => {
        if (user.ws.readyState === WebSocket.OPEN) {
          user.ws.close(1008, 'Session not found in database');
        }
      });
      this.sessions.delete(sessionId);
    } else if (dbSession.status !== 'active' && dbSession.status !== 'preparing') {
      // Session exists but is in invalid state - close all connections
      console.log(`🗑️ Removing session in invalid state (${dbSession.status}): ${sessionId}`);
      session.users.forEach(user => {
        if (user.ws.readyState === WebSocket.OPEN) {
          user.ws.close(1008, `Session is ${dbSession.status}`);
        }
      });
      this.sessions.delete(sessionId);
    }
  }
} catch (error) {
  console.error('Failed to validate sessions against database:', error);
}
```

### 4. Enhanced Client-Side Error Handling

Improved error handling and user feedback:

```typescript
ws.onclose = (event) => {
  console.log('🔌 WebSocket disconnected:', event.code, event.reason);
  
  // Handle specific close codes
  if (event.code === 1008) {
    console.error('❌ Session not found or not active:', event.reason);
    toast({
      title: 'Session Error',
      description: event.reason || 'Session not found. Please refresh the page.',
      variant: 'destructive'
    });
  } else if (event.code === 1011) {
    console.error('❌ Server error during connection setup:', event.reason);
    toast({
      title: 'Server Error',
      description: 'Server error during connection. Please try again.',
      variant: 'destructive'
    });
  }
  
  // Don't reconnect for session errors
  if (autoReconnect && 
      connectionState.reconnectAttempts < maxReconnectAttempts && 
      event.code !== 1008) {
    // Attempt reconnection logic...
  }
};
```

## Files Modified

### Server-Side Changes

1. **`server/services/editor/WebSocketService.ts`**
   - Added database imports (`db`, `editorSessions`, `eq`, `inArray`)
   - Modified `handleConnection` to be async and validate sessions
   - Added session reactivation logic for completed tagging sessions
   - Enhanced `cleanupInactiveSessions` with database validation
   - Updated connection event handler to handle async operations

### Client-Side Changes

1. **`client/src/hooks/editor/useWebSocket.ts`**
   - Enhanced error logging with environment information
   - Added specific error handling for different close codes
   - Improved user feedback with toast notifications
   - Prevented reconnection attempts for session errors

### Testing

1. **`scripts/test-session-validation.ts`**
   - Created test script to verify session validation logic
   - Tests database queries and session state validation

## Deployment Instructions

### 1. Pre-Deployment Testing

Run the session validation test:

```bash
npx tsx scripts/test-session-validation.ts
```

### 2. Environment Configuration

Ensure your production environment has the correct database configuration:

```env
# Database Configuration
DATABASE_URL="your_production_database_url"

# JWT Configuration
JWT_SECRET="your_production_jwt_secret"

# Application URLs
CLIENT_URL="https://your-production-domain.com"
SERVER_URL="https://your-production-domain.com"
```

### 3. Database Migration

Ensure the `editorSessions` table exists and has the correct schema:

```sql
-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'editor_sessions';
```

### 4. Deployment Steps

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy to your production environment**:
   ```bash
   # For Railway
   railway up
   
   # For other platforms, follow their deployment process
   ```

3. **Monitor the logs** for session validation messages:
   ```bash
   # Look for these log messages:
   # ✅ Session {sessionId} validated for WebSocket connection (status: active)
   # 🔄 Reactivated completed tagging session: {sessionId} for WebSocket connection
   # 🗑️ Removing invalid session (not in DB): {sessionId}
   ```

### 5. Post-Deployment Verification

1. **Test WebSocket connections**:
   - Open the application in production
   - Navigate to an editor session
   - Check browser console for WebSocket connection logs
   - Verify real-time collaboration works

2. **Test session reactivation**:
   - Complete a tagging session
   - Try to reconnect to the same session
   - Verify it gets reactivated automatically

3. **Test error handling**:
   - Try to connect to a non-existent session
   - Verify proper error messages are shown

## Monitoring and Debugging

### Key Log Messages to Monitor

- `✅ Session {sessionId} validated for WebSocket connection (status: {status})`
- `🔄 Reactivated completed tagging session: {sessionId} for WebSocket connection`
- `❌ WebSocket connection rejected: Session {sessionId} not found in database`
- `❌ WebSocket connection rejected: Session {sessionId} is in {status} state`
- `🗑️ Removing invalid session (not in DB): {sessionId}`
- `🗑️ Removing session in invalid state ({status}): {sessionId}`

### Common Issues and Solutions

1. **"Session not found" errors persist**:
   - Check if the session exists in the database
   - Verify the session status is 'active' or 'preparing'
   - Check database connectivity

2. **WebSocket connection failures**:
   - Verify the WebSocket URL is correct for your environment
   - Check if the server is running and accessible
   - Verify JWT token is valid

3. **Session reactivation not working**:
   - Check if the session type is 'tagging'
   - Verify the session status is 'completed'
   - Check database update permissions

### Performance Considerations

- Session validation adds a database query per connection
- Consider implementing connection pooling for high-traffic scenarios
- Monitor database performance during peak usage
- Consider caching session validation results for short periods

## Rollback Plan

If issues arise after deployment:

1. **Revert to previous version**:
   ```bash
   git revert <commit-hash>
   ```

2. **Disable session validation temporarily**:
   - Comment out the database validation code in `WebSocketService.ts`
   - Deploy the reverted version

3. **Monitor for issues**:
   - Watch for "Session not found" errors
   - Monitor WebSocket connection success rates

## Future Improvements

1. **Session Caching**: Implement Redis caching for session validation
2. **Connection Pooling**: Add connection pooling for database queries
3. **Health Checks**: Add WebSocket service health checks
4. **Metrics**: Add metrics for session validation success/failure rates
5. **Circuit Breaker**: Implement circuit breaker for database validation

## Conclusion

This fix ensures that WebSocket connections are properly validated against the database, preventing "Session not found" errors in production environments. The solution maintains backward compatibility while adding robust session management and error handling.
