import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  PlayCircle, 
  PauseCircle, 
  StopCircle,
  SkipForward,
  RotateCcw,
  Save,
  Download,
  Share,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Users,
  FileText,
  Eye,
  Upload
} from 'lucide-react';

interface LiveSigningControlsProps {
  sessionState: 'waiting' | 'active' | 'paused' | 'completing' | 'completed';
  canControlSession: boolean;
  missingRequiredTags: number;
  onStartSession: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onCompleteSession: () => void;
  onSaveProgress: () => void;
  onSyncAllUsers?: () => void;
  onEmergencyExit?: () => void;
}

export const LiveSigningControls: React.FC<LiveSigningControlsProps> = ({
  sessionState,
  canControlSession,
  missingRequiredTags,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onCompleteSession,
  onSaveProgress,
  onSyncAllUsers,
  onEmergencyExit
}) => {

  const getSessionControls = () => {
    if (!canControlSession) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <AlertTriangle className="h-4 w-4" />
          <span>Only the notary can control the session</span>
        </div>
      );
    }

    switch (sessionState) {
      case 'waiting':
        return (
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onStartSession} className="bg-green-600 hover:bg-green-700">
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Start Session
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Begin the live signing session
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );

      case 'active':
        return (
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onPauseSession} variant="outline">
                    <PauseCircle className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Temporarily pause the session
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onSaveProgress} variant="outline">
                    <Save className="h-4 w-4 mr-2" />
                    Save Progress
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Save current session progress
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={onCompleteSession}
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={missingRequiredTags > 0}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Session
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {missingRequiredTags > 0 
                    ? `Complete ${missingRequiredTags} required tags first`
                    : 'Finalize and complete the session'
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );

      case 'paused':
        return (
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onResumeSession} className="bg-blue-600 hover:bg-blue-700">
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Resume the paused session
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={onCompleteSession}
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={missingRequiredTags > 0}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Session
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {missingRequiredTags > 0 
                    ? `Complete ${missingRequiredTags} required tags first`
                    : 'Finalize and complete the session'
                  }
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );

      case 'completing':
        return (
          <div className="flex items-center gap-2 text-sm text-purple-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
            <span>Finalizing session...</span>
          </div>
        );

      case 'completed':
        return (
          <div className="flex items-center gap-2">
            <Badge className="bg-green-100 text-green-800 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Session Completed
            </Badge>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download Documents
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Download completed signed documents
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        );

      default:
        return null;
    }
  };

  const getAdditionalControls = () => {
    if (!canControlSession || sessionState === 'completed') {
      return null;
    }

    return (
      <div className="flex items-center gap-2">
        {/* Sync All Users */}
        {onSyncAllUsers && (sessionState === 'active' || sessionState === 'paused') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={onSyncAllUsers} variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-2" />
                  Sync All Users
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Bring all participants to your current view
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Emergency Exit */}
        {onEmergencyExit && (sessionState === 'active' || sessionState === 'paused') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={onEmergencyExit} variant="destructive" size="sm">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Emergency Exit
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Emergency session termination (saves current state)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      {/* Main Session Controls */}
      <div className="flex items-center gap-4">
        {getSessionControls()}
        
        {/* Session State Indicator */}
        {sessionState === 'waiting' && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Clock className="h-4 w-4" />
            <span>Waiting for participants to join</span>
          </div>
        )}
        
        {missingRequiredTags > 0 && sessionState === 'active' && (
          <Badge variant="destructive" className="text-xs">
            {missingRequiredTags} required tags remaining
          </Badge>
        )}
      </div>

      {/* Additional Controls */}
      {getAdditionalControls()}
    </div>
  );
}; 