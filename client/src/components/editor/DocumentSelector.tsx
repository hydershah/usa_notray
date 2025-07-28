import React, { useMemo } from 'react';
import { Check, FileText, ChevronDown } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import type { SessionDocument, DocumentTag } from '@/types/editor';

interface DocumentSelectorProps {
  documents: SessionDocument[];
  currentDocument: SessionDocument | null;
  onDocumentChange: (document: SessionDocument) => void;
  tags: DocumentTag[];
  className?: string;
}

export const DocumentSelector: React.FC<DocumentSelectorProps> = ({
  documents,
  currentDocument,
  onDocumentChange,
  tags,
  className = ''
}) => {
  // Calculate tagging progress for each document
  const documentProgress = useMemo(() => {
    const progressMap: Record<string, { completed: number; total: number; percentage: number }> = {};
    
    documents.forEach(doc => {
      const docTags = tags.filter(tag => tag.documentId === doc.id);
      const completedTags = docTags.filter(tag => tag.isCompleted);
      const totalTags = docTags.length;
      const percentage = totalTags > 0 ? Math.round((completedTags.length / totalTags) * 100) : 0;
      
      progressMap[doc.id] = {
        completed: completedTags.length,
        total: totalTags,
        percentage
      };
    });
    
    return progressMap;
  }, [documents, tags]);

  const getProgressBadgeVariant = (percentage: number) => {
    if (percentage === 100) return 'default';
    if (percentage >= 50) return 'secondary';
    return 'outline';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage === 100) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-gray-500';
  };

  if (documents.length <= 1) {
    // Show single document info when only one document
    const doc = documents[0] || currentDocument;
    if (!doc) return null;
    
    const progress = documentProgress[doc.id] || { completed: 0, total: 0, percentage: 0 };
    
    return (
      <div className={cn("flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border", className)}>
        <FileText className="h-5 w-5 text-blue-600" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {doc.fileName}
          </p>
          <p className="text-xs text-gray-500">
            {progress.total > 0 ? `${progress.completed}/${progress.total} tags completed` : 'Ready for tagging'}
          </p>
        </div>
        {progress.total > 0 && (
          <Badge variant={getProgressBadgeVariant(progress.percentage)} className="text-xs">
            {progress.percentage}%
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-auto py-3 px-4"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {currentDocument ? currentDocument.fileName : 'Select Document'}
                </p>
                {currentDocument && (
                  <p className="text-xs text-gray-500">
                    {documentProgress[currentDocument.id]?.total > 0 
                      ? `${documentProgress[currentDocument.id].completed}/${documentProgress[currentDocument.id].total} tags completed`
                      : 'Ready for tagging'
                    }
                  </p>
                )}
              </div>
              {currentDocument && documentProgress[currentDocument.id]?.total > 0 && (
                <Badge 
                  variant={getProgressBadgeVariant(documentProgress[currentDocument.id].percentage)} 
                  className="text-xs flex-shrink-0"
                >
                  {documentProgress[currentDocument.id].percentage}%
                </Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-full min-w-[400px]" align="start">
          {documents.map((doc) => {
            const progress = documentProgress[doc.id] || { completed: 0, total: 0, percentage: 0 };
            const isSelected = currentDocument?.id === doc.id;
            
            return (
              <DropdownMenuItem
                key={doc.id}
                onSelect={() => onDocumentChange(doc)}
                className="flex items-center gap-3 py-3 px-4 cursor-pointer"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.fileName}
                      </p>
                      {isSelected && (
                        <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-gray-500">
                        {progress.total > 0 
                          ? `${progress.completed}/${progress.total} tags`
                          : 'No tags yet'
                        }
                      </p>
                      {progress.total > 0 && (
                        <>
                          <span className="text-xs text-gray-300">•</span>
                          <span className={cn("text-xs font-medium", getProgressColor(progress.percentage))}>
                            {progress.percentage}% complete
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {progress.total > 0 && (
                    <Badge 
                      variant={getProgressBadgeVariant(progress.percentage)} 
                      className="text-xs flex-shrink-0"
                    >
                      {progress.percentage}%
                    </Badge>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Overall progress summary */}
      {documents.length > 1 && (
        <div className="mt-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-800">
              Overall Progress
            </span>
            <span className="text-xs text-blue-600">
              {documents.filter(doc => documentProgress[doc.id]?.percentage === 100).length}/{documents.length} documents completed
            </span>
          </div>
          <div className="mt-1 w-full bg-blue-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(documents.filter(doc => documentProgress[doc.id]?.percentage === 100).length / documents.length) * 100}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}; 