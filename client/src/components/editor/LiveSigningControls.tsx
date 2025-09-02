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
          size="lg"
          variant="success"
          className="px-6 py-3 text-base font-semibold"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Play className="h-5 w-5 mr-2" />
          )}
          Start Session
        </Button>
      )}
      
      {sessionState === 'active' && (
        <>
          <Button 
            onClick={onPauseSession} 
            size="lg"
            variant="outline"
            className="px-5 py-3 text-base font-medium"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Pause className="h-5 w-5 mr-2" />
            )}
            Pause
          </Button>
          
          <Button 
            onClick={onCompleteSession} 
            size="lg"
            variant="default"
            className="px-5 py-3 text-base font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-5 w-5 mr-2" />
            )}
            Complete Session
          </Button>
        </>
      )}
      
      {sessionState === 'paused' && (
        <>
          <Button 
            onClick={onResumeSession} 
            size="lg"
            variant="default"
            className="px-5 py-3 text-base font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Play className="h-5 w-5 mr-2" />
            )}
            Resume
          </Button>
          
          <Button 
            onClick={onCompleteSession} 
            size="lg"
            variant="default"
            className="px-5 py-3 text-base font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-5 w-5 mr-2" />
            )}
            Complete Session
          </Button>
        </>
      )}
    </div>
  );
}; 