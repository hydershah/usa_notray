import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Stamp, Users, FileText } from 'lucide-react';
import { useToast } from '../../hooks/use-toast';

interface SessionParticipant {
  userId: number;
  displayName: string;
  userType: 'notary' | 'signer' | 'witness';
  isActive: boolean;
  canInteract: boolean;
}

interface SealConfigData {
  applicableSigners: number[];
  notarizationType: 'acknowledgment' | 'jurat' | 'copy_certification';
  notaryNote?: string;
}

interface SealConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: SealConfigData) => void;
  participants: SessionParticipant[];
  isLoading?: boolean;
}

const NOTARIZATION_TYPES = [
  {
    value: 'acknowledgment' as const,
    label: 'Acknowledgment',
    description: 'Signer acknowledges they signed the document willingly'
  },
  {
    value: 'jurat' as const,
    label: 'Jurat',
    description: 'Signer swears or affirms the content is true'
  },
  {
    value: 'copy_certification' as const,
    label: 'Copy Certification',
    description: 'Notary certifies a copy is true and complete'
  }
] as const;

export const SealConfigDialog: React.FC<SealConfigDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  participants,
  isLoading = false
}) => {
  const { toast } = useToast();
  
  // State
  const [selectedSigners, setSelectedSigners] = useState<Set<number>>(new Set());
  const [notarizationType, setNotarizationType] = useState<'acknowledgment' | 'jurat' | 'copy_certification'>('acknowledgment');
  const [notaryNote, setNotaryNote] = useState('');
  
  // Get only signers from participants
  const signers = participants.filter(p => p.userType === 'signer');
  
  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSigners(new Set());
      setNotarizationType('acknowledgment');
      setNotaryNote('');
    }
  }, [isOpen]);
  
  // Handle signer selection
  const handleSignerToggle = (userId: number) => {
    const newSelection = new Set(selectedSigners);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedSigners(newSelection);
  };
  
  // Handle select all/none
  const handleSelectAll = () => {
    if (selectedSigners.size === signers.length) {
      setSelectedSigners(new Set());
    } else {
      setSelectedSigners(new Set(signers.map(s => s.userId)));
    }
  };
  
  // Handle form submission
  const handleSubmit = () => {
    if (selectedSigners.size === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one signer for this seal.",
        variant: "destructive"
      });
      return;
    }
    
    const config: SealConfigData = {
      applicableSigners: Array.from(selectedSigners),
      notarizationType,
      notaryNote: notaryNote.trim() || undefined
    };
    
    onConfirm(config);
  };
  
  if (!isOpen) return null;
  
  const dialogContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4" 
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        // Close dialog if clicking on backdrop
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto relative transform transition-all" 
        style={{ zIndex: 10000 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
              <Stamp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Configure Notary Seal</h2>
              <p className="text-sm text-gray-500">Select signers and notarization type</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Signer Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-600" />
                <label className="text-sm font-medium text-gray-900">
                  Applicable Signers
                </label>
              </div>
              {signers.length > 1 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={isLoading}
                  className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {selectedSigners.size === signers.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
            
            {signers.length === 0 ? (
              <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg">
                No signers found in this session
              </div>
            ) : (
              <div className="space-y-2">
                {signers.map(signer => (
                  <label
                    key={signer.userId}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSigners.has(signer.userId)}
                      onChange={() => handleSignerToggle(signer.userId)}
                      disabled={isLoading}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {signer.displayName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {signer.isActive ? 'Active' : 'Inactive'} • {signer.userType}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          
          {/* Notarization Type */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-gray-600" />
              <label className="text-sm font-medium text-gray-900">
                Notarization Type
              </label>
            </div>
            <div className="space-y-2">
              {NOTARIZATION_TYPES.map(type => (
                <label
                  key={type.value}
                  className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="radio"
                    name="notarizationType"
                    value={type.value}
                    checked={notarizationType === type.value}
                    onChange={(e) => setNotarizationType(e.target.value as any)}
                    disabled={isLoading}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mt-0.5 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {type.label}
                    </div>
                    <div className="text-xs text-gray-500">
                      {type.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          
          {/* Optional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Notary Notes (Optional)
            </label>
            <textarea
              value={notaryNote}
              onChange={(e) => setNotaryNote(e.target.value)}
              disabled={isLoading}
              placeholder="Add any additional notes about this notarization..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:bg-gray-50"
              rows={3}
              maxLength={500}
            />
            {notaryNote.length > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {notaryNote.length}/500 characters
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || selectedSigners.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Stamp className="w-4 h-4" />
                Apply Seal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  // Render the dialog as a portal to avoid z-index conflicts
  return createPortal(dialogContent, document.body);
}; 