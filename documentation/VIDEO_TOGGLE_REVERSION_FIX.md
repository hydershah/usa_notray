# Video Toggle Reversion Fix Guide

## 🔍 **Issue Description**

**Problem**: Video enable/disable button toggles on for a second then reverts back off.

**Root Cause**: React state conflicts between manual toggle operations and automatic video stream connections causing the video state to revert after successful API calls.

This is similar to issues documented in:
- [React Issue #5554](https://github.com/facebook/react/issues/5554) - Input deselection during onChange
- [React Issue #12072](https://github.com/facebook/react/issues/12072) - Controlled component re-rendering
- [Input lag fixes](https://javascript.plainenglish.io/how-i-fixed-a-laggy-ui-bug-with-just-7-lines-of-javascript-40f3381363f3) - React UI performance issues

## 📊 **Console Evidence**

Your logs show the API works perfectly:
```
🎛️ Toggling video for current user
📹 Current video state: false, toggling to: true  
📹 Daily.co setLocalVideo result: r2 {_events: {…}, ...}
📹 Actual video state after API call: true
```

But then React state management causes reversion.

## 🔧 **The Fix**

### Step 1: Add Manual Toggle Tracking

Add this ref after the `showDailyInterface` state:

```typescript
const [showDailyInterface, setShowDailyInterface] = useState(false);

// Add a ref to track manual toggle operations
const isManuallyTogglingRef = useRef(false);

// Video element refs for each participant box
const videoRefs = useRef<{[key: number]: HTMLVideoElement | null}>({});
```

### Step 2: Modify connectVideoStreams Function

Add this check at the beginning of `connectVideoStreams`:

```typescript
// Connect video streams to custom UI elements
const connectVideoStreams = useCallback(() => {
  if (!callObjectRef.current) {
    console.log('🔍 No call object available for connecting video streams');
    return;
  }
  
  // Don't interfere if user is manually toggling video/audio
  if (isManuallyTogglingRef.current) {
    console.log('⏸️ Skipping video stream connection - manual toggle in progress');
    return;
  }

  try {
    console.log('🔗 Connecting video streams to custom UI...');
    // ... rest of function
```

### Step 3: Update toggleParticipantMedia Function

Replace the entire `toggleParticipantMedia` function with this version:

```typescript
// Toggle participant media
const toggleParticipantMedia = useCallback(async (index: number, mediaType: 'video' | 'audio') => {
  if (index === 0 && callObjectRef.current) {
    // Only allow current user to control their own media
    console.log(`🎛️ Toggling ${mediaType} for current user`);
    
    // Set flag to prevent interference from other state updates
    isManuallyTogglingRef.current = true;
    
    try {
      if (mediaType === 'video') {
        const currentState = participantStates[0]?.hasVideo || false;
        console.log(`📹 Current video state: ${currentState}, toggling to: ${!currentState}`);
        
        // Call Daily.co API with proper await
        const result = await callObjectRef.current.setLocalVideo(!currentState);
        console.log(`📹 Daily.co setLocalVideo result:`, result);
        
        // Wait a moment for the API call to fully process
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify the state change
        const participants = callObjectRef.current.participants();
        const actualVideoState = !!participants.local?.tracks?.video;
        console.log(`📹 Actual video state after API call: ${actualVideoState}`);
        
        // Update state with the actual result - but prevent conflicting updates
        updateParticipantState(0, { 
          hasVideo: actualVideoState,
          error: null 
        });
        
        toast({
          title: actualVideoState ? "Camera On" : "Camera Off",
          description: actualVideoState ? "Your camera is now enabled" : "Your camera is now disabled",
        });
        
        // Delayed reconnection to avoid conflicts
        setTimeout(() => {
          if (actualVideoState) {
            console.log('🔄 Reconnecting video streams after toggle...');
            connectVideoStreams();
          }
          // Clear the manual toggle flag after operation completes
          isManuallyTogglingRef.current = false;
        }, 800);
        
      } else {
        const currentState = participantStates[0]?.hasAudio || false;
        console.log(`🎤 Current audio state: ${currentState}, toggling to: ${!currentState}`);
        
        // Call Daily.co API with proper await
        const result = await callObjectRef.current.setLocalAudio(!currentState);
        console.log(`🎤 Daily.co setLocalAudio result:`, result);
        
        // Wait a moment for the API call to fully process
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Verify the state change
        const participants = callObjectRef.current.participants();
        const actualAudioState = !!participants.local?.tracks?.audio;
        console.log(`🎤 Actual audio state after API call: ${actualAudioState}`);
        
        // Update state with the actual result
        updateParticipantState(0, { 
          hasAudio: actualAudioState,
          error: null 
        });
        
        toast({
          title: actualAudioState ? "Microphone On" : "Microphone Off", 
          description: actualAudioState ? "Your microphone is now enabled" : "Your microphone is now muted",
        });
        
        // Clear the manual toggle flag
        setTimeout(() => {
          isManuallyTogglingRef.current = false;
        }, 500);
      }
      
    } catch (error) {
      console.error(`❌ Failed to toggle ${mediaType}:`, error);
      
      updateParticipantState(0, { 
        error: `Failed to toggle ${mediaType}. Please try again.`
      });
      
      toast({
        variant: "destructive",
        title: `${mediaType === 'video' ? 'Camera' : 'Microphone'} Error`,
        description: `Unable to toggle ${mediaType}. Please check your device permissions and try again.`,
      });
      
      // Clear the manual toggle flag on error
      isManuallyTogglingRef.current = false;
    }
  } else {
    console.warn(`⚠️ Cannot toggle ${mediaType}: index=${index}, callObject=${!!callObjectRef.current}`);
    
    if (!callObjectRef.current) {
      toast({
        variant: "destructive", 
        title: "Connection Error",
        description: "Video session not connected. Please try reconnecting.",
      });
    }
  }
}, [participantStates, updateParticipantState, connectVideoStreams, toast]);
```

## 🎯 **How It Works**

1. **Manual Toggle Flag**: `isManuallyTogglingRef.current = true` prevents other functions from interfering
2. **API Call Delay**: 200ms wait ensures Daily.co API fully processes before verification
3. **Conflict Prevention**: `connectVideoStreams` checks the flag and skips if manual toggle is active
4. **Delayed Reconnection**: 800ms delay for video, 500ms for audio before clearing the flag
5. **State Verification**: Always checks actual Daily.co state rather than assuming success

## ✅ **Expected Result**

After applying this fix:
- Video/audio buttons will toggle and STAY in their new state
- No more "renders for a second then goes back" behavior  
- Console will show "⏸️ Skipping video stream connection - manual toggle in progress"
- Toast notifications confirm successful toggles

## 🧪 **Testing**

1. Apply the code changes
2. Refresh the application  
3. Click video enable/disable button
4. Watch console logs for the manual toggle protection
5. Video should stay enabled/disabled as expected

This fix resolves the React state conflict by creating a "protection period" during manual toggles where automatic video stream connections cannot interfere. 