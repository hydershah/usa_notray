# 🧪 OpenVidu Production Testing & Verification Plan

**Purpose**: Comprehensive testing to ensure production readiness  
**Status**: Ready for Execution  
**Prerequisites**: Infrastructure deployed per `PRODUCTION_DEPLOYMENT_GUIDE.md`

---

## 📋 **Testing Phases Overview**

1. **🔧 Infrastructure Testing** - Verify all services are operational
2. **🎥 Video Session Testing** - Test core video functionality  
3. **🎬 Recording Testing** - Verify recording and Vultr upload
4. **🌐 Frontend Integration Testing** - Test all UI components
5. **⚡ Performance Testing** - Load and stress testing
6. **📱 Cross-Platform Testing** - Browser and device compatibility
7. **🛡️ Security Testing** - Authentication and access control
8. **🚨 Failure Testing** - Error handling and recovery

---

## 🔧 **PHASE 1: Infrastructure Testing**

### **Test 1.1: OpenVidu Server Health**

#### **Objective**: Verify OpenVidu server is running and accessible

#### **Steps**:
```bash
# 1. Test server connectivity
curl -k https://your-openvidu-server.com:4443/openvidu/api/config

# 2. Expected response: JSON configuration
{
  "version": "2.31.0",
  "domainOrPublicIp": "your-server.com",
  "publicUrl": "https://your-server.com:4443",
  "openviduRecording": true,
  "openviduRecordingPath": "/opt/openvidu/recordings"
}

# 3. Test WebSocket connection
wscat -c wss://your-openvidu-server.com:4443/openvidu
```

#### **Success Criteria**:
- [ ] HTTP 200 response from `/openvidu/api/config`
- [ ] WebSocket connection successful
- [ ] Recording enabled in configuration
- [ ] No SSL/TLS errors

---

### **Test 1.2: Vultr Object Storage**

#### **Objective**: Verify Vultr bucket access and upload capability

#### **Steps**:
```bash
# 1. Test bucket access
aws s3 ls s3://notary-recordings-prod --endpoint-url=https://ewr1.vultrobjects.com

# 2. Test upload
echo "test file" > test.txt
aws s3 cp test.txt s3://notary-recordings-prod/test/ --endpoint-url=https://ewr1.vultrobjects.com

# 3. Verify upload
aws s3 ls s3://notary-recordings-prod/test/ --endpoint-url=https://ewr1.vultrobjects.com

# 4. Clean up
aws s3 rm s3://notary-recordings-prod/test/test.txt --endpoint-url=https://ewr1.vultrobjects.com
```

#### **Success Criteria**:
- [ ] Bucket listing successful
- [ ] File upload successful  
- [ ] File visible in bucket
- [ ] File deletion successful

---

### **Test 1.3: Railway.co Application Health**

#### **Objective**: Verify Railway.co app is running with proper configuration

#### **Steps**:
```bash
# 1. Test application health
curl https://your-railway-app.com/api/video/health

# 2. Expected response:
{
  "status": "healthy",
  "services": {
    "openvidu": {
      "status": "healthy",
      "info": {
        "configured": true,
        "serverUrl": "https://your-openvidu-server.com:4443",
        "activeSessions": 0,
        "activeRecordings": 0
      }
    },
    "recording": {
      "status": "healthy", 
      "info": {
        "configured": true,
        "bucket": "notary-recordings-prod",
        "endpoint": "https://ewr1.vultrobjects.com"
      }
    }
  }
}

# 3. Test configuration endpoint
curl https://your-railway-app.com/api/video/config \
  -H "Authorization: Bearer admin_token"
```

#### **Success Criteria**:
- [ ] Health endpoint returns "healthy" status
- [ ] OpenVidu service configured and connected
- [ ] Recording service configured and connected
- [ ] Configuration endpoint accessible with admin token

---

## 🎥 **PHASE 2: Video Session Testing**

### **Test 2.1: Session Creation**

#### **Objective**: Test creating OpenVidu video sessions

