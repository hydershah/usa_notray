# Whereby Video Integration Guide

## Overview

The application now uses Whereby's modern Browser SDK with React hooks for high-quality video conferencing during live notary sessions. This provides a professional, white-label video experience with full customization.

## Features

### ✅ Current Implementation
- **Modern React Hooks**: Using `@whereby.com/browser-sdk` for seamless integration
- **Custom Video Grid**: Professional layout with local and remote participants
- **Meeting Controls**: Microphone, camera, screen sharing, and recording controls
- **Role-based Features**: Notary-specific recording controls
- **Session Management**: Automatic room creation and participant management
- **Real-time Events**: Participant join/leave notifications
- **Connection Status**: Visual indicators for connection quality

### 🎯 Key Components

#### 1. WherebyIntegration Component
Located: `client/src/components/video/whereby-integration.tsx`

```typescript
<WherebyIntegration
  roomUrl={roomUrl}
  jobId={jobId}
  userId={currentUser.id}
  userName={getUserDisplayName(currentUser)}
  userRole={currentUser.role}
  onParticipantJoin={(participant) => {
    // Handle participant joining
  }}
  onParticipantLeave={(participant) => {
    // Handle participant leaving
  }}
  onRecordingStart={() => {
    // Handle recording start
  }}
  onRecordingStop={() => {
    // Handle recording stop
  }}
/>
```

#### 2. Backend API Endpoints
- `POST /api/jobs/:jobId/video-session` - Create new video session
- `GET /api/jobs/:jobId/video-session` - Get existing session
- `POST /api/jobs/:jobId/video-session/recording` - Save recording metadata
- `DELETE /api/jobs/:jobId/video-session` - End video session

## Usage in Live Signing

The Whereby integration is automatically used in the live signing session (`live-signing-session.tsx`):

1. **Session Start**: Creates a unique Whereby room for the job
2. **Participant Management**: Tracks all participants and their connection status
3. **Recording**: Notaries can start/stop recording with one click
4. **Screen Sharing**: Built-in screen sharing for document review
5. **Session End**: Automatically saves recording metadata

## Configuration

### Environment Variables
Add to your `.env` file:
```bash
WHEREBY_SUBDOMAIN=your-subdomain
```

If not set, defaults to `notary-digital`.

### Room URL Format
```
https://{subdomain}.whereby.com/notary-session-{jobId}-{timestamp}
```

## Technical Details

### React Hooks Used
- `useRoomConnection()` - Main Whereby connection hook
- `VideoView` - Component for rendering video streams
- Actions: `toggleCamera()`, `toggleMicrophone()`, `startRecording()`, etc.

### Video Layout
- **Local Video**: Small overlay in bottom-right corner
- **Remote Participants**: Grid layout (1-3 columns based on participant count)
- **Responsive Design**: Adapts to different screen sizes
- **Professional UI**: Clean, notary-focused interface

### Event Handling
```typescript
// Connection events
useEffect(() => {
  if (localParticipant?.stream && !isConnected) {
    setIsConnected(true);
    // Handle connection success
  }
}, [localParticipant?.stream]);

// Participant events
useEffect(() => {
  remoteParticipants.forEach(participant => {
    if (participant.stream) {
      onParticipantJoin?.(participant);
    }
  });
}, [remoteParticipants]);
```

## Security & Compliance

- **Encrypted Video**: All video streams are encrypted by Whereby
- **HIPAA Ready**: Whereby provides HIPAA-compliant infrastructure when configured
- **Recording Security**: Recordings can be saved to secure cloud storage
- **Audit Trail**: Complete session logs and participant tracking

## Testing

To test the integration:

1. Start the development server: `npm run dev`
2. Navigate to a live signing session: `http://localhost:3000/live-signing?jobId=7`
3. Start the session to activate video
4. Allow camera/microphone permissions when prompted
5. Test controls (mute/unmute, camera on/off, screen share)

## Troubleshooting

### Common Issues

1. **"Camera Access Denied"**
   - Ensure browser has camera/microphone permissions
   - Check if another application is using the camera

2. **"Connection Failed"**
   - Verify internet connection
   - Check if Whereby subdomain is correctly configured

3. **"Recording Not Starting"**
   - Only notaries can start recordings
   - Ensure user role is set correctly

### Browser Support
- Chrome 73+
- Firefox 65+
- Safari 12+
- Edge 79+

## Next Steps

Potential enhancements:
- [ ] Cloud recording integration (AWS S3, Google Cloud)
- [ ] Background blur/virtual backgrounds
- [ ] Chat functionality
- [ ] Breakout rooms for multiple signers
- [ ] Recording transcription
- [ ] Advanced analytics and reporting 