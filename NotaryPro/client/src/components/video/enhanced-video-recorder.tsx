import React, { useState, useRef, useEffect } from 'react';
import RecordRTC from 'recordrtc';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Video, Mic, MicOff, VideoOff, 
  Play, Square, Download, Upload,
  Settings, Camera, Monitor
} from 'lucide-react';

interface EnhancedVideoRecorderProps {
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
}: EnhancedVideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoStartInitiatedRef = useRef(false);

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

  // Auto-start recording when component mounts if enabled
  useEffect(() => {
    if (autoStart && !autoStartInitiatedRef.current && selectedCamera && selectedMicrophone) {
      autoStartInitiatedRef.current = true;
      // Small delay to ensure component is fully mounted
      setTimeout(() => {
        startRecording();
      }, 500);
    }
  }, [autoStart, selectedCamera, selectedMicrophone]);

  // Initialize stream
  const initializeStream = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: isVideoEnabled ? {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
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

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await initializeStream();
      
      const recorder = new RecordRTC(stream, {
        type: 'video',
        mimeType: 'video/webm',
        frameInterval: 90,
        videoBitsPerSecond: 128000,
        audioBitsPerSecond: 128000
      });

      recorder.startRecording();
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Generate recording ID
      const recordingId = `rec_${jobId}_${Date.now()}`;
      onRecordingStart?.(recordingId);
      
      toast({
        title: "Recording Started",
        description: "Session recording has begun",
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (!recorderRef.current) return;

    recorderRef.current.stopRecording(() => {
      const blob = recorderRef.current!.getBlob();
      setRecordingBlob(blob);
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      setIsRecording(false);

      // Upload recording
      uploadRecording(blob);
    });
  };

  // Upload recording to server
  const uploadRecording = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('recording', blob, `session_${jobId}_${Date.now()}.webm`);
    formData.append('duration', recordingTime.toString());

    try {
      const response = await fetch(`/api/jobs/${jobId}/recordings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        onRecordingComplete?.(result);
        
        toast({
          title: "Recording Saved",
          description: "Session recording has been uploaded successfully",
        });
      } else {
        throw new Error('Failed to upload recording');
      }
    } catch (error) {
      console.error('Failed to upload recording:', error);
      toast({
        title: "Upload Failed",
        description: "Failed to save recording. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Download recording locally
  const downloadRecording = () => {
    if (!recordingBlob) return;

    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notary_session_${jobId}_${new Date().toISOString()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
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

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Session Recording</CardTitle>
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
          
          {isRecording && (
            <div className="absolute top-2 left-2">
              <Badge variant="destructive" className="animate-pulse">
                <Square className="w-3 h-3 mr-1 fill-current" />
                REC {formatTime(recordingTime)}
              </Badge>
              </div>
          )}
          
          {!isVideoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <VideoOff className="w-16 h-16 text-gray-500" />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant={isVideoEnabled ? "default" : "secondary"}
              onClick={toggleVideo}
              disabled={!streamRef.current}
            >
              {isVideoEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </Button>
            
            <Button
              size="sm"
              variant={isAudioEnabled ? "default" : "secondary"}
              onClick={toggleAudio}
              disabled={!streamRef.current}
            >
              {isAudioEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                className="bg-red-600 hover:bg-red-700"
              >
                <Play className="w-4 h-4 mr-2" />
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={stopRecording}
                variant="secondary"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop Recording
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
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="w-full mt-1 p-1 border rounded"
                  disabled={isRecording}
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
              onChange={(e) => setSelectedMicrophone(e.target.value)}
              className="w-full mt-1 p-1 border rounded"
                  disabled={isRecording}
            >
              {devices.filter(d => d.kind === 'audioinput').map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || 'Microphone'}
                </option>
              ))}
                </select>
              </div>
            </div>

        {/* Download option */}
        {recordingBlob && !isRecording && (
          <Button
            onClick={downloadRecording}
            variant="outline"
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Recording
                    </Button>
        )}
      </CardContent>
    </Card>
  );
} 