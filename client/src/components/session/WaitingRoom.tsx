import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Shield, 
  Crown,
  Eye,
  User,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  Play,
  UserCheck,
  Wifi,
  WifiOff
} from 'lucide-react';
import { AudioVideoTest } from '../video/AudioVideoTest';
import { useToast } from '@/hooks/use-toast';

interface WaitingRoomProps {
  sessionId: string;
  currentUser: {
    userId: string;
    displayName: string;
    userType: 'notary' | 'signer' | 'witness' | 'admin';
    email?: string;
    isVerified?: boolean;
  };
  participants: Array<{
    userId: string;
    displayName: string;
    userType: 'notary' | 'signer' | 'witness' | 'admin';
    email?: string;
    isVerified?: boolean;
    hasJoined?: boolean;
    joinedAt?: Date;
    connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  }>;
  jobData?: {
    title?: string;
    titleCompany?: string;
    documents?: Array<{ fileName: string }>;
  };
  onJoinSession: () => void;
  onTestAudioVideo?: () => void;
  onStartSession?: () => void; // For notaries
  canStart?: boolean;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  sessionId,
  currentUser,
  participants,
  jobData,
  onJoinSession,
  onTestAudioVideo,
  onStartSession,
  canStart = false
}) => {
  const [showAVTest, setShowAVTest] = useState(false);
  const [hasTestedAV, setHasTestedAV] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [sessionInfo, setSessionInfo] = useState({
    waitingCount: 0,
    verifiedCount: 0,
    totalExpected: participants.length
  });
  const { toast } = useToast();

  const isNotary = currentUser.userType === 'notary';
  const isAdmin = currentUser.userType === 'admin';
  const canControlSession = isNotary || isAdmin;

  // Update session info based on participants
  useEffect(() => {
    const waitingCount = participants.filter(p => !p.hasJoined).length;
    const verifiedCount = participants.filter(p => p.isVerified).length;
    
    setSessionInfo({
      waitingCount,
      verifiedCount,
      totalExpected: participants.length
    });
  }, [participants]);

  // Simulate connection status
  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus('connected');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Get user type icon
  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'notary':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-600" />;
      case 'witness':
        return <Eye className="h-4 w-4 text-gray-600" />;
      default:
        return <User className="h-4 w-4 text-blue-600" />;
    }
  };

  // Get connection status icon
  const getConnectionIcon = (status?: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-3 w-3 text-green-600" />;
      case 'connecting':
        return <Clock className="h-3 w-3 text-yellow-600 animate-pulse" />;
      default:
        return <WifiOff className="h-3 w-3 text-red-600" />;
    }
  };

  // Get verification status
  const getVerificationStatus = (participant: any) => {
    if (participant.isVerified) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    }
  };

  // Handle join session
  const handleJoinSession = () => {
    if (currentUser.isVerified) {
      onJoinSession();
      toast({
        title: "Joining Session",
        description: "You are now joining the live signing session.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Verification Required",
        description: "Please complete ID verification before joining the session.",
      });
    }
  };

  // Handle start session (notary only)
  const handleStartSession = () => {
    if (onStartSession) {
      onStartSession();
      toast({
        title: "Starting Session",
        description: "Live signing session is now beginning.",
      });
    }
  };

  // Calculate readiness
  const allVerified = participants.every(p => p.isVerified);
  const readyToStart = allVerified && participants.length > 0;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-800">Live Signing Session</h1>
        <p className="text-gray-600">
          {jobData?.title && (
            <>
              <span className="font-medium">{jobData.title}</span>
              {jobData.titleCompany && <span> • {jobData.titleCompany}</span>}
            </>
          )}
        </p>
        {jobData?.documents && (
          <p className="text-sm text-gray-500">
            {jobData.documents.length} document{jobData.documents.length !== 1 ? 's' : ''} to be signed
          </p>
        )}
      </div>

      {/* Connection Status */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getConnectionIcon(connectionStatus)}
              <div>
                <div className="font-medium text-blue-800">
                  {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
                </div>
                <div className="text-sm text-blue-600">
                  Session ID: {sessionId.slice(-8)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-blue-800">
                {sessionInfo.verifiedCount}/{sessionInfo.totalExpected} Verified
              </div>
              <div className="text-xs text-blue-600">
                {sessionInfo.waitingCount} waiting to join
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current User Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getUserTypeIcon(currentUser.userType)}
            Your Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {getUserTypeIcon(currentUser.userType)}
                <span className="font-medium">{currentUser.displayName}</span>
              </div>
              {getVerificationStatus(currentUser)}
            </div>
            <div className="text-sm text-gray-600">
              {currentUser.userType.charAt(0).toUpperCase() + currentUser.userType.slice(1)}
            </div>
          </div>

          {/* Audio/Video Testing */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Audio/Video Setup</h4>
              <Badge className={hasTestedAV ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                {hasTestedAV ? "Tested" : "Optional"}
              </Badge>
            </div>
            
            {!showAVTest ? (
              <Button
                onClick={() => setShowAVTest(true)}
                variant="outline"
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                Test Camera & Microphone
              </Button>
            ) : (
              <Card className="border-gray-200">
                <CardContent className="p-4">
                  <AudioVideoTest
                    onComplete={(settings) => {
                      setHasTestedAV(true);
                      setShowAVTest(false);
                      toast({
                        title: "Audio/Video Test Complete",
                        description: "Your devices are configured and ready.",
                      });
                    }}
                    onCancel={() => setShowAVTest(false)}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Participants List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Session Participants ({participants.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {participants.map((participant) => (
              <div key={participant.userId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getUserTypeIcon(participant.userType)}
                    <span className="font-medium">{participant.displayName}</span>
                    {participant.userId === currentUser.userId && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </div>
                  {getVerificationStatus(participant)}
                </div>
                
                <div className="flex items-center gap-2">
                  {getConnectionIcon(participant.connectionStatus)}
                  <Badge variant="outline" className="text-xs">
                    {participant.userType}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Session Readiness */}
      {canControlSession && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Shield className="h-5 w-5" />
              Session Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="text-sm text-blue-700">
                <strong>Session Readiness:</strong>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Participant Verification</span>
                  <div className="flex items-center gap-2">
                    {allVerified ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-yellow-600" />
                    )}
                    <span className="text-sm">
                      {sessionInfo.verifiedCount}/{sessionInfo.totalExpected}
                    </span>
                  </div>
                </div>
                
                <Progress 
                  value={(sessionInfo.verifiedCount / sessionInfo.totalExpected) * 100} 
                  className="h-2"
                />
              </div>
            </div>

            {/* Start Session Button */}
            <Button
              onClick={handleStartSession}
              disabled={!readyToStart || !canStart}
              className={`w-full ${readyToStart ? 'bg-green-600 hover:bg-green-700' : ''}`}
              size="lg"
            >
              <Play className="h-4 w-4 mr-2" />
              {readyToStart ? 'Start Live Signing Session' : 'Waiting for All Participants'}
            </Button>

            {!readyToStart && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  All participants must complete ID verification before the session can begin.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Join Session (for non-notaries) */}
      {!canControlSession && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-6 text-center space-y-4">
            <div>
              <h3 className="text-lg font-medium text-blue-800 mb-2">Ready to Join?</h3>
              <p className="text-sm text-blue-600">
                The notary will start the session when all participants are ready.
              </p>
            </div>
            
            <Button
              onClick={handleJoinSession}
              disabled={!currentUser.isVerified}
              className="bg-blue-600 hover:bg-blue-700"
              size="lg"
            >
              <UserCheck className="h-4 w-4 mr-2" />
              {currentUser.isVerified ? 'Join Session' : 'Complete Verification First'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 