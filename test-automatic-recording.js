// Test script for automatic screen recording
const { automaticScreenRecorder } = require('./server/services/automatic-screen-recorder');

async function testAutomaticRecording() {
  try {
    console.log('🧪 Testing automatic screen recording...');
    
    // Test parameters
    const sessionId = 'test-session-123';
    const jobId = 33;
    const signingUrl = 'http://localhost:3003/editor/33?mode=signing&session=33';
    
    console.log('📝 Test parameters:', {
      sessionId,
      jobId,
      signingUrl
    });
    
    // Test start recording
    console.log('🎬 Starting recording test...');
    const startResult = await automaticScreenRecorder.startRecording(
      sessionId,
      jobId,
      signingUrl
    );
    
    console.log('✅ Start result:', startResult);
    
    if (startResult.success) {
      // Wait 5 seconds
      console.log('⏳ Recording for 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Test stop recording
      console.log('🛑 Stopping recording test...');
      const stopResult = await automaticScreenRecorder.stopRecording(sessionId, jobId);
      
      console.log('✅ Stop result:', stopResult);
    }
    
    // Cleanup
    await automaticScreenRecorder.cleanup();
    console.log('🧹 Cleanup completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run test if script is executed directly
if (require.main === module) {
  testAutomaticRecording();
} 