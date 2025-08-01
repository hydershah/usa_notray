# Video Conference Troubleshooting Guide

## 🎥 Common Video Conference Issues & Solutions

### Issue: "Video conference isn't working after numerous attempts"

Based on the server logs and code analysis, here are the most common causes and solutions:

## 📊 **Diagnostic Checklist**

### 1. **Daily.co API Configuration** ✅
**Status**: Appears properly configured
- API Key: Present (`da48a4d3b10e1baded3b0cf71f68a6522925d0a10260f0e09202f25506759e64`)
- Domain: Configured (`usanotray.daily.co`)
- Room Creation: Working (logs show successful room creation)

### 2. **Browser & Device Issues** ⚠️

#### **Camera/Microphone Permissions**
```
Common Error: "Camera/microphone access denied"
```
**Solutions:**
1. Click the camera icon in browser address bar
2. Select "Allow" for camera and microphone
3. Refresh the page after granting permissions
4. Clear browser cache if permissions were previously denied

#### **Browser Compatibility**
**Supported Browsers:**
- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari (macOS)
- ✅ Edge
- ❌ Internet Explorer (not supported)

### 3. **Network & Connectivity Issues** 🌐

#### **WebRTC Connection Problems**
```
Error: "Failed to join Daily meeting: Join timeout after 30 seconds"
```

**Root Causes:**
1. **Firewall blocking WebRTC traffic**
2. **Corporate network restrictions**
3. **TURN/STUN server access blocked**
4. **Slow internet connection**

**Solutions:**
1. **Test on different network** (mobile hotspot)
2. **Check corporate firewall settings**
3. **Contact IT about WebRTC access**
4. **Use wired connection instead of WiFi**

### 4. **Performance & Timeout Issues** ⏱️

#### **Server Performance Problems**
From server logs, we see slow requests:
```
🐌 SLOW REQUEST: POST /api/jobs/186/video-session - 1770ms
🐌 SLOW REQUEST: GET /api/session/186/state - 526ms
```

**Solutions:**
1. **Database optimization** (already improved in recent fixes)
2. **Increased timeout values** (join timeout extended to 45 seconds)
3. **Cache improvements** (Redis performance optimization)

### 5. **Multiple Session Creation Attempts** 🔄

#### **Race Condition Issues**
Server logs show multiple video session creation requests for the same job:
```
🎥 Video session creation request: { jobId: 186, userId: 1, userRole: 'notary' }
```

**Solutions:**
1. **Wait for previous attempt to complete** before retrying
2. **Clear browser cache** to reset any stuck states
3. **Use the diagnostic tool** to check system status

## 🔧 **Step-by-Step Troubleshooting**

### Step 1: Run System Diagnostics
1. Go to the video conference page
2. Look for the "Video Conference Diagnostics" panel
3. Click "Run Tests Again" to check all systems
4. Address any failed tests before proceeding

### Step 2: Check Browser Setup
```bash
# In browser console (F12), check:
console.log('WebRTC Support:', !!window.RTCPeerConnection);
console.log('getUserMedia Support:', !!navigator.mediaDevices?.getUserMedia);
```

### Step 3: Test Media Devices
```javascript
// Test camera/microphone access
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    console.log('✅ Media access granted');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(error => {
    console.error('❌ Media access denied:', error.name, error.message);
  });
```

### Step 4: Network Connectivity Test
```bash
# Test Daily.co API connectivity
curl -I https://api.daily.co/v1/rooms
# Should return: HTTP/2 200
```

### Step 5: Clear Application State
1. **Clear localStorage**: `localStorage.clear()`
2. **Clear sessionStorage**: `sessionStorage.clear()`
3. **Refresh page**: Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
4. **Re-authenticate**: Log out and log back in

## 🚨 **Emergency Workarounds**

### Option 1: Switch Video Technology
If Daily.co continues to fail, the system supports multiple video providers:
1. **Whereby integration** (backup option)
2. **WebRTC fallback** (peer-to-peer)
3. **Simple video conference** (minimal features)

### Option 2: Proceed Without Video
1. Continue with document signing
2. Use audio-only mode
3. Screen sharing for document review
4. Manual verification process

## 📈 **Performance Optimizations Applied**

### Recent Fixes (2025-07-26):
1. **Circuit breaker timeout** increased from 5s to 15s
2. **Database connection pool** optimization
3. **Redis performance** improvements
4. **Join timeout** extended to 45 seconds
5. **Retry mechanisms** with exponential backoff

### Current Performance Targets:
- **Room creation**: < 2 seconds
- **Join meeting**: < 30 seconds  
- **Video quality**: 720p minimum
- **Latency**: < 100ms

## 🔍 **Advanced Debugging**

### Server-Side Logs to Check:
```bash
# Check Daily service status
grep "Daily service configuration status" logs/*.log

# Check room creation
grep "Daily room created successfully" logs/*.log

# Check join failures  
grep "Failed to join Daily meeting" logs/*.log

# Check timeout issues
grep "SLOW REQUEST.*video-session" logs/*.log
```

### Client-Side Debugging:
```javascript
// Enable Daily.co debug logs
localStorage.setItem('debug', 'daily-js*');

// Check call object state
console.log('Meeting State:', callObject?.meetingState());

// Monitor events
callObject?.on('error', (error) => {
  console.error('Daily Error:', error);
});
```

## 📞 **Contact Support**

If video conferencing continues to fail after following this guide:

1. **Provide System Information:**
   - Browser and version
   - Operating system  
   - Network environment (corporate/home/mobile)
   - Error messages from diagnostics

2. **Include Debug Information:**
   - Browser console logs
   - Network tab from Developer Tools
   - Results from diagnostic tests

3. **Temporary Solutions:**
   - Use alternative video provider
   - Proceed with audio-only session
   - Manual document verification

## 🎯 **Success Criteria**

Video conference is working when:
- ✅ All diagnostic tests pass
- ✅ Room creation completes in < 5 seconds
- ✅ Join meeting succeeds in < 30 seconds
- ✅ Video/audio streams are visible
- ✅ Real-time communication works
- ✅ No timeout errors in console

---

**Last Updated**: January 1, 2025  
**Status**: Active troubleshooting guide  
**Next Review**: As needed based on user reports 