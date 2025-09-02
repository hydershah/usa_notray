import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'checking';
  message: string;
  details?: string;
}

interface DiagnosticProps {
  jobId: number;
  onRetry?: () => void;
}

const VideoConferenceDiagnostics: React.FC<DiagnosticProps> = ({ jobId, onRetry }) => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateDiagnostic = (name: string, updates: Partial<DiagnosticResult>) => {
    setDiagnostics(prev => prev.map(d => 
      d.name === name ? { ...d, ...updates } : d
    ));
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    
    // Initialize diagnostic tests
    const initialDiagnostics: DiagnosticResult[] = [
      { name: 'browser-support', status: 'checking', message: 'Checking browser compatibility...' },
      { name: 'webrtc-support', status: 'checking', message: 'Checking WebRTC support...' },
      { name: 'media-permissions', status: 'checking', message: 'Checking camera/microphone permissions...' },
      { name: 'daily-api-config', status: 'checking', message: 'Checking Daily.co API configuration...' },
      { name: 'session-creation', status: 'checking', message: 'Testing video session creation...' },
      { name: 'network-connectivity', status: 'checking', message: 'Checking network connectivity...' },
      { name: 'websocket-connection', status: 'checking', message: 'Testing WebSocket connection...' }
    ];
    
    setDiagnostics(initialDiagnostics);

    try {
      // Test 1: Browser Support
      await new Promise(resolve => setTimeout(resolve, 500));
      const userAgent = navigator.userAgent;
      const isSupported = 
        userAgent.includes('Chrome') || 
        userAgent.includes('Firefox') || 
        userAgent.includes('Safari') || 
        userAgent.includes('Edge');
      
      updateDiagnostic('browser-support', {
        status: isSupported ? 'pass' : 'warning',
        message: isSupported ? 'Browser is supported' : 'Browser may have limited support',
        details: `User Agent: ${userAgent}`
      });

      // Test 2: WebRTC Support
      await new Promise(resolve => setTimeout(resolve, 500));
      const hasWebRTC = !!(window.RTCPeerConnection && navigator.mediaDevices?.getUserMedia);
      updateDiagnostic('webrtc-support', {
        status: hasWebRTC ? 'pass' : 'fail',
        message: hasWebRTC ? 'WebRTC is supported' : 'WebRTC is not supported',
        details: `RTCPeerConnection: ${!!window.RTCPeerConnection}, getUserMedia: ${!!navigator.mediaDevices?.getUserMedia}`
      });

      // Test 3: Media Permissions
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(track => track.stop());
        updateDiagnostic('media-permissions', {
          status: 'pass',
          message: 'Camera and microphone access granted',
          details: 'Successfully accessed media devices'
        });
      } catch (error: any) {
        let status: 'fail' | 'warning' = 'fail';
        let message = 'Media access denied';
        let details = error.message;

        if (error.name === 'NotAllowedError') {
          message = 'Camera/microphone permission denied';
          details = 'Please click the camera icon in your browser address bar and allow permissions';
        } else if (error.name === 'NotFoundError') {
          message = 'No camera or microphone found';
          details = 'Please connect a camera and microphone';
        } else if (error.name === 'NotReadableError') {
          message = 'Camera/microphone already in use';
          details = 'Close other video applications and try again';
        }

        updateDiagnostic('media-permissions', { status, message, details });
      }

      // Test 4: Daily.co API Configuration
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          updateDiagnostic('daily-api-config', {
            status: 'fail',
            message: 'No authentication token found',
            details: 'Please log in again'
          });
        } else {
          const response = await fetch('/api/daily/test-config', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            const data = await response.json();
            updateDiagnostic('daily-api-config', {
              status: data.configured ? 'pass' : 'warning',
              message: data.configured ? 'Daily.co API is configured' : 'Daily.co API not fully configured',
              details: `API Key: ${data.hasApiKey ? 'Present' : 'Missing'}, Domain: ${data.hasDomain ? data.domain : 'Missing'}`
            });
          } else {
            updateDiagnostic('daily-api-config', {
              status: 'fail',
              message: 'Failed to check Daily.co configuration',
              details: `HTTP ${response.status}: ${response.statusText}`
            });
          }
        }
      } catch (error: any) {
        updateDiagnostic('daily-api-config', {
          status: 'fail',
          message: 'Error checking Daily.co configuration',
          details: error.message
        });
      }

      // Test 5: Video Session Creation
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const startTime = Date.now();
          const response = await fetch(`/api/jobs/${jobId}/video-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          const responseTime = Date.now() - startTime;
          
          if (response.ok) {
            const data = await response.json();
            updateDiagnostic('session-creation', {
              status: data.success ? 'pass' : 'fail',
              message: data.success ? `Video session created successfully (${responseTime}ms)` : 'Failed to create video session',
              details: `Response: ${JSON.stringify(data, null, 2)}`
            });
          } else {
            const errorText = await response.text();
            updateDiagnostic('session-creation', {
              status: 'fail',
              message: `Video session creation failed (${responseTime}ms)`,
              details: `HTTP ${response.status}: ${errorText}`
            });
          }
        }
      } catch (error: any) {
        updateDiagnostic('session-creation', {
          status: 'fail',
          message: 'Error creating video session',
          details: error.message
        });
      }

      // Test 6: Network Connectivity
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const startTime = Date.now();
        const response = await fetch('https://api.daily.co/v1/rooms', {
          method: 'GET',
          mode: 'no-cors' // Just test connectivity
        });
        const responseTime = Date.now() - startTime;
        
        updateDiagnostic('network-connectivity', {
          status: responseTime < 5000 ? 'pass' : 'warning',
          message: `Daily.co API reachable (${responseTime}ms)`,
          details: responseTime > 3000 ? 'Slow network connection detected' : 'Good network connection'
        });
      } catch (error: any) {
        updateDiagnostic('network-connectivity', {
          status: 'fail',
          message: 'Cannot reach Daily.co servers',
          details: 'Check your internet connection and firewall settings'
        });
      }

      // Test 7: WebSocket Connection
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/socket.io/?EIO=4&transport=websocket`;
        
        const ws = new WebSocket(wsUrl);
        
        const wsTest = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve();
          };

          ws.onerror = (error) => {
            clearTimeout(timeout);
            reject(new Error('WebSocket connection failed'));
          };
        });

        await wsTest;
        updateDiagnostic('websocket-connection', {
          status: 'pass',
          message: 'WebSocket connection successful',
          details: 'Real-time communication is working'
        });
      } catch (error: any) {
        updateDiagnostic('websocket-connection', {
          status: 'warning',
          message: 'WebSocket connection issues',
          details: 'Real-time features may be limited. Video may still work.'
        });
      }

    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, [jobId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'checking':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-700 bg-green-50 border-green-200';
      case 'fail': return 'text-red-700 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'checking': return 'text-blue-700 bg-blue-50 border-blue-200';
      default: return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const failedTests = diagnostics.filter(d => d.status === 'fail').length;
  const warningTests = diagnostics.filter(d => d.status === 'warning').length;
  const passedTests = diagnostics.filter(d => d.status === 'pass').length;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className={`w-6 h-6 ${isRunning ? 'animate-spin' : ''}`} />
          Video Conference Diagnostics
        </CardTitle>
        <div className="flex gap-4 text-sm">
          <span className="text-blue-600">✅ Passed: {passedTests}</span>
          <span className="text-yellow-600">⚠️ Warnings: {warningTests}</span>
          <span className="text-red-600">❌ Failed: {failedTests}</span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {diagnostics.map((diagnostic) => (
          <div
            key={diagnostic.name}
            className={`p-4 rounded-lg border ${getStatusColor(diagnostic.status)}`}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(diagnostic.status)}
              <div className="flex-1">
                <div className="font-medium">{diagnostic.message}</div>
                {diagnostic.details && (
                  <div className="text-sm mt-1 opacity-75">
                    {diagnostic.details}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {failedTests > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <XCircle className="w-4 h-4 text-red-500" />
            <AlertDescription className="text-red-700">
              <strong>Critical Issues Found:</strong> {failedTests} test(s) failed. Video conferencing may not work properly.
              Please resolve the failed tests before attempting to start the video session.
            </AlertDescription>
          </Alert>
        )}

        {failedTests === 0 && warningTests > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <AlertDescription className="text-yellow-700">
              <strong>Minor Issues:</strong> {warningTests} warning(s) detected. Video conferencing should work but may have reduced functionality.
            </AlertDescription>
          </Alert>
        )}

        {failedTests === 0 && warningTests === 0 && passedTests > 0 && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <AlertDescription className="text-green-700">
              <strong>All Tests Passed:</strong> Your system appears ready for video conferencing.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 pt-4">
          <Button 
            onClick={runDiagnostics}
            disabled={isRunning}
            variant="outline"
          >
            {isRunning ? 'Running Tests...' : 'Run Tests Again'}
          </Button>
          
          {onRetry && failedTests === 0 && (
            <Button 
              onClick={onRetry}
              className="bg-green-600 hover:bg-green-700"
            >
              Try Video Conference Again
            </Button>
          )}
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm">
          <h4 className="font-medium mb-2">Troubleshooting Tips:</h4>
          <ul className="space-y-1 text-gray-600">
            <li>• Make sure you allow camera and microphone permissions when prompted</li>
            <li>• Close other video applications (Zoom, Teams, etc.) that might be using your camera</li>
            <li>• Try refreshing the page if permissions were previously denied</li>
            <li>• Check your internet connection - video calls require stable connectivity</li>
            <li>• Use Chrome, Firefox, Safari, or Edge for best compatibility</li>
            <li>• Disable browser extensions that might block video calls</li>
            <li>• If behind a corporate firewall, contact IT about WebRTC and Daily.co access</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoConferenceDiagnostics; 