#### **Steps**:
```bash
# 1. Create test session
curl -X POST https://your-railway-app.com/api/jobs/999/video-session \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-$(date +%s)",
    "participants": [
      {
        "userId": 1,
        "role": "notary", 
        "displayName": "Test Notary",
        "email": "notary@test.com"
      },
      {
        "userId": 2,
        "role": "signer",
        "displayName": "Test Signer", 
        "email": "signer@test.com"
      }
    ],
    "config": {
      "maxParticipants": 8,
      "allowRecording": true,
      "autoStartRecording": false
    }
  }'

# 2. Expected response:
{
  "success": true,
  "sessionId": "test-session-1234567890",
  "sessionToken": "wss://your-openvidu-server.com:4443?sessionId=...",
  "participants": [
    {
      "token": "tok_...",
      "connectionId": "connection-1-...",
      "role": "notary",
      "data": "{\"userId\":1,...}"
    }
  ],
  "config": {
    "recordingEnabled": false,
    "maxParticipants": 8
  }
}
```

#### **Success Criteria**:
- [ ] Session created successfully
- [ ] Valid session token returned
- [ ] Participant tokens generated
- [ ] Correct participant roles assigned

---

### **Test 2.2: Token Generation**

#### **Objective**: Test generating participant tokens for existing sessions

#### **Steps**:
```bash
# 1. Generate token for new participant
curl -X POST https://your-railway-app.com/api/jobs/999/video-token \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-1234567890",
    "userId": 3,
    "role": "witness",
    "displayName": "Test Witness"
  }'

# 2. Expected response:
{
  "success": true,
  "token": "tok_...",
  "connectionId": "connection-3-...",
  "sessionData": {
    "sessionId": "test-session-1234567890",
    "jobId": 999,
    "participant": {
      "userId": 3,
      "role": "witness",
      "displayName": "Test Witness"
    }
  }
}
```

#### **Success Criteria**:
- [ ] Token generated successfully
- [ ] Valid connection ID returned
- [ ] Correct participant data included

---

### **Test 2.3: Session Closure**

#### **Objective**: Test closing video sessions

#### **Steps**:
```bash
# 1. Close session
curl -X DELETE https://your-railway-app.com/api/jobs/999/video-session/test-session-1234567890 \
  -H "Authorization: Bearer admin_token"

# 2. Expected response:
{
  "success": true,
  "message": "Session closed successfully"
}

# 3. Verify session no longer exists
curl -X POST https://your-railway-app.com/api/jobs/999/video-token \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-1234567890",
    "userId": 4,
    "role": "observer",
    "displayName": "Test Observer"
  }'

# Should return error: Session not found
```

#### **Success Criteria**:
- [ ] Session closed successfully
- [ ] Subsequent token generation fails
- [ ] No OpenVidu errors in logs

---

## 🎬 **PHASE 3: Recording Testing**

### **Test 3.1: Recording Lifecycle**

#### **Objective**: Test complete recording workflow with Vultr upload

#### **Steps**:
```bash
# 1. Create session
SESSION_ID="recording-test-$(date +%s)"
curl -X POST https://your-railway-app.com/api/jobs/998/video-session \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"participants\": [...]
  }"

# 2. Start recording
RECORDING_RESPONSE=$(curl -X POST https://your-railway-app.com/api/jobs/998/video-recording/start \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"layout\": \"grid\",
    \"resolution\": \"1920x1080\"
  }")

RECORDING_ID=$(echo $RECORDING_RESPONSE | jq -r '.recordingId')

# 3. Wait for recording to capture content (simulate activity)
sleep 30

# 4. Stop recording
curl -X POST https://your-railway-app.com/api/jobs/998/video-recording/stop \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d "{
    \"recordingId\": \"$RECORDING_ID\"
  }"

# 5. Verify Vultr upload
sleep 60  # Wait for upload
TODAY=$(date +%Y-%m-%d)
aws s3 ls s3://notary-recordings-prod/recordings/$TODAY/job-998/ \
  --endpoint-url=https://ewr1.vultrobjects.com
```

