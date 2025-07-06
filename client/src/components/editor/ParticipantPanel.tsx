import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  User, 
  Crown, 
  Shield, 
  Eye, 
  UserCheck, 
  Clock,
  CheckCircle,
  AlertCircle,
  Circle,
  Zap,
  Mic,
  MicOff,
  Video,
  VideoOff
} from 'lucide-react';
import type { SessionParticipant } from '@/types/editor';

interface LiveSessionState {
  state: 'waiting' | 'active' | 'paused' | 'completing' | 'completed';
  activeUserId?: number;
  participants: Array<{
    userId: number;
    isActive: boolean;
    joinedAt?: Date;
    canInteract: boolean;
  }>;
}

interface ParticipantPanelProps {
  participants: SessionParticipant[];
  liveSession: LiveSessionState;
  currentUserId: string;
  onSetActiveUser: (userId: number) => void;
  canControlSession: boolean;
}

export const ParticipantPanel: React.FC<ParticipantPanelProps> = ({
  participants,
  liveSession,
  currentUserId,
  onSetActiveUser,
  canControlSession
}) => {
  
  const getParticipantStatusIcon = (participant: SessionParticipant) => {
    const liveParticipant = liveSession.participants.find(
      p => p.userId === parseInt(participant.userId)
    );
    
    const isActive = liveSession.activeUserId === parseInt(participant.userId);
    const hasJoined = liveParticipant?.joinedAt;
    
    if (isActive) {
      return <Zap className="h-4 w-4 text-blue-600" />;
    } else if (hasJoined) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else {
      return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getParticipantStatusText = (participant: SessionParticipant) => {
    const liveParticipant = liveSession.participants.find(
      p => p.userId === parseInt(participant.userId)
    );
    
    const isActive = liveSession.activeUserId === parseInt(participant.userId);
    const hasJoined = liveParticipant?.joinedAt;
    
    if (isActive) {
      return "Active";
    } else if (hasJoined) {
      return "Joined";
    } else {
      return "Waiting";
    }
  };

  const getParticipantColor = (participant: SessionParticipant) => {
    return participant.colorCode || '#6B7280';
  };

  const getUserTypeIcon = (userType: string) => {
    switch (userType) {
      case 'notary':
        return <Crown className="h-4 w-4 text-yellow-600" />;
      case 'admin':
        return <Shield className="h-4 w-4 text-purple-600" />;
      case 'witness':
        return <Eye className="h-4 w-4 text-gray-600" />;
      default:
        return <User className="h-4 w-4 text-blue-600" />;
    }
  };

  const getUserTypeColor = (userType: string) => {
    switch (userType) {
      case 'notary':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'witness':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const formatUserType = (userType: string) => {
    return userType.charAt(0).toUpperCase() + userType.slice(1);
  };

  const getKeyboardShortcut = (participant: SessionParticipant, index: number) => {
    if (participant.userType === 'notary') {
      return '`';
    } else {
      return (index + 1).toString();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4" />
          Session Participants
          <Badge variant="secondary" className="ml-auto">
            {participants.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {participants.map((participant, index) => {
            const isCurrentUser = participant.userId === currentUserId;
            const isActiveUser = liveSession.activeUserId === parseInt(participant.userId);
            const canInteract = liveSession.participants.find(
              p => p.userId === parseInt(participant.userId)
            )?.canInteract;

            return (
              <div
                key={participant.id}
                className={`p-3 rounded-lg border transition-all duration-200 ${
                  isActiveUser 
                    ? 'bg-blue-50 border-blue-200 shadow-sm' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {/* Participant Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* Color indicator */}
                    <div 
                      className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: getParticipantColor(participant) }}
                    />
                    
                    {/* Status icon */}
                    {getParticipantStatusIcon(participant)}
                    
                    {/* User type icon */}
                    {getUserTypeIcon(participant.userType)}
                  </div>

                  {/* Keyboard shortcut */}
                  <div className="flex items-center gap-1">
                    <kbd className="bg-white px-1.5 py-0.5 rounded border text-xs font-mono">
                      {getKeyboardShortcut(participant, index)}
                    </kbd>
                  </div>
                </div>

                {/* Participant Info */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-800">
                      {participant.displayName}
                      {isCurrentUser && <span className="text-blue-600"> (You)</span>}
                    </span>
                    
                    <Badge className={`text-xs border ${getUserTypeColor(participant.userType)}`}>
                      {formatUserType(participant.userType)}
                    </Badge>
                  </div>
                  
                  <div className="text-xs text-gray-500 truncate">
                    {participant.email}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">
                      {getParticipantStatusText(participant)}
                    </span>
                    
                    {/* Audio/Video indicators (placeholder for future video integration) */}
                    <div className="flex items-center gap-1">
                      <Mic className="h-3 w-3 text-green-600" />
                      <Video className="h-3 w-3 text-green-600" />
                    </div>
                  </div>
                </div>

                {/* Control Button */}
                {canControlSession && liveSession.state === 'active' && !isActiveUser && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onSetActiveUser(parseInt(participant.userId))}
                            className="w-full text-xs h-7"
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Make Active
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Allow this user to interact with documents
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                {isActiveUser && liveSession.state === 'active' && (
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <div className="flex items-center justify-center gap-1 text-xs text-blue-600">
                      <Zap className="h-3 w-3" />
                      Can interact with documents
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Separator className="my-4" />

        {/* Session Instructions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Instructions</h4>
          
          <div className="space-y-2 text-xs text-gray-600">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></div>
              <span>Only the active user can interact with documents</span>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></div>
              <span>Notary controls user activation and session flow</span>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></div>
              <span>Use keyboard shortcuts to quickly change active user</span>
            </div>
            
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></div>
              <span>All actions are logged for compliance</span>
            </div>
          </div>
        </div>
      </CardContent>
    </div>
  );
}; 