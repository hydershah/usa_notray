import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SignatureSelectionModal } from './SignatureSelectionModal';
import { 
  Check, 
  X, 
  CalendarIcon, 
  Signature, 
  Type, 
  User,
  FileText,
  Edit3,
  Save,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import type { DocumentTag, TagType } from '@/types/editor';

interface InteractiveTagInputProps {
  tag: DocumentTag;
  isActive: boolean;
  canEdit: boolean;
  userProfile?: {
    signatures?: string[];
    initials?: string[];
    name?: string;
    commissionNumber?: string;
    commissionExpiration?: string;
    disclosure?: string;
  };
  currentUserId?: string;
  onComplete: (content: TagContent) => void;
  onCancel: () => void;
  onContentChange?: (content: TagContent) => void;
}

interface TagContent {
  type: 'text' | 'signature' | 'date' | 'image';
  value: string | Date;
  isRequired: boolean;
  validation?: {
    isValid: boolean;
    message?: string;
  };
}

const TAG_CONFIG = {
  'A': { // Name
    label: 'Full Name',
    placeholder: 'Enter full name',
    type: 'text' as const,
    maxLength: 100,
    required: true,
    icon: <User className="h-4 w-4" />
  },
  'S': { // Signature
    label: 'Signature',
    placeholder: 'Click to apply signature',
    type: 'signature' as const,
    required: true,
    icon: <Signature className="h-4 w-4" />
  },
  'I': { // Initials
    label: 'Initials',
    placeholder: 'Enter initials',
    type: 'text' as const,
    maxLength: 10,
    required: true,
    icon: <Type className="h-4 w-4" />
  },
  'T': { // Text
    label: 'Text',
    placeholder: 'Enter text',
    type: 'text' as const,
    maxLength: 500,
    required: false,
    icon: <FileText className="h-4 w-4" />
  },
  'D': { // Date
    label: 'Date',
    placeholder: 'Select date',
    type: 'date' as const,
    required: true,
    icon: <CalendarIcon className="h-4 w-4" />
  },
  'N': { // Commission Number
    label: 'Commission Number',
    placeholder: 'Enter commission number',
    type: 'text' as const,
    maxLength: 50,
    required: true,
    icon: <FileText className="h-4 w-4" />
  },
  'X': { // Commission Expiration
    label: 'Commission Expiration',
    placeholder: 'Select expiration date',
    type: 'date' as const,
    required: true,
    icon: <CalendarIcon className="h-4 w-4" />
  },
  'O': { // Disclosure
    label: 'Disclosure Statement',
    placeholder: 'Enter disclosure (max 250 characters)',
    type: 'text' as const,
    maxLength: 250,
    required: false,
    icon: <FileText className="h-4 w-4" />
  }
} as const;

export const InteractiveTagInput: React.FC<InteractiveTagInputProps> = ({
  tag,
  isActive,
  canEdit,
  userProfile,
  currentUserId,
  onComplete,
  onCancel,
  onContentChange
}) => {
  const [content, setContent] = useState<TagContent>({
    type: 'text',
    value: '',
    isRequired: true
  });
  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const config = TAG_CONFIG[tag.tagType as keyof typeof TAG_CONFIG];

  // Initialize content from user profile
  useEffect(() => {
    if (!userProfile) return;

    let initialValue = '';
    
    switch (tag.tagType) {
      case 'A': // Name
        initialValue = userProfile.name || '';
        break;
      case 'S': // Signature
        initialValue = userProfile.signatures?.[0] || '';
        break;
      case 'I': // Initials
        initialValue = userProfile.initials?.[0] || '';
        break;
      case 'N': // Commission Number
        initialValue = userProfile.commissionNumber || '';
        break;
      case 'X': // Commission Expiration
        initialValue = userProfile.commissionExpiration || '';
        break;
      case 'O': // Disclosure
        initialValue = userProfile.disclosure || '';
        break;
      case 'D': // Date
        initialValue = new Date().toLocaleDateString();
        break;
    }

    setContent({
      type: config?.type || 'text',
      value: config?.type === 'date' ? new Date() : initialValue,
      isRequired: config?.required || false
    });
  }, [tag.tagType, userProfile, config]);

  // Auto-focus when editing starts
  useEffect(() => {
    if (isEditing && isActive) {
      setTimeout(() => {
        if (config?.type === 'text' && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        } else if (config?.type === 'text' && textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 100);
    }
  }, [isEditing, isActive, config?.type]);

  // Validate content
  const validateContent = useCallback((value: string | Date): { isValid: boolean; message?: string } => {
    if (!config) return { isValid: true };

    if (config.required) {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return { isValid: false, message: `${config.label} is required` };
      }
    }

    if (typeof value === 'string' && 'maxLength' in config && config.maxLength && value.length > config.maxLength) {
      return { isValid: false, message: `Maximum ${config.maxLength} characters allowed` };
    }

    // Specific validations
    switch (tag.tagType) {
      case 'N': // Commission Number
        if (typeof value === 'string' && value && !/^[A-Z0-9\-]+$/i.test(value)) {
          return { isValid: false, message: 'Invalid commission number format' };
        }
        break;
    }

    return { isValid: true };
  }, [config, tag.tagType]);

  // Handle content change
  const handleContentChange = useCallback((newValue: string | Date) => {
    const validation = validateContent(newValue);
    const newContent: TagContent = {
      ...content,
      value: newValue,
      validation
    };
    
    setContent(newContent);
    setValidationError(validation.isValid ? null : validation.message || null);
    
    if (onContentChange) {
      onContentChange(newContent);
    }
  }, [content, validateContent, onContentChange]);

  // Handle save
  const handleSave = useCallback(() => {
    const validation = validateContent(content.value);
    
    if (!validation.isValid) {
      setValidationError(validation.message || 'Invalid input');
      return;
    }

    onComplete(content);
    setIsEditing(false);
  }, [content, validateContent, onComplete]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setValidationError(null);
    onCancel();
  }, [onCancel]);

  // Handle signature selection modal
  const handleOpenSignatureModal = useCallback(() => {
    setShowSignatureModal(true);
  }, []);

  const handleSelectSignature = useCallback((signatureUrl: string) => {
    handleContentChange(signatureUrl);
    setShowSignatureModal(false);
    handleSave();
  }, [handleContentChange, handleSave]);

  // Auto-apply content for certain tag types (except signatures which use modal)
  useEffect(() => {
    if (isActive && canEdit && !isEditing) {
      if (['A', 'N', 'X', 'O'].includes(tag.tagType) && content.value) {
        // Auto-complete if we have content
        setTimeout(() => handleSave(), 100);
      } else if (tag.tagType !== 'S') {
        // Start editing for empty fields (except signatures)
        setIsEditing(true);
      }
      // Signature tags ('S') don't auto-apply - they open the selection modal instead
    }
  }, [isActive, canEdit, tag.tagType, userProfile, content.value, isEditing, handleContentChange, handleSave]);

  // Render signature preview
  const renderSignaturePreview = () => {
    if (tag.tagType !== 'S' || !content.value) return null;

    return (
      <div className="flex items-center justify-center p-2 bg-blue-50 border border-blue-200 rounded">
        <img 
          src={content.value as string} 
          alt="Signature" 
          className="max-h-8 max-w-full object-contain"
          style={{ filter: 'invert(0) sepia(0) saturate(0) hue-rotate(220deg) brightness(0) contrast(1)' }} // Make signature blue
        />
      </div>
    );
  };

  // Render date picker
  const renderDatePicker = () => {
    if (config?.type !== 'date') return null;

    return (
      <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !content.value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {content.value instanceof Date ? format(content.value, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={content.value instanceof Date ? content.value : undefined}
            onSelect={(date) => {
              if (date) {
                handleContentChange(date);
                setShowDatePicker(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  };

  // Render text input
  const renderTextInput = () => {
    if (config?.type !== 'text') return null;

    const isLongText = 'maxLength' in config && config.maxLength && config.maxLength > 100;

    if (isLongText) {
      return (
        <Textarea
          ref={textareaRef}
          value={content.value as string}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={config.placeholder}
          maxLength={'maxLength' in config ? config.maxLength : undefined}
          rows={3}
          className="w-full resize-none"
        />
      );
    }

    return (
      <Input
        ref={inputRef}
        type="text"
        value={content.value as string}
        onChange={(e) => handleContentChange(e.target.value)}
        placeholder={config.placeholder}
        maxLength={'maxLength' in config ? config.maxLength : undefined}
        className="w-full"
      />
    );
  };

  if (!config) {
    return (
      <div className="p-2 bg-red-50 border border-red-200 rounded text-center">
        <AlertCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
        <p className="text-xs text-red-600">Unsupported tag type: {tag.tagType}</p>
      </div>
    );
  }

  // Show completed state
  if (!isEditing && content.value && !isActive) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-green-50 border border-green-200">
        {tag.tagType === 'S' ? renderSignaturePreview() : (
          <div className="text-center p-1">
            <Check className="h-3 w-3 text-green-600 mx-auto mb-1" />
            <p className="text-xs text-green-700 truncate max-w-full">
              {typeof content.value === 'string' 
                ? content.value.length > 20 ? `${content.value.substring(0, 20)}...` : content.value
                : content.value instanceof Date 
                ? format(content.value, "MM/dd/yyyy")
                : 'Completed'
              }
            </p>
          </div>
        )}
      </div>
    );
  }

  // Show editing interface
  return (
    <Card className="w-full h-full min-h-[120px] flex flex-col">
      <div className="p-3 flex-1">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {config.icon}
            <span className="text-sm font-medium">{config.label}</span>
            {config.required && <Badge variant="destructive" className="text-xs px-1">Required</Badge>}
          </div>
        </div>

        {/* Input Field */}
        <div className="mb-3">
          {tag.tagType === 'S' ? (
            <div className="space-y-2">
              <Button 
                onClick={handleOpenSignatureModal}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Signature className="h-4 w-4 mr-2" />
                {content.value ? 'Change Signature' : 'Select Signature'}
              </Button>
              {content.value && renderSignaturePreview()}
            </div>
          ) : config.type === 'date' ? (
            renderDatePicker()
          ) : (
            renderTextInput()
          )}
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="mb-3 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {validationError}
          </div>
        )}

        {/* Character Count */}
        {config.type === 'text' && 'maxLength' in config && config.maxLength && (
          <div className="text-xs text-gray-500 mb-3">
            {typeof content.value === 'string' ? content.value.length : 0}/{config.maxLength}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t p-2 flex gap-2">
        <Button 
          onClick={handleSave} 
          disabled={!!validationError || (!content.value && config.required)}
          className="flex-1 h-8 text-xs"
        >
          <Save className="h-3 w-3 mr-1" />
          Save
        </Button>
        <Button 
          onClick={handleCancel} 
          variant="outline" 
          className="flex-1 h-8 text-xs"
        >
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>

      {/* Signature Selection Modal */}
      {tag.tagType === 'S' && (
        <SignatureSelectionModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onSelect={handleSelectSignature}
          userId={parseInt(currentUserId || '0')}
        />
      )}
    </Card>
  );
}; 