#### **Success Criteria**:
- [ ] Recording starts successfully
- [ ] Recording ID returned
- [ ] Recording stops without errors
- [ ] File uploaded to Vultr within 2 minutes
- [ ] File size > 0 bytes
- [ ] File format is .mp4

---

### **Test 3.2: Recording Download**

#### **Objective**: Test secure download URL generation

#### **Steps**:
```bash
# 1. Generate download URL
curl -X POST https://your-railway-app.com/api/jobs/998/video-recordings/$RECORDING_ID/download-url \
  -H "Authorization: Bearer valid_token" \
  -H "Content-Type: application/json" \
  -d '{
    "expirationSeconds": 3600
  }'

# 2. Expected response:
{
  "success": true,
  "recordingId": "recording-...",
  "downloadUrl": "https://ewr1.vultrobjects.com/notary-recordings-prod/recordings/.../recording.mp4?X-Amz-Algorithm=...",
  "expiresIn": 3600,
  "expiresAt": "2024-12-27T..."
}

# 3. Test download
curl -I "download_url_from_response"
# Should return 200 OK with video/mp4 content type
```

#### **Success Criteria**:
- [ ] Download URL generated successfully
- [ ] URL returns 200 OK status
- [ ] Content-Type is video/mp4
- [ ] File downloads completely
- [ ] URL expires after specified time

---

## 🌐 **PHASE 4: Frontend Integration Testing**

### **Test 4.1: Video Grid Component**

#### **Objective**: Test the 8-slot video grid UI

#### **Manual Test Steps**:
1. Navigate to job details page with video enabled
2. Verify video grid shows 8 predefined slots
3. Test participant joining (slots fill in order)
4. Verify video controls (mute, camera, screen share)
5. Test leaving session

#### **Success Criteria**:
- [ ] Grid shows exactly 8 video slots
- [ ] Slots fill in logical order (notary first, then signers)
- [ ] Empty slots show placeholder content
- [ ] Video quality is clear and stable
- [ ] Audio works without echo/feedback

---

### **Test 4.2: Waiting Room**

#### **Objective**: Test pre-session waiting room functionality

#### **Manual Test Steps**:
1. Access video session before it starts
2. Test camera/microphone preview
3. Verify participant list display
4. Test "Join Session" button
5. Verify transition to main video interface

#### **Success Criteria**:
- [ ] Waiting room displays correctly
- [ ] Camera preview works
- [ ] Microphone test functional
- [ ] Participant list accurate
- [ ] Smooth transition to main session

---

### **Test 4.3: Chat Panel**

#### **Objective**: Test real-time chat functionality

#### **Manual Test Steps**:
1. Open chat panel during video session
2. Send test messages
3. Verify message delivery
4. Test message history
5. Test participant indicators

#### **Success Criteria**:
- [ ] Chat panel opens/closes smoothly
- [ ] Messages send instantly
- [ ] Message history preserved
- [ ] Participant names display correctly
- [ ] Timestamps accurate

---

## ⚡ **PHASE 5: Performance Testing**

### **Test 5.1: Concurrent Sessions**

#### **Objective**: Test multiple simultaneous video sessions

#### **Test Script**:
```bash
#!/bin/bash
# concurrent_session_test.sh

for i in {1..5}; do
  SESSION_ID="perf-test-$i-$(date +%s)"
  
  curl -X POST https://your-railway-app.com/api/jobs/$((1000+i))/video-session \
    -H "Authorization: Bearer valid_token" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"$SESSION_ID\",
      \"participants\": [
        {\"userId\": $((i*10+1)), \"role\": \"notary\", \"displayName\": \"Notary $i\", \"email\": \"notary$i@test.com\"},
        {\"userId\": $((i*10+2)), \"role\": \"signer\", \"displayName\": \"Signer $i\", \"email\": \"signer$i@test.com\"}
      ]
    }" &
done
wait

echo "All sessions created. Testing concurrent recording..."

# Start recordings for all sessions
for i in {1..5}; do
  curl -X POST https://your-railway-app.com/api/jobs/$((1000+i))/video-recording/start \
    -H "Authorization: Bearer admin_token" \
    -H "Content-Type: application/json" \
    -d "{
      \"sessionId\": \"perf-test-$i-*\",
      \"layout\": \"grid\"
    }" &
done
wait
```

