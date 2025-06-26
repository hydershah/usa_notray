import { useState, useRef, useEffect, useCallback } from 'react';
import RecordRTC from 'recordrtc';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { 
  Video, VideoOff, Mic, MicOff, Play, Square, StopCircle, 
  Upload, Download, Camera, Monitor, Settings, Shield,
  Clock, HardDrive, Cloud, AlertCircle, CheckCircle,
  Maximize, Minimize, Volume2, VolumeX
} from "lucide-react";

interface RecordingSession {
  id: string;
  sessionId: string;
  jobId: number;
  startTime: string;
  endTime?: string;
  duration: number;
  fileSize: number;
  quality: 'HD' | 'FHD' | '4K';
  participants: string[];
  cloudUrl?: string;
  localPath?: string;
  checksum: string;
}

interface VideoRecorderSettings {
  videoQuality: 'HD' | 'FHD' | '4K';
  audioQuality: 'standard' | 'high';
  recordScreen: boolean;
  recordCamera: boolean;
  storageLocation: 'local' | 'cloud' | 'both';
  autoUpload: boolean;
  backupRecording: boolean;
}

interface EnhancedVideoRecorderProps {
  sessionId: string;
  jobId: number;
  participants: string[];
  onRecordingStart?: (recordingId: string) => void;
  onRecordingStop?: (recording: RecordingSession) => void;
  onRecordingError?: (error: string) => void;
  autoStart?: boolean;
  legalCompliance?: boolean;
}

