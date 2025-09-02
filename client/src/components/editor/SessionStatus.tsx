import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Users, 
  FileText,
  Target,
  TrendingUp
} from 'lucide-react';

interface SessionStatusProps {
  completedTags: number;
  totalTags: number;
  missingRequiredTags: number;
  sessionState: 'waiting' | 'active' | 'paused' | 'completing' | 'completed';
  sessionDuration: number;
  participantCount: number;
}

export const SessionStatus: React.FC<SessionStatusProps> = ({
  completedTags,
  totalTags,
  missingRequiredTags,
  sessionState,
  sessionDuration,
  participantCount
}) => {
  
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getCompletionPercentage = () => {
    if (totalTags === 0) return 0;
    return Math.round((completedTags / totalTags) * 100);
  };

  const getProgressColor = () => {
    const percentage = getCompletionPercentage();
    if (percentage >= 100) return 'bg-blue-600';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSessionStateDisplay = () => {
    switch (sessionState) {
      case 'waiting':
        return { text: 'Waiting to Start', color: 'bg-blue-100 text-blue-800', icon: <Clock className="h-3 w-3" /> };
      case 'active':
        return { text: 'Active', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle className="h-3 w-3" /> };
      case 'paused':
        return { text: 'Paused', color: 'bg-yellow-100 text-yellow-800', icon: <AlertTriangle className="h-3 w-3" /> };
      case 'completing':
        return { text: 'Completing', color: 'bg-blue-100 text-blue-800', icon: <TrendingUp className="h-3 w-3" /> };
      case 'completed':
        return { text: 'Completed', color: 'bg-gray-100 text-gray-800', icon: <CheckCircle className="h-3 w-3" /> };
      default:
        return { text: 'Unknown', color: 'bg-gray-100 text-gray-800', icon: <AlertTriangle className="h-3 w-3" /> };
    }
  };

  const sessionDisplay = getSessionStateDisplay();

  return (
    <div className="flex items-center justify-between text-sm">
      {/* Left side - Progress information */}
      <div className="flex items-center gap-6">
        {/* Document Progress */}
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gray-500" />
          <span className="text-gray-600">Progress:</span>
          <div className="flex items-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                style={{ width: `${getCompletionPercentage()}%` }}
              />
            </div>
            <span className="font-medium text-gray-800 min-w-[3rem]">
              {getCompletionPercentage()}%
            </span>
          </div>
        </div>

        {/* Tag Completion */}
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="text-gray-600">Tags:</span>
          <span className="font-medium text-gray-800">
            {completedTags}/{totalTags}
          </span>
          {missingRequiredTags > 0 && (
            <Badge variant="destructive" className="text-xs">
              {missingRequiredTags} required
            </Badge>
          )}
        </div>

        {/* Session Duration */}
        {sessionState === 'active' && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">Duration:</span>
            <span className="font-medium text-gray-800 font-mono">
              {formatDuration(sessionDuration)}
            </span>
          </div>
        )}
      </div>

      {/* Right side - Session information */}
      <div className="flex items-center gap-4">
        {/* Participant Count */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-gray-500" />
          <span className="text-gray-600">{participantCount} participant{participantCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Session State */}
        <Badge className={`border ${sessionDisplay.color} flex items-center gap-1`}>
          {sessionDisplay.icon}
          {sessionDisplay.text}
        </Badge>
      </div>
    </div>
  );
}; 