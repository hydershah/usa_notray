import React from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface UnfilledTag {
  id: string;
  type: string;
  assignedUserId: string;
  assignedUserName: string;
  coordinates: {
    x: number;
    y: number;
    pageNumber: number;
  };
}

interface UnfilledTagsAlertProps {
  unfilledTags: UnfilledTag[];
  currentUserId: string;
  onTagClick?: (tagId: string) => void;
  onClose?: () => void;
}

const TAG_TYPE_LABELS = {
  'A': 'Name',
  'S': 'Signature', 
  'I': 'Initials',
  'N': 'Commission #',
  'X': 'Expiration',
  'O': 'Disclosure',
  'E': 'Seal',
  'D': 'Date',
  'T': 'Text',
  'W': 'Whiteout'
} as const;

export const UnfilledTagsAlert: React.FC<UnfilledTagsAlertProps> = ({
  unfilledTags,
  currentUserId,
  onTagClick,
  onClose
}) => {
  // Group tags by user
  const tagsByUser = unfilledTags.reduce((acc, tag) => {
    const userName = tag.assignedUserName;
    if (!acc[userName]) acc[userName] = [];
    acc[userName].push(tag);
    return acc;
  }, {} as Record<string, UnfilledTag[]>);

  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800">
        Session Cannot Be Completed - Tags Need Attention
      </AlertTitle>
      <AlertDescription className="text-orange-700 space-y-4">
        <p>
          Some tags haven't been filled yet. Each person must fill their assigned tags before the session can be completed.
        </p>
        
        {/* Show tags grouped by user */}
        <div className="space-y-3">
          {Object.entries(tagsByUser).map(([userName, userTags]) => (
            <div key={userName} className="bg-white rounded-lg p-3 border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">
                  {userName} ({userTags.length} unfilled tag{userTags.length !== 1 ? 's' : ''})
                </h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {userTags.map((tag) => (
                  <div 
                    key={tag.id}
                    className={`
                      flex items-center justify-between p-2 rounded border cursor-pointer transition-colors
                      ${tag.assignedUserId?.toString() === currentUserId 
                        ? 'bg-orange-100 border-orange-300 hover:bg-orange-200' 
                        : 'bg-gray-50 border-gray-200'
                      }
                    `}
                    onClick={() => onTagClick?.(tag.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {TAG_TYPE_LABELS[tag.type as keyof typeof TAG_TYPE_LABELS] || `${tag.type} Tag`}
                      </span>
                      <span className="text-xs text-gray-500">
                        #{tag.id}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      <span>Page {tag.coordinates.pageNumber}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="font-medium text-blue-900 mb-2">What to do:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Click each orange pulsing tag</strong> and enter the required information</li>
            <li>• <strong>Signatures and seals</strong> will open selection or configuration dialogs</li>
            <li>• <strong>Text tags</strong> require manual typing</li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2">
          {onClose && (
            <Button
              onClick={onClose}
              size="sm"
              variant="outline"
            >
              I'll Fill Them Manually
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}; 