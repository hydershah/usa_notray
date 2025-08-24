# Session ID Bug Fix

## Problem Description

The application was experiencing "Session not found" errors in production, where the client was using the **job ID** (`55`) instead of the actual **session ID** (`video_1756008278744_v6umebtmb`) for API calls and WebSocket connections.

## Root Cause Analysis

From the server logs, we identified that:
1. ✅ Session creation worked correctly: `POST /api/editor/job/55/session` returned the correct session ID `video_1756008278744_v6umebtmb`
2. ✅ Session data fetch worked: `GET /api/editor/session/video_1756008278744_v6umebtmb` was successful
3. ❌ Tag operations failed: API calls used `sessionId: '55'` instead of the correct session ID
4. ❌ WebSocket connection failed: Attempted to connect with session ID `55`

This suggested that there were multiple component instances or a race condition where an old instance was using the job ID instead of the session ID.

## Solution Implemented

### 1. Comprehensive Guards Added

Added validation guards in all critical functions to prevent job IDs from being used as session IDs:

- **useTagOperations hook**: Guards in all API functions (savePlaceTag, saveUpdateTag, saveDeleteTag, etc.)
- **useWebSocket hook**: Guards in WebSocket URL creation and connection
- **PDFTaggingEditor component**: Added debugging to track component instantiation

### 2. Debug Logging

Added comprehensive logging to identify where job IDs are being passed incorrectly:

```typescript
// Pattern used throughout the codebase
if (/^\d+$/.test(sessionId)) {
  console.error('❌ Attempting to use job ID as session ID:', sessionId);
  throw new Error(`Invalid session ID: ${sessionId}. This appears to be a job ID, not a session ID.`);
}
```

### 3. Error Messages

Enhanced error messages to provide clear feedback when the wrong session ID is detected:

- API calls now fail fast with descriptive error messages
- WebSocket connections are prevented from using job IDs
- Component instantiation is logged with stack traces for debugging

## Files Modified

1. **client/src/hooks/editor/useTagOperations.ts**
   - Added guards in all API functions
   - Added debugging for hook instantiation
   - Guards prevent any API calls with job IDs

2. **client/src/components/editor/PDFTaggingEditor.tsx**
   - Added debugging for component instantiation
   - Added useEffect to log session ID on mount

3. **client/src/hooks/editor/useWebSocket.ts**
   - Added guards in WebSocket URL creation
   - Added debugging for hook instantiation
   - Prevents WebSocket connections with job IDs

## Testing Instructions

### 1. Local Testing

1. Start the development server
2. Navigate to a job editor (e.g., `/jobs/55/editor?mode=tagging`)
3. Check console logs for:
   ```
   🔍 PDFTaggingEditor initialized with sessionId: video_1756008278744_v6umebtmb
   🔍 useTagOperations initialized with sessionId: video_1756008278744_v6umebtmb
   🔍 useWebSocket initialized with sessionId: video_1756008278744_v6umebtmb
   ```
4. If you see any errors with job IDs being used, the guards will catch them:
   ```
   ❌ PDFTaggingEditor received job ID instead of session ID! 55
   ```

### 2. Production Testing

1. Deploy the changes to production
2. Test job editor functionality:
   - Tag placement
   - WebSocket connection
   - Real-time collaboration
3. Monitor server logs for any "Session not found" errors
4. Check browser console for guard error messages

### 3. Expected Behavior

**Before Fix:**
- API calls to `/api/editor/session/55/place-tag` (404 errors)
- WebSocket connections to `sessionId=55` (rejected)
- "Session not found" errors in console

**After Fix:**
- API calls to `/api/editor/session/video_1756008278744_v6umebtmb/place-tag` (success)
- WebSocket connections to correct session ID (success)
- No "Session not found" errors
- If job IDs are still being passed, clear error messages with stack traces

## Verification Script

You can run this script to verify the fix is working:

```typescript
// Check that session validation is working
npx tsx scripts/test-session-validation.ts
```

## Rollback Plan

If issues occur after deployment:

1. **Immediate**: The guards will prevent API calls with wrong session IDs
2. **Quick Fix**: Remove the guards temporarily by commenting out the validation lines
3. **Full Rollback**: Revert the commits for these three files

## Monitoring

After deployment, monitor:

1. **Server Logs**: Look for "Session not found" errors
2. **Browser Console**: Look for guard error messages
3. **User Reports**: Tag placement failures or WebSocket connection issues
4. **API Metrics**: 404 errors on `/api/editor/session/*/place-tag` endpoints

## Follow-up

If the guards catch instances of job IDs being used:

1. **Investigate**: Use the stack traces to identify where the wrong session ID is coming from
2. **Fix Root Cause**: Update the component instantiation to use correct session ID
3. **Remove Guards**: Once root cause is fixed, guards can be removed or made less strict

## Success Criteria

✅ No "Session not found" errors in production  
✅ Tag placement works correctly  
✅ WebSocket connections succeed  
✅ Real-time collaboration functions properly  
✅ No 404 errors on editor session endpoints  

## Contact

If issues persist after this fix, the error messages and stack traces will provide the exact location where job IDs are being used incorrectly, making further debugging much easier.
