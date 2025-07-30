import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Video, Mic, MicOff, VideoOff, 
  Settings, Camera, Monitor, Info
} from 'lucide-react';

interface VideoPreviewProps {
  jobId: number;
  onRecordingStart?: (recordingId: string) => void;
  onRecordingComplete?: (recording: any) => void;
  autoStart?: boolean;
}

export function EnhancedVideoRecorder({
  jobId,
  onRecordingStart,
  onRecordingComplete,
  autoStart = false
}: VideoPreviewProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [streamActive, setStreamActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Get available devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(deviceList => {
      setDevices(deviceList);
      
      const cameras = deviceList.filter(d => d.kind === 'videoinput');
      const mics = deviceList.filter(d => d.kind === 'audioinput');
      
      if (cameras.length > 0) setSelectedCamera(cameras[0].deviceId);
      if (mics.length > 0) setSelectedMicrophone(mics[0].deviceId);
    });
  }, []);

  // Auto-start video preview when component mounts if enabled
  useEffect(() => {
    if (autoStart && selectedCamera && selectedMicrophone) {
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        initializeStream();
      }, 500);
    }
  }, [autoStart, selectedCamera, selectedMicrophone]);

  // Initialize stream for preview only
  const initializeStream = async () => {
    try {
      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: isVideoEnabled ? {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false,
        audio: isAudioEnabled ? {
          deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
          echoCancellation: true,
          noiseSuppression: true
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStreamActive(true);
      
      // Notify that recording capabilities are ready (for Daily.co)
      if (onRecordingStart && autoStart) {
        const recordingId = `preview_${jobId}_${Date.now()}`;
        onRecordingStart(recordingId);
      }

      toast({
        title: "Camera Ready",
        description: "Video preview is active. Recording will be handled by the video conference system.",
      });

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      toast({
        title: "Camera/Microphone Error",
        description: "Failed to access camera or microphone. Please check permissions.",
        variant: "destructive"
      });
      throw error;
    }
  };

  // Toggle video/audio
  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Device change handlers
  const handleCameraChange = (deviceId: string) => {
    setSelectedCamera(deviceId);
    if (streamActive) {
      initializeStream();
    }
  };

  const handleMicrophoneChange = (deviceId: string) => {
    setSelectedMicrophone(deviceId);
    if (streamActive) {
      initializeStream();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Video Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Preview */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff className="w-16 h-16 text-gray-500" />
            </div>
          )}

          {/* Status indicator */}
          <div className="absolute top-2 left-2">
            <Badge variant={streamActive ? "default" : "secondary"}>
              {streamActive ? "Preview Active" : "Preview Inactive"}
            </Badge>
          </div>
        </div>

        {/* Recording Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-700">
              <p className="font-medium">Recording via Video Conference</p>
              <p className="text-blue-600">Session recording will be handled automatically by the Daily.co video conference system when you join the meeting.</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant={isVideoEnabled ? "default" : "secondary"}
              onClick={toggleVideo}
              disabled={!streamActive}
            >
              {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </Button>
            
            <Button
              size="sm"
              variant={isAudioEnabled ? "default" : "secondary"}
              onClick={toggleAudio}
              disabled={!streamActive}
            >
              {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {!streamActive ? (
              <Button
                onClick={initializeStream}
                variant="default"
              >
                <Camera className="w-4 h-4 mr-2" />
                Start Preview
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    setStreamActive(false);
                  }
                }}
                variant="outline"
              >
                <VideoOff className="w-4 h-4 mr-2" />
                Stop Preview
              </Button>
            )}
          </div>
        </div>
          
        {/* Device Selection */}
        <div className="space-y-2 text-sm">
          <div>
            <label className="text-gray-600">Camera</label>
            <select
              value={selectedCamera}
              onChange={(e) => handleCameraChange(e.target.value)}
              className="w-full mt-1 p-1 border rounded"
            >
              {devices.filter(d => d.kind === 'videoinput').map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Camera'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-gray-600">Microphone</label>
            <select
              value={selectedMicrophone}
              onChange={(e) => handleMicrophoneChange(e.target.value)}
              className="w-full mt-1 p-1 border rounded"
            >
              {devices.filter(d => d.kind === 'audioinput').map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Microphone'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 