export function EnhancedVideoRecorder({
  sessionId,
  jobId,
  participants,
  onRecordingStart,
  onRecordingStop,
  onRecordingError,
  autoStart = false,
  legalCompliance = true
}: EnhancedVideoRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingSize, setRecordingSize] = useState(0);
  const [settings, setSettings] = useState<VideoRecorderSettings>({
    videoQuality: 'FHD',
    audioQuality: 'high',
    recordScreen: true,
    recordCamera: true,
    storageLocation: 'both',
    autoUpload: true,
    backupRecording: true
  });

  // Recording state
  const [currentRecording, setCurrentRecording] = useState<Partial<RecordingSession>>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [recordings, setRecordings] = useState<RecordingSession[]>([]);

  // Refs
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Media settings based on quality
  const getMediaConstraints = () => {
    const videoConstraints = {
      'HD': { width: 1280, height: 720, frameRate: 30 },
      'FHD': { width: 1920, height: 1080, frameRate: 30 },
      '4K': { width: 3840, height: 2160, frameRate: 30 }
    };

    return {
      video: settings.recordCamera ? videoConstraints[settings.videoQuality] : false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: settings.audioQuality === 'high' ? 48000 : 44100
      }
    };
  };

  useEffect(() => {
    if (autoStart && legalCompliance) {
      // Auto-start recording for legal compliance
      setTimeout(() => {
        startRecording();
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [autoStart, legalCompliance]);

  const initializeMediaStream = async () => {
    try {
      let stream: MediaStream;

      if (settings.recordScreen) {
        // Screen capture with system audio
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: 30,
            cursor: 'always'
          },
          audio: true
        });

        // If we also want camera, we need to combine streams
        if (settings.recordCamera) {
          const cameraStream = await navigator.mediaDevices.getUserMedia(getMediaConstraints());
          
          // Combine video tracks (this would need more sophisticated implementation)
          const combinedStream = new MediaStream([
            ...stream.getVideoTracks(),
            ...cameraStream.getVideoTracks(),
            ...stream.getAudioTracks()
          ]);
          
          streamRef.current = combinedStream;
        } else {
          streamRef.current = stream;
        }
      } else {
        // Camera only
        stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints());
        streamRef.current = stream;
      }

      // Set up preview
      if (videoPreviewRef.current && streamRef.current) {
        videoPreviewRef.current.srcObject = streamRef.current;
        videoPreviewRef.current.play();
      }

      return streamRef.current;
    } catch (error) {
      console.error('Failed to get media stream:', error);
      throw new Error(`Media access failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const startRecording = async () => {
    try {
      // Initialize media stream
      const stream = await initializeMediaStream();
      
      // Configure RecordRTC options
      const options = {
        type: 'video',
        mimeType: 'video/webm;codecs=vp9',
        video: {
          width: settings.videoQuality === '4K' ? 3840 : settings.videoQuality === 'FHD' ? 1920 : 1280,
          height: settings.videoQuality === '4K' ? 2160 : settings.videoQuality === 'FHD' ? 1080 : 720,
          frameRate: 30
        },
        audio: {
          sampleRate: settings.audioQuality === 'high' ? 48000 : 44100,
          channelCount: 2
        },
        // Legal compliance options
        timeSlice: 1000, // Save chunks every second for reliability
        ondataavailable: (blob: Blob) => {
          // Real-time backup if enabled
          if (settings.backupRecording) {
            // Could implement real-time cloud backup here
          }
        }
      };

      // Initialize recorder
      recorderRef.current = new RecordRTC(stream, options);
      
      // Start recording
      recorderRef.current.startRecording();
      
      // Initialize recording session
      const recordingSession: Partial<RecordingSession> = {
        id: `recording_${Date.now()}`,
        sessionId,
        jobId,
        startTime: new Date().toISOString(),
        duration: 0,
        fileSize: 0,
        quality: settings.videoQuality,
        participants: [...participants],
        checksum: ''
      };

      setCurrentRecording(recordingSession);
      setIsRecording(true);
      setRecordingTime(0);
      setRecordingSize(0);

      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
        
        // Estimate file size (approximate)
        const estimatedSize = (recordingTime + 1) * getBitRate() / 8;
        setRecordingSize(estimatedSize);
        
        // Update current recording
        setCurrentRecording(prev => ({
          ...prev,
          duration: recordingTime + 1,
          fileSize: estimatedSize
        }));
        
      }, 1000);

      // Notify parent component
      onRecordingStart?.(recordingSession.id!);
      
      toast({
        title: "Recording Started",
        description: `${settings.videoQuality} quality recording active for legal compliance`,
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      onRecordingError?.(errorMessage);
      toast({
        title: "Recording Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;

    try {
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Stop the recorder
      recorderRef.current.stopRecording(async () => {
        const blob = recorderRef.current!.getBlob();
        
        // Generate checksum for integrity
        const checksum = await generateChecksum(blob);
        
        // Complete recording session
        const completedRecording: RecordingSession = {
          ...currentRecording,
          id: currentRecording.id!,
          sessionId,
          jobId,
          endTime: new Date().toISOString(),
          duration: recordingTime,
          fileSize: blob.size,
          quality: settings.videoQuality,
          participants: [...participants],
          checksum,
          localPath: `recording_${currentRecording.id}.webm`
        } as RecordingSession;

        setCurrentRecording(completedRecording);
        
        // Save locally
        await saveRecordingLocally(blob, completedRecording.localPath!);
        
        // Upload to cloud if enabled
        if (settings.storageLocation === 'cloud' || settings.storageLocation === 'both') {
          await uploadRecordingToCloud(blob, completedRecording);
        }

        // Add to recordings list
        setRecordings(prev => [...prev, completedRecording]);
        
        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        // Notify parent component
        onRecordingStop?.(completedRecording);
        
        toast({
          title: "Recording Complete",
          description: `Recording saved successfully (${formatFileSize(blob.size)})`,
        });
      });

    } catch (error) {
      console.error('Failed to stop recording:', error);
      onRecordingError?.('Failed to stop recording');
    }
  };

  const pauseRecording = () => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.pauseRecording();
      setIsPaused(true);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (recorderRef.current && isPaused) {
      recorderRef.current.resumeRecording();
      setIsPaused(false);
      
      // Restart timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const getBitRate = () => {
    // Estimate bitrate based on quality settings (Mbps)
    const videoBitrates = {
      'HD': 5,    // 5 Mbps
      'FHD': 8,   // 8 Mbps  
      '4K': 25    // 25 Mbps
    };
    
    const audioBitrate = settings.audioQuality === 'high' ? 0.32 : 0.128; // Mbps
    return (videoBitrates[settings.videoQuality] + audioBitrate) * 1000000; // Convert to bps
  };

  const generateChecksum = async (blob: Blob): Promise<string> => {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const saveRecordingLocally = async (blob: Blob, filename: string) => {
    // In a real implementation, this would save to local storage or IndexedDB
    // For demo purposes, we'll create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const uploadRecordingToCloud = async (blob: Blob, recording: RecordingSession) => {
    if (!settings.autoUpload) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('recording', blob, `${recording.id}.webm`);
      formData.append('metadata', JSON.stringify(recording));
      formData.append('sessionId', sessionId);
      formData.append('jobId', jobId.toString());

      // Upload with progress tracking
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          
          // Update recording with cloud URL
          setCurrentRecording(prev => ({
            ...prev,
            cloudUrl: response.cloudUrl
          }));
          
          setIsUploading(false);
          setUploadProgress(100);
          
          toast({
            title: "Upload Complete",
            description: "Recording securely stored in cloud",
          });
        }
      });

      xhr.addEventListener('error', () => {
        setIsUploading(false);
        toast({
          title: "Upload Failed",
          description: "Failed to upload recording to cloud storage",
          variant: "destructive",
        });
      });

      // Send request to your cloud storage endpoint
      xhr.open('POST', '/api/recordings/upload');
      const token = localStorage.getItem('token');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);

    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
      toast({
        title: "Upload Error",
        description: "An error occurred during upload",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isRecording ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Video className={`w-5 h-5 ${isRecording ? 'text-red-600' : 'text-gray-600'}`} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Enhanced Video Recording
                {isRecording && (
                  <Badge className="bg-red-100 text-red-800 animate-pulse">
                    <div className="w-2 h-2 bg-red-500 rounded-full mr-2" />
                    LIVE
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-gray-600">
                Legal compliance recording for notary session
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isRecording && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(recordingTime)}
              </Badge>
            )}
            <Badge variant="secondary">
              {settings.videoQuality} Quality
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Legal Notice */}
        {legalCompliance && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Legal Notice:</strong> This session is being recorded for notarization purposes as required by law. 
              The recording will be securely stored and may be used as evidence in legal proceedings.
            </AlertDescription>
          </Alert>
        )}

        {/* Recording Controls */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {!isRecording ? (
              <Button onClick={startRecording} className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Start Recording
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button 
                  onClick={stopRecording} 
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </Button>
                
                {isPaused ? (
                  <Button onClick={resumeRecording} variant="outline">
                    <Play className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button onClick={pauseRecording} variant="outline">
                    <StopCircle className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Recording Stats */}
          {isRecording && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-gray-500" />
                <span>{formatTime(recordingTime)}</span>
              </div>
              <div className="flex items-center gap-1">
                <HardDrive className="w-4 h-4 text-gray-500" />
                <span>{formatFileSize(recordingSize)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Monitor className="w-4 h-4 text-gray-500" />
                <span>{settings.videoQuality}</span>
              </div>
            </div>
          )}
        </div>

        {/* Video Preview */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoPreviewRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {!streamRef.current && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm opacity-75">Video preview will appear here</p>
              </div>
            </div>
          )}
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                Uploading to secure cloud storage...
              </span>
              <span>{uploadProgress.toFixed(1)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Recording Settings */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="font-medium">Recording Settings</span>
            </div>
            <div className="transition group-open:rotate-180">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </summary>
          
          <div className="mt-4 space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Video Quality</label>
                <select
                  value={settings.videoQuality}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    videoQuality: e.target.value as 'HD' | 'FHD' | '4K' 
                  }))}
                  disabled={isRecording}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="HD">HD (720p)</option>
                  <option value="FHD">Full HD (1080p)</option>
                  <option value="4K">4K (2160p)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Storage Location</label>
                <select
                  value={settings.storageLocation}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    storageLocation: e.target.value as 'local' | 'cloud' | 'both' 
                  }))}
                  disabled={isRecording}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="local">Local Only</option>
                  <option value="cloud">Cloud Only</option>
                  <option value="both">Local + Cloud</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.recordScreen}
                  onChange={(e) => setSettings(prev => ({ ...prev, recordScreen: e.target.checked }))}
                  disabled={isRecording}
                />
                <span className="text-sm">Record Screen</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.recordCamera}
                  onChange={(e) => setSettings(prev => ({ ...prev, recordCamera: e.target.checked }))}
                  disabled={isRecording}
                />
                <span className="text-sm">Record Camera</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.autoUpload}
                  onChange={(e) => setSettings(prev => ({ ...prev, autoUpload: e.target.checked }))}
                  disabled={isRecording}
                />
                <span className="text-sm">Auto Upload</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.backupRecording}
                  onChange={(e) => setSettings(prev => ({ ...prev, backupRecording: e.target.checked }))}
                  disabled={isRecording}
                />
                <span className="text-sm">Backup Recording</span>
              </label>
            </div>
          </div>
        </details>

        {/* Recordings List */}
        {recordings.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              Recorded Sessions ({recordings.length})
            </h4>
            
            <div className="space-y-2">
              {recordings.map((recording) => (
                <div key={recording.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Session {recording.id.substring(10)}</div>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>{formatTime(recording.duration)}</span>
                      <span>{formatFileSize(recording.fileSize)}</span>
                      <span>{recording.quality}</span>
                      <span>{new Date(recording.startTime).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {recording.cloudUrl && (
                      <Badge className="bg-green-100 text-green-800">
                        <Cloud className="w-3 h-3 mr-1" />
                        Cloud
                      </Badge>
                    )}
                    {recording.localPath && (
                      <Badge variant="outline">
                        <HardDrive className="w-3 h-3 mr-1" />
                        Local
                      </Badge>
                    )}
                    <Button variant="outline" size="sm">
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 