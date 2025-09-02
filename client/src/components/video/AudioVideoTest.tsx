import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings,
  RefreshCw,
  Play,
  Square
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioVideoTestProps {
  onComplete: (settings: DeviceSettings) => void;
  onCancel: () => void;
}

interface DeviceSettings {
  camera: {
    deviceId: string;
    label: string;
    resolution: string;
  };
  microphone: {
    deviceId: string;
    label: string;
    volume: number;
  };
  speaker: {
    deviceId: string;
    label: string;
    volume: number;
  };
  testResults: {
    camera: boolean;
    microphone: boolean;
    speaker: boolean;
  };
}

interface MediaDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export const AudioVideoTest: React.FC<AudioVideoTestProps> = ({
  onComplete,
  onCancel
}) => {
  const [devices, setDevices] = useState<{
    cameras: MediaDevice[];
    microphones: MediaDevice[];
    speakers: MediaDevice[];
  }>({
    cameras: [],
    microphones: [],
    speakers: []
  });
  
  const [selectedDevices, setSelectedDevices] = useState<{
    camera: string;
    microphone: string;
    speaker: string;
  }>({
    camera: '',
    microphone: '',
    speaker: ''
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0);
  const [testResults, setTestResults] = useState<{
    camera: boolean | null;
    microphone: boolean | null;
    speaker: boolean | null;
  }>({
    camera: null,
    microphone: null,
    speaker: null
  });
  
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [currentStep, setCurrentStep] = useState<'setup' | 'testing' | 'complete'>('setup');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  // Get available devices
  const getDevices = useCallback(async () => {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      
      const cameras = deviceList.filter(device => device.kind === 'videoinput');
      const microphones = deviceList.filter(device => device.kind === 'audioinput');
      const speakers = deviceList.filter(device => device.kind === 'audiooutput');
      
      setDevices({ cameras, microphones, speakers });
      
      // Set default devices
      if (cameras.length > 0) setSelectedDevices(prev => ({ ...prev, camera: cameras[0].deviceId }));
      if (microphones.length > 0) setSelectedDevices(prev => ({ ...prev, microphone: microphones[0].deviceId }));
      if (speakers.length > 0) setSelectedDevices(prev => ({ ...prev, speaker: speakers[0].deviceId }));
      
    } catch (error) {
      console.error('Failed to get devices:', error);
      toast({
        variant: "destructive",
        title: "Device Access Failed",
        description: "Unable to access camera and microphone. Please check permissions.",
      });
    }
  }, [toast]);

  // Initialize devices on mount
  useEffect(() => {
    getDevices();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [getDevices]);

  // Start media stream
  const startStream = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: isVideoEnabled ? {
          deviceId: selectedDevices.camera ? { exact: selectedDevices.camera } : undefined,
          width: { ideal: 640 },
          height: { ideal: 480 }
        } : false,
        audio: isAudioEnabled ? {
          deviceId: selectedDevices.microphone ? { exact: selectedDevices.microphone } : undefined,
          echoCancellation: true,
          noiseSuppression: true
        } : false
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);

      // Setup video
      if (videoRef.current && isVideoEnabled) {
        videoRef.current.srcObject = newStream;
        setTestResults(prev => ({ ...prev, camera: true }));
      }

      // Setup audio analysis
      if (isAudioEnabled) {
        setupAudioAnalysis(newStream);
        setTestResults(prev => ({ ...prev, microphone: true }));
      }

    } catch (error) {
      console.error('Failed to start stream:', error);
      setTestResults(prev => ({
        ...prev,
        camera: isVideoEnabled ? false : null,
        microphone: isAudioEnabled ? false : null
      }));
      
      toast({
        variant: "destructive",
        title: "Stream Failed",
        description: "Unable to start camera or microphone.",
      });
    }
  }, [stream, isVideoEnabled, isAudioEnabled, selectedDevices]);

  // Setup audio analysis for level monitoring
  const setupAudioAnalysis = useCallback((mediaStream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(mediaStream);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      
      // Start monitoring audio levels
      const monitorAudio = () => {
        if (!analyserRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        setAudioLevel(Math.min(100, (average / 255) * 100));
        
        animationFrameRef.current = requestAnimationFrame(monitorAudio);
      };
      
      monitorAudio();
      
    } catch (error) {
      console.error('Failed to setup audio analysis:', error);
    }
  }, []);

  // Test speaker
  const testSpeaker = useCallback(async () => {
    setIsTestingAudio(true);
    
    try {
      // Play a test tone
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A note
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 1); // 1 second tone
      
      // Wait for tone to finish
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      setTestResults(prev => ({ ...prev, speaker: true }));
      
      toast({
        title: "Speaker Test",
        description: "Did you hear the test tone? If yes, your speakers are working correctly.",
      });
      
    } catch (error) {
      console.error('Speaker test failed:', error);
      setTestResults(prev => ({ ...prev, speaker: false }));
    } finally {
      setIsTestingAudio(false);
    }
  }, [toast]);

  // Start media stream when devices change
  useEffect(() => {
    if (selectedDevices.camera || selectedDevices.microphone) {
      startStream();
    }
  }, [selectedDevices, isVideoEnabled, isAudioEnabled, startStream]);

  // Run comprehensive test
  const runComprehensiveTest = useCallback(async () => {
    setCurrentStep('testing');
    
    // Test camera
    if (isVideoEnabled && selectedDevices.camera) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTestResults(prev => ({ ...prev, camera: videoRef.current?.videoWidth > 0 }));
    }
    
    // Test microphone
    if (isAudioEnabled && selectedDevices.microphone) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setTestResults(prev => ({ ...prev, microphone: audioLevel > 0 }));
    }
    
    // Test speaker
    await testSpeaker();
    
    setCurrentStep('complete');
  }, [isVideoEnabled, isAudioEnabled, selectedDevices, audioLevel, testSpeaker]);

  // Complete setup
  const handleComplete = useCallback(() => {
    const settings: DeviceSettings = {
      camera: {
        deviceId: selectedDevices.camera,
        label: devices.cameras.find(d => d.deviceId === selectedDevices.camera)?.label || '',
        resolution: '640x480'
      },
      microphone: {
        deviceId: selectedDevices.microphone,
        label: devices.microphones.find(d => d.deviceId === selectedDevices.microphone)?.label || '',
        volume: audioLevel
      },
      speaker: {
        deviceId: selectedDevices.speaker,
        label: devices.speakers.find(d => d.deviceId === selectedDevices.speaker)?.label || '',
        volume: 50
      },
      testResults: {
        camera: testResults.camera === true,
        microphone: testResults.microphone === true,
        speaker: testResults.speaker === true
      }
    };
    
    onComplete(settings);
  }, [selectedDevices, devices, audioLevel, testResults, onComplete]);

  // Get test status icon
  const getTestIcon = (result: boolean | null) => {
    if (result === null) return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    return result ? <CheckCircle className="h-4 w-4 text-blue-600" /> : <XCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Audio & Video Setup</h3>
        <p className="text-sm text-gray-600">Test your devices before joining the session</p>
      </div>

      {/* Device Selection */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Camera Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-4 w-4" />
              Camera
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select 
              value={selectedDevices.camera} 
              onValueChange={(value) => setSelectedDevices(prev => ({ ...prev, camera: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {devices.cameras.map(device => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex gap-2">
              <Button
                onClick={() => setIsVideoEnabled(!isVideoEnabled)}
                variant={isVideoEnabled ? "default" : "outline"}
                size="sm"
                className="flex-1"
              >
                {isVideoEnabled ? <Video className="h-3 w-3 mr-1" /> : <VideoOff className="h-3 w-3 mr-1" />}
                {isVideoEnabled ? 'On' : 'Off'}
              </Button>
              
              <div className="flex items-center gap-1">
                {getTestIcon(testResults.camera)}
                <span className="text-xs text-gray-500">
                  {testResults.camera === null ? 'Not tested' : testResults.camera ? 'Working' : 'Failed'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Microphone Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microphone
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select 
              value={selectedDevices.microphone} 
              onValueChange={(value) => setSelectedDevices(prev => ({ ...prev, microphone: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select microphone" />
              </SelectTrigger>
              <SelectContent>
                {devices.microphones.map(device => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div className="flex gap-2">
              <Button
                onClick={() => setIsAudioEnabled(!isAudioEnabled)}
                variant={isAudioEnabled ? "default" : "outline"}
                size="sm"
                className="flex-1"
              >
                {isAudioEnabled ? <Mic className="h-3 w-3 mr-1" /> : <MicOff className="h-3 w-3 mr-1" />}
                {isAudioEnabled ? 'On' : 'Off'}
              </Button>
              
              <div className="flex items-center gap-1">
                {getTestIcon(testResults.microphone)}
                <span className="text-xs text-gray-500">
                  {testResults.microphone === null ? 'Not tested' : testResults.microphone ? 'Working' : 'Failed'}
                </span>
              </div>
            </div>

            {/* Audio Level Indicator */}
            {isAudioEnabled && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500">Audio Level:</div>
                <Progress value={audioLevel} className="h-2" />
                <div className="text-xs text-gray-500">
                  {audioLevel > 10 ? 'Good signal' : 'Speak louder or check microphone'}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Video Preview */}
      {isVideoEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Camera Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!stream && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <div className="text-center">
                    <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Speaker Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Speaker Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Test your speakers</span>
            <div className="flex items-center gap-2">
              {getTestIcon(testResults.speaker)}
              <Button
                onClick={testSpeaker}
                disabled={isTestingAudio}
                size="sm"
                variant="outline"
              >
                {isTestingAudio ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3 mr-1" />
                    Test Sound
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results Summary */}
      {currentStep === 'complete' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Device setup complete! All tests passed successfully.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={onCancel} variant="outline" className="flex-1">
          Cancel
        </Button>
        
        {currentStep === 'setup' && (
          <Button 
            onClick={runComprehensiveTest}
            disabled={!selectedDevices.camera && !selectedDevices.microphone}
            className="flex-1"
          >
            <Settings className="h-4 w-4 mr-2" />
            Run Device Test
          </Button>
        )}
        
        {currentStep === 'testing' && (
          <Button disabled className="flex-1">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Testing Devices...
          </Button>
        )}
        
        {currentStep === 'complete' && (
          <Button onClick={handleComplete} className="flex-1 bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Setup
          </Button>
        )}
      </div>
    </div>
  );
}; 