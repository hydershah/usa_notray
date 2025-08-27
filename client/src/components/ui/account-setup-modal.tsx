import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  User, 
  MapPin, 
  CheckCircle,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useLocation } from 'wouter';

interface AccountSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  requirements?: string[];
  onSetupClick?: () => void;
}

export function AccountSetupModal({ 
  isOpen, 
  onClose, 
  requirements = [],
  onSetupClick 
}: AccountSetupModalProps) {
  const [, setLocation] = useLocation();

  const handleSetupAccount = () => {
    if (onSetupClick) {
      onSetupClick();
    } else {
      setLocation('/profile');
    }
    onClose();
  };

  const getRequirementIcon = (requirement: string) => {
    if (requirement.toLowerCase().includes('personal') || requirement.toLowerCase().includes('name') || requirement.toLowerCase().includes('phone')) {
      return <User className="h-4 w-4 text-blue-600" />;
    }
    if (requirement.toLowerCase().includes('address')) {
      return <MapPin className="h-4 w-4 text-blue-600" />;
    }
    return <AlertCircle className="h-4 w-4 text-blue-600" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-white">
                  Account Setup Required
                </DialogTitle>
                <DialogDescription className="text-blue-100 mt-1">
                  Complete your profile to access all features
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              Please complete your account setup to continue with this action.
            </AlertDescription>
          </Alert>

          {requirements.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                Required Information
              </h4>
              <div className="space-y-2">
                {requirements.map((requirement, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"
                  >
                    {getRequirementIcon(requirement)}
                    <span className="text-sm text-gray-700 font-medium">
                      {requirement}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-1 bg-blue-100 rounded">
                <AlertCircle className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">Why is this required?</h4>
                <p className="text-sm text-gray-600">
                  Complete profile information is required for identity verification and 
                  compliance with notarization regulations. This ensures secure and legally 
                  valid document signing sessions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSetupAccount}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <span>Complete Setup</span>
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
