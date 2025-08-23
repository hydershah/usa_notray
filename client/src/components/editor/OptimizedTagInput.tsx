import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Check, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSignaturePerformanceTracking } from './SignaturePerformanceMonitor';

interface OptimizedTagInputProps {
  tag: {
    id: string;
    tagType: string;
    assignedUserId?: number;
    content?: any;
  };
  isActive: boolean;
  canEdit: boolean;
  onComplete: (content: any) => void;
  onCancel: () => void;
  currentUserId: number;
  sessionId: string;
}

interface TagInputConfig {
  type: 'text' | 'date' | 'number' | 'select' | 'textarea';
  placeholder: string;
  validation?: (value: any) => string | null;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  required?: boolean;
}

/**
 * Optimized tag input component for all tag types
 * Handles initials, date, commission, expiration, disclosure, seal, and whiteout tags
 */
export const OptimizedTagInput: React.FC<OptimizedTagInputProps> = ({
  tag,
  isActive,
  canEdit,
  onComplete,
  onCancel,
  currentUserId,
  sessionId
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState<any>(tag.content || '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const { trackOperation } = useSignaturePerformanceTracking();

  // Tag type configurations
  const getTagConfig = useCallback((tagType: string): TagInputConfig => {
    const configs: Record<string, TagInputConfig> = {
      'I': { // Initials
        type: 'text',
        placeholder: 'Enter initials',
        maxLength: 3,
        validation: (value) => {
          if (!value || value.trim().length === 0) return 'Initials are required';
          if (value.length > 3) return 'Initials cannot exceed 3 characters';
          if (!/^[A-Za-z]+$/.test(value)) return 'Initials must contain only letters';
          return null;
        },
        required: true
      },
      'D': { // Date
        type: 'date',
        placeholder: 'Select date',
        validation: (value) => {
          if (!value) return 'Date is required';
          if (value > new Date()) return 'Date cannot be in the future';
          return null;
        },
        required: true
      },
      'N': { // Commission Number
        type: 'text',
        placeholder: 'Enter commission number',
        maxLength: 20,
        validation: (value) => {
          if (!value || value.trim().length === 0) return 'Commission number is required';
          if (value.length > 20) return 'Commission number too long';
          return null;
        },
        required: true
      },
      'X': { // Commission Expiration
        type: 'date',
        placeholder: 'Select expiration date',
        validation: (value) => {
          if (!value) return 'Expiration date is required';
          if (value <= new Date()) return 'Expiration date must be in the future';
          return null;
        },
        required: true
      },
      'O': { // Disclosure
        type: 'textarea',
        placeholder: 'Enter disclosure text',
        maxLength: 500,
        validation: (value) => {
          if (!value || value.trim().length === 0) return 'Disclosure text is required';
          if (value.length > 500) return 'Disclosure text too long';
          return null;
        },
        required: true
      },
      'E': { // Seal
        type: 'select',
        placeholder: 'Select seal type',
        options: [
          { value: 'official', label: 'Official Notary Seal' },
          { value: 'stamp', label: 'Notary Stamp' },
          { value: 'embossed', label: 'Embossed Seal' }
        ],
        validation: (value) => {
          if (!value) return 'Seal type is required';
          return null;
        },
        required: true
      },
      'W': { // Whiteout
        type: 'select',
        placeholder: 'Select whiteout type',
        options: [
          { value: 'full', label: 'Full Coverage' },
          { value: 'partial', label: 'Partial Coverage' },
          { value: 'line', label: 'Line Coverage' }
        ],
        validation: (value) => {
          if (!value) return 'Whiteout type is required';
          return null;
        },
        required: true
      }
    };

    return configs[tagType] || {
      type: 'text',
      placeholder: 'Enter content',
      required: false
    };
  }, []);

  const config = getTagConfig(tag.tagType);

  // Performance tracking
  const trackTagOperation = useCallback(async (operation: string, fn: () => Promise<any>) => {
    const startTime = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - startTime;
      
      trackOperation(operation, duration, true);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      trackOperation(operation, duration, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }, [trackOperation]);

  // Validate content
  const validateContent = useCallback((value: any): string | null => {
    if (config.validation) {
      return config.validation(value);
    }
    return null;
  }, [config]);

  // Handle content change
  const handleContentChange = useCallback((value: any) => {
    setContent(value);
    const error = validateContent(value);
    setValidationError(error);
  }, [validateContent]);

  // Handle completion
  const handleComplete = useCallback(async () => {
    if (isProcessing) return;
    
    const error = validateContent(content);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsProcessing(true);
    
    try {
      await trackTagOperation(`complete_${tag.tagType}_tag`, async () => {
        const newContent = {
          type: tag.tagType.toLowerCase(),
          value: content,
          isRequired: config.required || false,
          metadata: {
            tagType: tag.tagType,
            userId: currentUserId,
            sessionId,
            timestamp: new Date().toISOString()
          }
        };
        
        onComplete(newContent);
        setIsEditing(false);
        return newContent;
      });
    } catch (error) {
      console.error('Tag completion error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [content, validateContent, onComplete, isProcessing, tag.tagType, currentUserId, sessionId, config.required, trackTagOperation]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setValidationError(null);
    setContent(tag.content || '');
    onCancel();
  }, [onCancel, tag.content]);

  // Handle date selection
  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      handleContentChange(date);
      setShowDatePicker(false);
    }
  }, [handleContentChange]);

  // Handle select change
  const handleSelectChange = useCallback((value: string) => {
    handleContentChange(value);
  }, [handleContentChange]);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Handle tag interaction when clicked
  useEffect(() => {
    if (isActive && canEdit && !isEditing) {
      // Auto-start editing for certain tag types
      if (['I', 'N', 'O'].includes(tag.tagType)) {
        setIsEditing(true);
      } else if (['D', 'X'].includes(tag.tagType)) {
        // For date fields, show date picker
        setShowDatePicker(true);
      } else if (['E', 'W'].includes(tag.tagType)) {
        // For select fields, start editing
        setIsEditing(true);
      }
    }
  }, [isActive, canEdit, isEditing, tag.tagType]);

  // Render input based on tag type
  const renderInput = () => {
    switch (config.type) {
      case 'text':
        return (
          <Input
            ref={inputRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={config.placeholder}
            maxLength={config.maxLength}
            className="w-full"
            disabled={isProcessing}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={config.placeholder}
            maxLength={config.maxLength}
            className="w-full min-h-[80px] p-2 border rounded-md resize-none"
            disabled={isProcessing}
          />
        );

      case 'select':
        return (
          <select
            value={content}
            onChange={(e) => handleSelectChange(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={isProcessing}
          >
            <option value="">{config.placeholder}</option>
            {config.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'date':
        return (
          <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !content && "text-muted-foreground"
                )}
                disabled={isProcessing}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {content ? format(content, "PPP") : config.placeholder}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={content}
                onSelect={handleDateSelect}
                initialFocus
                disabled={(date) => date > new Date()}
              />
            </PopoverContent>
          </Popover>
        );

      default:
        return (
          <Input
            ref={inputRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={config.placeholder}
            className="w-full"
            disabled={isProcessing}
          />
        );
    }
  };

  if (!isEditing && !showDatePicker) {
    return null;
  }

  return (
    <Card className="absolute z-50 w-80 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          {tag.tagType === 'I' && 'Initials'}
          {tag.tagType === 'D' && 'Date'}
          {tag.tagType === 'N' && 'Commission Number'}
          {tag.tagType === 'X' && 'Commission Expiration'}
          {tag.tagType === 'O' && 'Disclosure'}
          {tag.tagType === 'E' && 'Seal'}
          {tag.tagType === 'W' && 'Whiteout'}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {renderInput()}
        
        {validationError && (
          <div className="text-sm text-red-600">
            {validationError}
          </div>
        )}
        
        <div className="flex space-x-2">
          <Button
            onClick={handleComplete}
            disabled={isProcessing || !!validationError}
            className="flex-1"
            size="sm"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            Complete
          </Button>
          
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isProcessing}
            size="sm"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
