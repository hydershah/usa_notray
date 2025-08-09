/**
 * Notary Video Session Component
 * Handles API integration and provides video session management
 * This is the main component that replaces DailyVideoConference.tsx
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { NotaryVideoProvider } from './NotaryVideoProvider';
import { NotaryVideoConference } from './NotaryVideoConference';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Users, Video, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  role: 'notary' | 'signer' | 'witness' | 'client';
  email?: string;
}

interface Participant {
  id: string;
  name: string;
  role: 'notary' | 'signer' | 'witness' | 'client';
  email?: string;
}

interface VideoSessionData {
  sessionId: string;
  roomUrl: string;
  roomName: string;
  userToken: string;
  userRole: string;
  participantCount: number;
  maxParticipants: number;
  status: 'active' | 'recording' | 'completed';
  createdAt: string;
}

interface NotaryVideoSessionProps {
  jobId: string;
  currentUser: User;
  participants?: Participant[];
  autoJoin?: boolean;
  onSessionComplete?: (sessionData: any) => void;
  onSessionError?: (error: any) => void;
  className?: string;
  sessionData: VideoSessionData | null;
  isLoading: boolean;
  error: string | null;
  signingSessionState?: 'waiting' | 'active' | 'paused' | 'completing' | 'completed';
}

export const NotaryVideoSession: React.FC<NotaryVideoSessionProps> = ({
  jobId,
  currentUser,
  participants = [],
  autoJoin = true,
  onSessionComplete,
  onSessionError,
  className,
  sessionData,
  isLoading,
  error,
  signingSessionState = 'waiting'
}) => {

  // Memoize video session props to prevent Daily provider recreation
  const memoizedToken = useMemo(() => sessionData?.userToken, [sessionData?.userToken]);
  const memoizedRoomUrl = useMemo(() => sessionData?.roomUrl, [sessionData?.roomUrl]);

  // Event handlers
  const handleSessionJoined = useCallback((event: any) => {
    console.log('📱 Session joined event:', event);
    toast({
      title: "Video Session Active",
      description: "Successfully connected to the notary session",
    });
  }, []);

  const handleSessionLeft = useCallback((event: any) => {
    console.log('👋 Session left event:', event);
    // Only call onSessionComplete if this was intentional (not a reconnect)
    if (event.action === 'left-meeting' && !event.errorMsg) {
      onSessionComplete?.(sessionData);
    }
  }, [onSessionComplete, sessionData]);

  const handleRecordingStarted = useCallback((event: any) => {
    console.log('🎬 Recording started event:', event);
    // State is now managed in parent component
  }, []);

  const handleParticipantJoined = useCallback((event: any) => {
    console.log('👤 Participant joined event:', event);
    // State is now managed in parent component
  }, []);

  const handleError = useCallback((error: any) => {
    console.error('❌ Video session error:', error);
    onSessionError?.(error);
  }, [onSessionError]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("h-full flex items-center justify-center bg-gray-50", className)}>
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-semibold mb-2">
                Loading Video Session
              </h3>
              <p className="text-gray-600 mb-4">
                Checking for existing session...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("h-full flex items-center justify-center bg-gray-50", className)}>
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-red-700">
                Video Session Error
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="space-y-2">
                <Button 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Session not ready
  if (!sessionData) {
    return (
      <div className={cn("h-full flex items-center justify-center bg-gray-50", className)}>
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Ready to Start</h3>
              <p className="text-gray-600 mb-4">
                Click below to create a video session for this notary job.
              </p>
              <Button 
                onClick={() => window.location.reload()}
                className="w-full"
                size="lg"
              >
                <Video className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if we're in demo mode
  const isDemoMode = sessionData.userToken === 'demo-token';

  if (isDemoMode) {
    // Demo mode - show setup instructions instead of actual video
    return (
      <div className={cn("h-full flex items-center justify-center bg-gray-50", className)}>
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Video className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Demo Mode Active</h3>
              <p className="text-gray-600 mb-4">
                The video system is running in demo mode because the backend API is not fully configured.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-blue-800 mb-2">To enable full video features:</h4>
                <ol className="text-blue-700 text-sm space-y-1 list-decimal list-inside">
                  <li>Set <code className="bg-blue-100 px-1 rounded">DAILY_API_KEY</code> environment variable</li>
                  <li>Run database migration: <code className="bg-blue-100 px-1 rounded">npm run db:migrate</code></li>
                  <li>Restart the server</li>
                </ol>
              </div>
              <div className="text-xs text-gray-500">
                Job ID: {jobId} • Participants: {participants.length} • Role: {currentUser.role}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main video session
  return (
    <div className={cn("h-full", className)}>
      {(memoizedToken || memoizedRoomUrl) ? (
        <NotaryVideoProvider 
          token={memoizedToken}
          roomUrl={memoizedRoomUrl}
        >
          <NotaryVideoConference
            currentUser={currentUser}
            onSessionJoined={handleSessionJoined}
            onSessionLeft={handleSessionLeft}
            onRecordingStarted={handleRecordingStarted}
            onParticipantJoined={handleParticipantJoined}
            onError={handleError}
            signingSessionState={signingSessionState}
            autoJoin={autoJoin}
            jobId={jobId}
          />
        </NotaryVideoProvider>
      ) : (
        <div className="flex items-center justify-center h-full bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Loading video session...</p>
          </div>
        </div>
      )}
    </div>
  );
};