import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Zap, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  User,
  Signature,
  FileText,
  CalendarIcon,
  RefreshCw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import type { DocumentTag } from '@/types/editor';

interface ReplaceAllButtonProps {
  sessionId: string;
  tags: DocumentTag[];
  participants: any[];
  currentUserId: string;
  isNotary: boolean;
  onTagsUpdated: (updatedTags: DocumentTag[]) => void;
  disabled?: boolean;
}

interface ReplacementPreview {
  tagId: string;
  tagType: string;
  assignedUser: string;
  currentContent?: string;
  newContent: string;
  contentType: 'signature' | 'text' | 'date' | 'auto';
  success?: boolean;
  error?: string;
}

const TAG_ICONS = {
  'A': <User className="h-3 w-3" />,
  'S': <Signature className="h-3 w-3" />,
  'I': <FileText className="h-3 w-3" />,
  'T': <FileText className="h-3 w-3" />,
  'D': <CalendarIcon className="h-3 w-3" />,
  'N': <FileText className="h-3 w-3" />,
  'X': <CalendarIcon className="h-3 w-3" />,
  'O': <FileText className="h-3 w-3" />,
  'E': <Signature className="h-3 w-3" />,
  'W': <FileText className="h-3 w-3" />
} as const;

const TAG_LABELS = {
  'A': 'Name',
  'S': 'Signature',
  'I': 'Initials',
  'T': 'Text',
  'D': 'Date',
  'N': 'Commission #',
  'X': 'Expiration',
  'O': 'Disclosure',
  'E': 'Seal',
  'W': 'Whiteout'
} as const;

