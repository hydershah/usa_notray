# Real-Time Collaboration Guide

## Overview

This guide explains how to use the comprehensive real-time collaboration features between notary and signer in the PDF editor. All interactions are synchronized in real-time using WebSocket connections, providing instant feedback for both parties.

## Features

### 🔄 Real-Time Tag Operations

#### Tag Placement
- **What happens**: When a notary places a tag, signers see it appear instantly
- **Visual feedback**: Smooth animation with user attribution
- **Notification**: Toast notification shows who added the tag

#### Tag Movement
- **Real-time dragging**: See tags move as they're being dragged by other users
- **Smooth animations**: 20fps update rate for fluid movement
- **Visual indicators**: Shows "Moving..." indicator during drag operations

#### Tag Resizing
- **Live resizing**: Watch tags resize in real-time as other users adjust them
- **Resize handles**: Blue resize handle appears when tag is selected
- **Visual feedback**: "Resizing..." indicator during resize operations

#### Tag Deletion
- **Instant removal**: Tags disappear immediately when deleted by any user
- **Confirmation**: Toast notification shows who deleted the tag

#### Tag Content Updates
- **Live content**: See text, signatures, and other content appear as it's entered
- **Completion status**: Visual indicators when tags are completed
- **User attribution**: Shows who completed each tag

### 👥 User Presence & Activity

#### Live Cursor Tracking
- **Real-time cursors**: See other users' mouse cursors in real-time
- **User identification**: Color-coded cursors with user names and roles
- **Page-specific**: Cursors only show on the current page being viewed

#### Typing Indicators
- **Live typing**: See when other users are typing in text fields
- **Field-specific**: Shows which field the user is typing in
- **Auto-clear**: Typing indicators disappear after 3 seconds of inactivity

#### User Status
- **Online/offline**: Real-time connection status for all participants
- **Current page**: See which page each user is viewing
- **Role indicators**: Notary (👨‍⚖️) and Signer (✍️) emojis for easy identification

### 📊 Real-Time UI Components

#### Connection Status Indicator
- **Location**: Top-right corner
- **Status colors**:
  - 🟢 Green: Connected and active
  - 🟡 Yellow: Connecting/reconnecting
  - 🔴 Red: Disconnected
- **Reconnection**: Automatic retry with exponential backoff
- **Manual retry**: Click "Retry" button if connection fails

#### Participants Panel
- **Location**: Bottom-left corner
- **Expandable**: Click +/- to show/hide participant list
- **Real-time updates**: Shows current page, typing status, and connection state
- **User roles**: Clear identification of notary vs signers

#### Activity Feed
- **Location**: Top-left corner
- **Live statistics**: Shows number of active users and typing indicators
- **Status overview**: Quick view of collaboration activity

### 🎯 How to Use

#### For Notaries

1. **Start a Session**
   - Create a new notarization session
   - Invite signers via email
   - Wait for participants to join

2. **Real-Time Tagging**
   - Place tags on documents - signers see them instantly
   - Drag tags to reposition - movement is synchronized
   - Resize tags using the blue handle - changes appear in real-time
   - Delete tags when needed - immediate removal for all users

3. **Guide Signers**
   - Use "Sync Users" to bring everyone to the same page
   - Watch signers' cursors to see where they're looking
   - Monitor typing indicators to see when signers are entering information

4. **Monitor Progress**
   - Watch tags being completed in real-time
   - See signers' current page and activity
   - Use the activity feed to track collaboration status

#### For Signers

1. **Join Session**
   - Click the invitation link
   - Enter your information
   - Wait for the notary to start

2. **Real-Time Interaction**
   - Watch tags appear as the notary places them
   - See tag movement and resizing in real-time
   - Complete assigned tags - notary sees content immediately
   - Navigate pages independently or follow notary's sync

3. **Stay Connected**
   - Monitor connection status in top-right corner
   - Watch for typing indicators from other participants
   - Use the participants panel to see who's online

### 🔧 Technical Features

#### WebSocket Synchronization
- **Automatic reconnection**: Handles network interruptions gracefully
- **Message queuing**: Actions are queued and sent when connection is restored
- **Throttling**: Prevents spam updates (20fps for movement, 10fps for cursors)
- **Optimistic updates**: UI updates immediately, then syncs with server

#### Performance Optimization
- **Page-specific updates**: Only sync data for the current page
- **Throttled updates**: Prevents excessive network traffic
- **Efficient rendering**: Uses React.memo and optimized animations
- **Memory management**: Automatic cleanup of disconnected users

#### Error Handling
- **Connection recovery**: Automatic reconnection with exponential backoff
- **State synchronization**: Request full state when reconnecting
- **User feedback**: Clear error messages and retry options
- **Graceful degradation**: Works offline with local state

### 🎨 Visual Indicators

#### Cursor Colors
- Each user gets a unique color based on their user ID
- Colors are consistent across sessions
- Cursor includes user name and role emoji

#### Status Indicators
- 🟢 Green dot: Active and connected
- 🟡 Yellow dot: Recently joined
- 🔴 Red dot: Disconnected
- 🔵 Blue dot: Currently typing

#### Animation States
- **Smooth transitions**: All state changes are animated
- **Loading states**: Spinners and progress indicators
- **Success/error**: Color-coded feedback for actions

### 📱 Mobile Support

#### Responsive Design
- All collaboration UI adapts to mobile screens
- Touch-friendly controls for tag manipulation
- Optimized for smaller viewports

#### Mobile Limitations
- Cursor tracking may be less precise on touch devices
- Some advanced features may be simplified on mobile
- Performance may vary based on device capabilities

### 🔒 Security Features

#### Authentication
- All WebSocket connections require valid JWT tokens
- Session-based access control
- Automatic token refresh

#### Data Validation
- All incoming messages are validated
- Malicious data is rejected
- Rate limiting prevents abuse

#### Privacy
- Only session participants can see real-time data
- No data is stored permanently in WebSocket sessions
- Automatic cleanup of inactive sessions

### 🚀 Best Practices

#### For Optimal Performance
1. **Stable connection**: Use reliable internet connection
2. **Browser compatibility**: Use modern browsers (Chrome, Firefox, Safari, Edge)
3. **Close unused tabs**: Reduce memory usage
4. **Regular refreshes**: Refresh page if experiencing issues

#### For Better Collaboration
1. **Clear communication**: Use the real-time indicators to understand others' actions
2. **Take turns**: Avoid simultaneous editing of the same tag
3. **Monitor status**: Keep an eye on connection and participant status
4. **Use sync features**: Let the notary guide the session flow

#### Troubleshooting
1. **Connection issues**: Check internet connection and try refreshing
2. **Missing updates**: Request session state sync if data seems stale
3. **Performance problems**: Close other browser tabs and applications
4. **Visual glitches**: Refresh the page to reset the interface

### 📈 Monitoring & Analytics

#### Session Statistics
- Active participants count
- Real-time message throughput
- Connection quality metrics
- Error rates and recovery times

#### User Activity Tracking
- Page navigation patterns
- Tag interaction frequency
- Session duration metrics
- Collaboration effectiveness

This real-time collaboration system provides a seamless experience for notaries and signers, ensuring that all parties can work together efficiently with full visibility into each other's actions. 