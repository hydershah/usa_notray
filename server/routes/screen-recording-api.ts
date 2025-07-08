// Screen Recording API (DISABLED)
import { Router } from 'express';
import { verifyToken } from '../auth';
// Automatic screen recorder import removed - feature disabled

const router = Router();

// Start automatic screen recording (DISABLED - returns success without recording)
router.post('/sessions/:sessionId/screen-recording/start', verifyToken, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const { jobId, signingUrl } = req.body;
    
    console.log(`📱 Screen recording feature disabled for session ${sessionId}`);
    
    // Return success without actually starting recording
    res.json({
      success: true,
      sessionId,
      recordingId: `disabled-${sessionId}`,
      recordingUrl: `/api/sessions/${sessionId}/screen-recording/status`,
      message: 'Recording feature is currently disabled'
    });
    
  } catch (error) {
    console.error('Screen recording API error:', error);
    res.status(500).json({ error: 'Screen recording API error' });
  }
});

// Stop automatic screen recording (DISABLED - returns success without stopping)
router.post('/sessions/:sessionId/screen-recording/stop', verifyToken, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    const { jobId } = req.body;
    
    console.log(`📱 Screen recording stop request for session ${sessionId} - feature is disabled`);
    
    // Return success without actually stopping recording
    res.json({
      success: true,
      sessionId,
      uploadResult: null,
      message: 'Recording feature is disabled - no recording to stop'
    });
    
  } catch (error) {
    console.error('Screen recording API error:', error);
    res.status(500).json({ error: 'Screen recording API error' });
  }
});

// Get automatic recording status (DISABLED)
router.get('/sessions/:sessionId/screen-recording/status', verifyToken, async (req: any, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log(`📱 Screen recording status check for session ${sessionId} - feature is disabled`);
    
    res.json({
      success: true,
      sessionId,
      status: 'disabled',
      recordingType: 'feature_disabled',
      message: 'Screen recording feature is currently disabled'
    });
    
  } catch (error) {
    console.error('Screen recording API error:', error);
    res.status(500).json({ error: 'Screen recording API error' });
  }
});

export default router; 