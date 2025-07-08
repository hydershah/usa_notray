import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, CheckCircle, Loader2 } from 'lucide-react';

interface LiveSigningControlsProps {
  sessionState: string;
  canControlSession: boolean;
  onStartSession: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onCompleteSession: () => void;
  isLoading?: boolean;
}

export const LiveSigningControls: React.FC<LiveSigningControlsProps> = ({
  sessionState,
  canControlSession,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onCompleteSession,
  isLoading = false
}) => {
  if (!canControlSession) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {sessionState === 'waiting' && (
        <Button 
          onClick={onStartSession} 
          className="bg-green-600 hover:bg-green-700"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Start Session
        </Button>
      )}
      
      {sessionState === 'active' && (
        <>
          <Button 
            onClick={onPauseSession} 
            variant="outline"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Pause className="h-4 w-4 mr-2" />
            )}
            Pause
          </Button>
          
          <Button 
            onClick={onCompleteSession} 
            className="bg-purple-600 hover:bg-purple-700"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Complete Session
          </Button>
        </>
      )}
      
      {sessionState === 'paused' && (
        <>
          <Button 
            onClick={onResumeSession} 
            className="bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Resume
          </Button>
          
          <Button 
            onClick={onCompleteSession} 
            className="bg-purple-600 hover:bg-purple-700"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Complete Session
          </Button>
        </>
      )}
    </div>
  );
}; 