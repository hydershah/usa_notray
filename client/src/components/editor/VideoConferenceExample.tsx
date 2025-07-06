import React, { useState, useEffect } from 'react';
import { WebRTCVideoConference } from './WebRTCVideoConference';
import { VideoDebugInfo } from './VideoDebugInfo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Users, Video, VideoOff, Bug } from 'lucide-react';

interface VideoConferenceExampleProps {
  sessionId: string;
  jobId: number;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: 'notary' | 'signer' | 'witness';
  };
  participants: Array<{
    userId: string;
    displayName: string;
    email: string;
    userType: 'notary' | 'signer' | 'witness';
  }>;
}

export const VideoConferenceExample: React.FC<VideoConferenceExampleProps> = ({
  sessionId,
  jobId,
  currentUser,
  participants
}) => {
  const { toast } = useToast();
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [hasConnectionIssues, setHasConnectionIssues] = useState(false);

  const handleStartVideo = async () => {
    setIsLoading(true);
    try {
      // Create video session via API
      const response = await fetch(`/api/jobs/${jobId}/video-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          participants: participants.map(p => ({
            userId: p.userId,
            name: p.displayName,
            email: p.email,
            role: p.userType
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create video session');
      }

      const data = await response.json();
      console.log('Video session created:', data);

      setIsVideoEnabled(true);
      toast({
        title: "Video Conference Started",
        description: "WebRTC video conference is now active",
      });
    } catch (error) {
      console.error('Failed to start video:', error);
      setHasConnectionIssues(true);
      setShowDebug(true);
      toast({
        title: "Video Conference Failed",
        description: "Failed to start video conference. Check the diagnostics below for details.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopVideo = async () => {
    try {
      await fetch(`/api/jobs/${jobId}/video-session`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId
        })
      });

      setIsVideoEnabled(false);
      toast({
        title: "Video Conference Ended",
        description: "Video conference has been terminated",
      });
    } catch (error) {
      console.error('Failed to stop video:', error);
    }
  };

  const handleParticipantJoined = (participant: any) => {
    console.log('Participant joined:', participant);
    toast({
      title: "Participant Joined",
      description: `${participant.name} joined the video conference`,
    });
  };

  const handleParticipantLeft = (participantId: string) => {
    console.log('Participant left:', participantId);
    const participant = participants.find(p => p.userId === participantId);
    if (participant) {
      toast({
        title: "Participant Left",
        description: `${participant.displayName} left the video conference`,
      });
    }
  };

  return (
    <div className="space-y-4">
      {!isVideoEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video Conference
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Start a video conference for this signing session
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-500">
                    {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleStartVideo}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  <Video className="h-4 w-4" />
                  {isLoading ? 'Starting...' : 'Start Video'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDebug(!showDebug)}
                  className="flex items-center gap-2"
                >
                  <Bug className="h-4 w-4" />
                  Debug
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Participants:</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                  {currentUser.name} (You - {currentUser.role})
                </Badge>
                {participants.map(participant => (
                  <Badge 
                    key={participant.userId} 
                    variant="outline"
                    className={
                      participant.userType === 'notary' ? 'border-purple-300' :
                      participant.userType === 'signer' ? 'border-blue-300' :
                      'border-green-300'
                    }
                  >
                    {participant.displayName} ({participant.userType})
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute top-4 right-4 z-10">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStopVideo}
              className="flex items-center gap-2"
            >
              <VideoOff className="h-4 w-4" />
              End Video
            </Button>
          </div>
          
          <WebRTCVideoConference
            sessionId={sessionId}
            currentUser={currentUser}
            participants={participants}
            onParticipantJoined={handleParticipantJoined}
            onParticipantLeft={handleParticipantLeft}
            className="h-[600px] rounded-lg overflow-hidden"
          />
        </div>
      )}
      
      {/* Debug Information Panel */}
      {showDebug && (
        <VideoDebugInfo 
          sessionId={sessionId}
          className="mt-4"
        />
      )}
    </div>
  );
}; 