#### **Success Criteria**:
- [ ] All 5 sessions created successfully
- [ ] No timeout errors
- [ ] OpenVidu server stable under load
- [ ] Railway.co app responsive
- [ ] Memory usage within acceptable limits

---

### **Test 5.2: Recording Load Test**

#### **Objective**: Test multiple concurrent recordings

#### **Steps**:
1. Start 3 concurrent recording sessions
2. Let recordings run for 5 minutes each
3. Stop all recordings simultaneously
4. Verify all uploads to Vultr complete

#### **Success Criteria**:
- [ ] All recordings start successfully
- [ ] No recording failures during concurrent operation
- [ ] All recordings upload to Vultr
- [ ] Total upload time < 5 minutes per recording
- [ ] Vultr storage usage tracked correctly

---

## 📱 **PHASE 6: Cross-Platform Testing**

### **Test 6.1: Browser Compatibility**

#### **Test Matrix**:
| Browser | Version | Desktop | Mobile | Status |
|---------|---------|---------|---------|---------|
| Chrome | Latest | ✅ | ✅ | |
| Firefox | Latest | ✅ | ✅ | |
| Safari | Latest | ✅ | ✅ | |
| Edge | Latest | ✅ | ✅ | |

#### **Test Cases per Browser**:
- [ ] Video session joins successfully
- [ ] Camera/microphone permissions work
- [ ] Video quality acceptable
- [ ] Audio clear without issues
- [ ] Screen sharing functional
- [ ] Chat messages display correctly
- [ ] UI responsive and usable

---

### **Test 6.2: Mobile Device Testing**

#### **Device Matrix**:
| Device | OS | Browser | Screen Size | Status |
|--------|-------|---------|-------------|---------|
| iPhone 14 | iOS 16+ | Safari | 390×844 | |
| Galaxy S23 | Android 13+ | Chrome | 360×780 | |
| iPad Pro | iOS 16+ | Safari | 1024×1366 | |

#### **Mobile-Specific Tests**:
- [ ] Touch controls work properly
- [ ] Video grid scales appropriately  
- [ ] Portrait/landscape orientation
- [ ] Battery usage acceptable
- [ ] Network switching (WiFi ↔ Cellular)

---

## 🛡️ **PHASE 7: Security Testing**

### **Test 7.1: Authentication**

#### **Objective**: Verify proper access control

#### **Test Cases**:
```bash
# 1. Test unauthorized access
curl -X POST https://your-railway-app.com/api/jobs/123/video-session \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "unauthorized-test"}'
# Should return 401 Unauthorized

# 2. Test expired token
curl -X POST https://your-railway-app.com/api/jobs/123/video-session \
  -H "Authorization: Bearer expired_token" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "expired-test"}'
# Should return 401 Unauthorized

# 3. Test wrong role permissions
curl -X POST https://your-railway-app.com/api/jobs/123/video-recording/start \
  -H "Authorization: Bearer signer_token" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test"}'
# Should return 403 Forbidden (only notary/admin can start recording)
```

#### **Success Criteria**:
- [ ] Unauthorized requests rejected (401)
- [ ] Expired tokens rejected (401)
- [ ] Role-based access enforced (403)
- [ ] Valid tokens work correctly

---

### **Test 7.2: Data Protection**

#### **Objective**: Verify sensitive data handling

#### **Test Cases**:
- [ ] Recording files stored securely in Vultr
- [ ] Download URLs have expiration
- [ ] Participant data not leaked in logs
- [ ] WebRTC traffic encrypted
- [ ] No sensitive data in error messages

---

