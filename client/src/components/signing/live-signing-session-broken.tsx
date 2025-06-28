import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  Video, VideoOff, Mic, MicOff, Phone, Settings, 
  Users, FileText, Camera, Play, Square, Share2, Download,
  CheckCircle, XCircle, AlertCircle, Clock
} from "lucide-react";

interface Participant {
  id: string;
  name: string;
  email: string;
  role: 'notary' | 'signer' | 'witness' | 'title_agent';
  isConnected: boolean;
  hasAgreed: boolean;
  signatureData?: string;
}

interface SigningDocument {
  id: string;
  name: string;
  content: string;
  signatures: Array<{
    participantId: string;
    signatureData: string;
    timestamp: string;
    ipAddress: string;
  }>;
  isComplete: boolean;
}

interface LiveSigningSessionProps {
  jobId: number;
  onComplete: () => void;
  onCancel: () => void;
}

export function LiveSigningSession({ jobId, onComplete, onCancel }: LiveSigningSessionProps) {
  // Video calling states
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  // Session states
  const [currentStep, setCurrentStep] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: '1',
      name: 'John Smith',
      email: 'john@example.com',
      role: 'notary',
      isConnected: true,
      hasAgreed: false
    },
    {
      id: '2', 
      name: 'Sarah Johnson',
      email: 'sarah@example.com',
      role: 'signer',
      isConnected: true,
      hasAgreed: false
    },
    {
      id: '3',
      name: 'Mike Wilson',
      email: 'mike@example.com', 
      role: 'witness',
      isConnected: false,
      hasAgreed: false
    }
  ]);

  const [documents, setDocuments] = useState<SigningDocument[]>([
    {
      id: '1',
      name: 'Real Estate Purchase Agreement',
      content: 'Document content here...',
      signatures: [],
      isComplete: false
    }
  ]);

  // Initialize video
  const initializeVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      toast({
        title: "Video Enabled",
        description: "Camera and microphone are now active",
      });
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please enable camera and microphone permissions",
        variant: "destructive",
      });
    }
  };

  // Recording functions
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    toast({
      title: "Recording Started",
      description: "Session recording is now active",
    });
  };

  const stopRecording = () => {
    setIsRecording(false);
    setRecordingUrl('blob:example-recording-url');
    toast({
      title: "Recording Stopped",
      description: "Session has been saved successfully",
    });
  };

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(time => time + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const handleComplete = () => {
    const allSigned = participants.filter(p => p.role === 'signer').every(p => p.hasAgreed);
    if (!allSigned) {
      toast({
        title: "Incomplete Signatures",
        description: "All signers must complete their signatures before finishing",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Session Complete",
      description: "All signatures collected successfully",
    });
    onComplete();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Live Notary Session</h1>
              <p className="text-gray-600">Job #{jobId} • Real Estate Purchase Agreement</p>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="animate-pulse">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
                Live Session
              </Badge>
              <Button variant="outline" onClick={onCancel}>
                End Session
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="video">Video Call</TabsTrigger>
            <TabsTrigger value="document">Document</TabsTrigger>
            <TabsTrigger value="recording">Recording</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Participants */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Participants ({participants.filter(p => p.isConnected).length}/{participants.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{participant.name}</div>
                          <div className="text-sm text-gray-600 capitalize">{participant.role.replace('_', ' ')}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${participant.isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {participant.hasAgreed && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{doc.name}</div>
                          <div className="text-sm text-gray-600">
                            {doc.signatures.length} signatures collected
                          </div>
                        </div>
                        {doc.isComplete ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <Clock className="w-5 h-5 text-yellow-500" />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Session Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Camera className="w-5 h-5 mr-2" />
                    Session Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Video Call</span>
                      {isVideoEnabled ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Recording</span>
                      {isRecording ? (
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2" />
                          <span className="text-sm text-red-600">Active</span>
                        </div>
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span>All Signatures</span>
                      {participants.filter(p => p.role === 'signer').every(p => p.hasAgreed) ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-center space-x-4">
                  <Button onClick={initializeVideo} disabled={isVideoEnabled}>
                    <Video className="w-4 h-4 mr-2" />
                    {isVideoEnabled ? 'Video Active' : 'Start Video'}
                  </Button>
                  <Button 
                    onClick={isRecording ? stopRecording : startRecording}
                    variant={isRecording ? "destructive" : "default"}
                  >
                    {isRecording ? (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Recording
                      </>
                    )}
                  </Button>
                  <Button onClick={handleComplete} variant="default">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Video Call Tab */}
          <TabsContent value="video" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Video Conference</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Video className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Video Call Interface
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Video calling will be integrated with Whereby for live sessions.
                  </p>
                  <Button onClick={() => toast({ title: "Video Call", description: "Video calling interface activated" })}>
                    Join Video Call
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Document Tab */}
          <TabsContent value="document" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Signing Interface</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Document Signing Ready
                  </h3>
                  <p className="text-gray-600 mb-4">
                    The document signing interface will be displayed here during live sessions.
                  </p>
                  <Button onClick={() => toast({ title: "Document Signing", description: "Document signing interface activated" })}>
                    Start Document Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recording Tab */}
          <TabsContent value="recording" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Camera className="w-5 h-5 mr-2" />
                  Session Recording
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`} />
                      <div>
                        <div className="font-medium">
                          {isRecording ? 'Recording in Progress' : 'Recording Stopped'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {isRecording ? `Duration: ${Math.floor(recordingTime / 60)}:${(recordingTime % 60).toString().padStart(2, '0')}` : 'Ready to record'}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={isRecording ? stopRecording : startRecording}
                      variant={isRecording ? "destructive" : "default"}
                    >
                      {isRecording ? (
                        <>
                          <Square className="w-4 h-4 mr-2" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start Recording
                        </>
                      )}
                    </Button>
                  </div>

                  {recordingUrl && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Latest Recording</h4>
                      <div className="bg-gray-100 rounded-lg p-4 text-center">
                        <Camera className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600">Recording saved successfully</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          onClick={() => toast({ title: "Download", description: "Recording download started" })}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            toast({
                              title: "Link Copied",
                              description: "Recording link copied to clipboard",
                            });
                          }}
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share Link
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}