import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useWebRTCAuth } from '@/hooks/useWebRTCAuth';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  Video, 
  Mic, 
  Wifi,
  Eye
} from 'lucide-react';

interface VideoDebugInfoProps {
  sessionId: string;
  className?: string;
}

interface DebugCheck {
  name: string;
  status: 'checking' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export const VideoDebugInfo: React.FC<VideoDebugInfoProps> = ({
  sessionId,
  className = ''
}) => {
  const { token, isAuthenticated, error: authError } = useWebRTCAuth();
  const [checks, setChecks] = useState<DebugCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateCheck = (index: number, updates: Partial<DebugCheck>) => {
    setChecks(prev => prev.map((check, i) => 
      i === index ? { ...check, ...updates } : check
    ));
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    
    const initialChecks: DebugCheck[] = [
      { name: 'Browser Support', status: 'checking', message: 'Checking WebRTC support...' },
      { name: 'Authentication', status: 'checking', message: 'Validating auth token...' },
      { name: 'Camera Access', status: 'checking', message: 'Testing camera access...' },
      { name: 'Microphone Access', status: 'checking', message: 'Testing microphone access...' },
      { name: 'Network Connectivity', status: 'checking', message: 'Testing network connection...' },
      { name: 'Signaling Server', status: 'checking', message: 'Connecting to signaling server...' }
    ];
    
    setChecks(initialChecks);

    // Check 1: Browser Support
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        updateCheck(0, {
          status: 'error',
          message: 'WebRTC not supported',
          details: 'Your browser does not support WebRTC. Please use Chrome, Firefox, Safari, or Edge.'
        });
      } else if (!window.RTCPeerConnection) {
        updateCheck(0, {
          status: 'error',
          message: 'RTCPeerConnection not available',
          details: 'WebRTC peer connections are not supported in this browser.'
        });
      } else {
        updateCheck(0, {
          status: 'success',
          message: 'WebRTC fully supported',
          details: 'All required WebRTC APIs are available.'
        });
      }
    } catch (error) {
      updateCheck(0, {
        status: 'error',
        message: 'Browser check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check 2: Authentication
    try {
      if (authError) {
        updateCheck(1, {
          status: 'error',
          message: 'Authentication failed',
          details: authError
        });
      } else if (!token) {
        updateCheck(1, {
          status: 'error',
          message: 'No auth token',
          details: 'Please log in to access video conferencing.'
        });
      } else if (!isAuthenticated) {
        updateCheck(1, {
          status: 'warning',
          message: 'Auth status unclear',
          details: 'Token exists but authentication status is unclear.'
        });
      } else {
        updateCheck(1, {
          status: 'success',
          message: 'Authentication valid',
          details: 'User is properly authenticated.'
        });
      }
    } catch (error) {
      updateCheck(1, {
        status: 'error',
        message: 'Auth check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Check 3: Camera Access
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoStream.getTracks().forEach(track => track.stop());
      updateCheck(2, {
        status: 'success',
        message: 'Camera access granted',
        details: 'Camera is available and accessible.'
      });
    } catch (error: any) {
      let message = 'Camera access failed';
      let details = '';
      
      if (error.name === 'NotAllowedError') {
        message = 'Camera access denied';
        details = 'Please allow camera access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        message = 'No camera found';
        details = 'Please connect a camera device.';
      } else if (error.name === 'NotReadableError') {
        message = 'Camera in use';
        details = 'Camera is being used by another application.';
      } else {
        details = error.message || 'Unknown camera error';
      }

      updateCheck(2, {
        status: 'error',
        message,
        details
      });
    }

    // Check 4: Microphone Access
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.getTracks().forEach(track => track.stop());
      updateCheck(3, {
        status: 'success',
        message: 'Microphone access granted',
        details: 'Microphone is available and accessible.'
      });
    } catch (error: any) {
      let message = 'Microphone access failed';
      let details = '';
      
      if (error.name === 'NotAllowedError') {
        message = 'Microphone access denied';
        details = 'Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError') {
        message = 'No microphone found';
        details = 'Please connect a microphone device.';
      } else if (error.name === 'NotReadableError') {
        message = 'Microphone in use';
        details = 'Microphone is being used by another application.';
      } else {
        details = error.message || 'Unknown microphone error';
      }

      updateCheck(3, {
        status: 'error',
        message,
        details
      });
    }

    // Check 5: Network Connectivity
    try {
      const response = await fetch('/api/session/24/state', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        updateCheck(4, {
          status: 'success',
          message: 'Network connection OK',
          details: 'API endpoints are accessible.'
        });
      } else {
        updateCheck(4, {
          status: 'warning',
          message: `API returned ${response.status}`,
          details: 'Network works but API may have issues.'
        });
      }
    } catch (error) {
      updateCheck(4, {
        status: 'error',
        message: 'Network connection failed',
        details: error instanceof Error ? error.message : 'Cannot reach server'
      });
    }

    // Check 6: Signaling Server
    try {
      const { io } = await import('socket.io-client');
      
      const socket = io(`${window.location.origin}/video-signaling`, {
        auth: { token },
        query: {
          sessionId,
          userId: '1',
          userName: 'Test User',
          userRole: 'test'
        },
        path: '/video-signaling/socket.io',
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          updateCheck(5, {
            status: 'success',
            message: 'Signaling server connected',
            details: 'WebSocket connection established successfully.'
          });
          socket.disconnect();
          resolve(void 0);
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          updateCheck(5, {
            status: 'error',
            message: 'Signaling connection failed',
            details: error.message || 'Cannot connect to video signaling server.'
          });
          reject(error);
        });
      });
    } catch (error) {
      updateCheck(5, {
        status: 'error',
        message: 'Signaling test failed',
        details: error instanceof Error ? error.message : 'Signaling server unreachable'
      });
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status: DebugCheck['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: DebugCheck['status']) => {
    switch (status) {
      case 'checking':
        return 'border-blue-200 bg-blue-50';
      case 'success':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
    }
  };

  useEffect(() => {
    if (checks.length === 0) {
      runDiagnostics();
    }
  }, []);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Video Conference Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Running system checks to diagnose video connection issues...
          </p>
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            size="sm"
            variant="outline"
          >
            {isRunning ? 'Running...' : 'Run Again'}
          </Button>
        </div>

        <div className="space-y-3">
          {checks.map((check, index) => (
            <div 
              key={index} 
              className={`p-3 rounded-lg border ${getStatusColor(check.status)}`}
            >
              <div className="flex items-center gap-3">
                {getStatusIcon(check.status)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{check.name}</span>
                    <Badge 
                      variant={check.status === 'success' ? 'default' : 
                               check.status === 'error' ? 'destructive' : 'secondary'}
                    >
                      {check.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{check.message}</p>
                  {check.details && (
                    <p className="text-xs text-gray-500 mt-1">{check.details}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Session Information</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <div>Session ID: {sessionId}</div>
            <div>Browser: {navigator.userAgent.split(' ').slice(-2).join(' ')}</div>
            <div>Protocol: {window.location.protocol}</div>
            <div>Host: {window.location.host}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 