## 🚨 **PHASE 8: Failure Testing**

### **Test 8.1: Network Failures**

#### **Objective**: Test resilience to network issues

#### **Scenarios**:
1. **OpenVidu Server Unreachable**:
   - Stop OpenVidu Docker container
   - Try creating video session
   - Verify graceful error handling

2. **Vultr Storage Unavailable**:
   - Block access to Vultr endpoints
   - Stop recording and verify error handling
   - Ensure main app functionality continues

3. **Temporary Network Loss**:
   - Simulate network interruption during session
   - Verify automatic reconnection attempts
   - Test session recovery

#### **Success Criteria**:
- [ ] Clear error messages displayed to users
- [ ] No application crashes
- [ ] Automatic retry mechanisms work
- [ ] Graceful degradation when services unavailable

---

### **Test 8.2: High Load Failures**

#### **Objective**: Test behavior under extreme load

#### **Scenarios**:
1. **Memory Exhaustion**:
   - Create 20+ concurrent sessions
   - Monitor memory usage
   - Verify graceful handling when limits reached

2. **Storage Full**:
   - Fill Vultr bucket to near capacity
   - Test recording upload failure handling
   - Verify error notifications

#### **Success Criteria**:
- [ ] Application remains stable under high load
- [ ] Resource exhaustion handled gracefully
- [ ] Users receive clear error messages
- [ ] Monitoring alerts triggered appropriately

---

## 📊 **Test Results Documentation**

### **Test Report Template**:
```markdown
# OpenVidu Production Test Results

**Test Date**: YYYY-MM-DD
**Tester**: [Name]
**Environment**: Production/Staging

## Summary
- **Total Tests**: X
- **Passed**: X
- **Failed**: X  
- **Skipped**: X

## Infrastructure Tests
- OpenVidu Server: ✅/❌
- Vultr Storage: ✅/❌
- Railway.co App: ✅/❌

## Functional Tests
- Video Sessions: ✅/❌
- Recording: ✅/❌
- Frontend: ✅/❌

## Performance Tests
- Concurrent Sessions: ✅/❌
- Recording Load: ✅/❌

## Security Tests
- Authentication: ✅/❌
- Data Protection: ✅/❌

## Failure Tests
- Network Failures: ✅/❌
- High Load: ✅/❌

## Issues Found
1. [Description of issue]
   - **Severity**: High/Medium/Low
   - **Impact**: [Description]
   - **Resolution**: [Steps taken]

## Recommendations
- [List of recommendations for improvements]

## Sign-off
- **QA Approval**: ✅/❌
- **Security Approval**: ✅/❌  
- **Performance Approval**: ✅/❌
- **Production Ready**: ✅/❌
```

---

## ✅ **Test Completion Criteria**

The system is considered **production ready** when:

### **Critical Requirements (Must Pass)**:
- [ ] All infrastructure tests pass
- [ ] Video session creation/management works
- [ ] Recording and Vultr upload functional
- [ ] Frontend components display correctly
- [ ] Authentication and authorization secure
- [ ] Basic error handling implemented

### **Performance Requirements**:
- [ ] Support 5 concurrent video sessions
- [ ] Recording upload completes within 5 minutes
- [ ] UI responsive on desktop and mobile
- [ ] Page load times < 3 seconds

### **Security Requirements**:
- [ ] No unauthorized access possible
- [ ] Recording files secure in Vultr
- [ ] Download URLs expire properly
- [ ] WebRTC connections encrypted

### **Quality Requirements**:
- [ ] Video quality 720p minimum
- [ ] Audio clear without echo/feedback
- [ ] UI works in all major browsers
- [ ] Error messages user-friendly

---

## 🎯 **Next Steps After Testing**

1. **Document any issues** found during testing
2. **Fix critical bugs** before production deployment
3. **Update monitoring** based on test findings
4. **Train support team** on new video system
5. **Plan rollback strategy** in case of issues
6. **Schedule go-live date** when all tests pass

**🚀 Production deployment approved when all critical tests pass!** 