export const ReplaceAllButton: React.FC<ReplaceAllButtonProps> = ({
  sessionId,
  tags,
  participants,
  currentUserId,
  isNotary,
  onTagsUpdated,
  disabled = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [replacementPreview, setReplacementPreview] = useState<ReplacementPreview[]>([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number; total: number } | null>(null);
  const { toast } = useToast();

  // Get incomplete tags that can be auto-filled
  const incompleteTags = tags.filter(tag => !tag.isCompleted);
  const canReplace = incompleteTags.length > 0 && (isNotary || !disabled);

  // Generate preview of what will be replaced
  const generatePreview = useCallback(async () => {
    if (!canReplace) return;

    setShowPreview(true);
    const preview: ReplacementPreview[] = [];

    for (const tag of incompleteTags) {
      const assignedUser = participants.find(p => p.userId === tag.assignedUserId);
      let newContent = '';
      let contentType: 'signature' | 'text' | 'date' | 'auto' = 'text';

      // Generate content based on tag type and user profile
      switch (tag.tagType) {
        case 'A': // Name
          newContent = assignedUser?.fullName || assignedUser?.firstName || 'Name Required';
          contentType = 'text';
          break;
        case 'S': // Signature
          newContent = assignedUser?.signatureImage || 'Signature Required';
          contentType = 'signature';
          break;
        case 'I': // Initials
          newContent = assignedUser?.initialsImage || assignedUser?.initials || 'Initials Required';
          contentType = 'signature';
          break;
        case 'T': // Text
          newContent = ''; // Text tags remain empty
          contentType = 'text';
          break;
        case 'D': // Date
          newContent = new Date().toLocaleDateString();
          contentType = 'date';
          break;
        case 'N': // Commission Number
          newContent = assignedUser?.commissionNumber || 'Commission # Required';
          contentType = 'text';
          break;
        case 'X': // Commission Expiration
          newContent = assignedUser?.commissionExpiration ? formatDate(assignedUser.commissionExpiration) : 'Expiration Required';
          contentType = 'date';
          break;
        case 'O': // Disclosure
          newContent = assignedUser?.disclosure || '';
          contentType = 'text';
          break;
        default:
          newContent = 'Content Available';
          contentType = 'auto';
      }

      preview.push({
        tagId: tag.id,
        tagType: tag.tagType,
        assignedUser: assignedUser?.displayName || 'Unknown User',
        currentContent: tag.contentData?.value || undefined,
        newContent,
        contentType
      });
    }

    setReplacementPreview(preview);
  }, [incompleteTags, participants, canReplace]);

  // Execute the replacement
  const executeReplacement = useCallback(async () => {
    if (!canReplace) return;

    setIsProcessing(true);
    setProgress(0);
    setResults(null);

    try {
      console.log('🔄 Starting replace all operation...');
      
      const response = await authenticatedFetch(`/api/editor/session/${sessionId}/replace-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to replace tags');
      }

      const result = await response.json();
      console.log('✅ Replace all completed:', result);

      // Simulate progress for user feedback
      const totalTags = incompleteTags.length;
      for (let i = 0; i <= totalTags; i++) {
        setProgress((i / totalTags) * 100);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setResults({
        success: result.updatedCount || totalTags,
        failed: Math.max(0, totalTags - (result.updatedCount || 0)),
        total: totalTags
      });

      // Update local tags state
      const updatedTags = tags.map(tag => {
        if (incompleteTags.find(it => it.id === tag.id)) {
          return {
            ...tag,
            isCompleted: true,
            contentData: {
              type: 'auto',
              value: 'Auto-filled content',
              timestamp: new Date()
            }
          };
        }
        return tag;
      });

      onTagsUpdated(updatedTags);

      toast({
        title: "Tags Replaced Successfully",
        description: `${result.updatedCount || totalTags} tags were automatically filled with content.`,
      });

    } catch (error) {
      console.error('❌ Replace all failed:', error);
      
      setResults({
        success: 0,
        failed: incompleteTags.length,
        total: incompleteTags.length
      });

      toast({
        variant: "destructive",
        title: "Replace All Failed",
        description: error instanceof Error ? error.message : "Failed to replace tags automatically.",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setShowPreview(false);
        setProgress(0);
        setResults(null);
      }, 3000);
    }
  }, [sessionId, canReplace, incompleteTags, tags, onTagsUpdated, toast]);

  // Reset preview
  const handleClosePreview = () => {
    setShowPreview(false);
    setReplacementPreview([]);
    setResults(null);
    setProgress(0);
  };

  if (!canReplace) {
    return (
      <Alert className="border-gray-200">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {incompleteTags.length === 0 
            ? "All tags are already completed" 
            : "Only notaries can use Replace All functionality"
          }
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={generatePreview}
          disabled={disabled || isProcessing}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          <Zap className="h-4 w-4 mr-2" />
          Replace All Tags ({incompleteTags.length})
        </Button>
        
        <div className="text-sm text-gray-600">
          Automatically fill all tags with user profile data
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Replace All Preview
              {results && (
                <Badge variant={results.failed > 0 ? "destructive" : "default"} className="ml-auto">
                  {results.success}/{results.total} completed
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing tags...</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Results Summary */}
            {results && (
              <Alert className={results.failed > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                <div className="flex items-center gap-2">
                  {results.failed > 0 ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  )}
                  <AlertDescription>
                    {results.failed > 0 
                      ? `${results.success} tags completed, ${results.failed} failed`
                      : `All ${results.success} tags completed successfully!`
                    }
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {/* Preview List */}
            {!results && replacementPreview.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <h4 className="text-sm font-medium text-gray-700">Preview Changes:</h4>
                {replacementPreview.map((item, index) => (
                  <div key={item.tagId} className="flex items-center gap-3 p-2 bg-white rounded border text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {TAG_ICONS[item.tagType as keyof typeof TAG_ICONS]}
                      <span className="font-medium">{TAG_LABELS[item.tagType as keyof typeof TAG_LABELS]}</span>
                      <span className="text-gray-500">→</span>
                      <span className="text-gray-600 truncate">
                        {item.contentType === 'signature' ? 'Signature' : item.newContent || 'Empty'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                      {item.assignedUser}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {!isProcessing && !results && (
                <>
                  <Button
                    onClick={executeReplacement}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm Replace All
                  </Button>
                  <Button
                    onClick={handleClosePreview}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              )}
              
              {(results || isProcessing) && (
                <Button
                  onClick={handleClosePreview}
                  variant="outline"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Close'
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 