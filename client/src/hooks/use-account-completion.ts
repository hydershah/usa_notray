import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';

interface AccountCompletionStatus {
  isComplete: boolean;
  needsProfileCompletion: boolean;
  needsVerification: boolean;
  showOverlay: boolean;
}

export function useAccountCompletion(): AccountCompletionStatus {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showOverlay, setShowOverlay] = useState(false);

  const getCompletionStatus = (): AccountCompletionStatus => {
    if (!isAuthenticated || isLoading || !user) {
      return {
        isComplete: false,
        needsProfileCompletion: false,
        needsVerification: false,
        showOverlay: false
      };
    }

    // Only apply this flow to signers and witnesses
    const requiresCompletion = user.role === 'signer' || user.role === 'witness';
    
    if (!requiresCompletion) {
      return {
        isComplete: true,
        needsProfileCompletion: false,
        needsVerification: false,
        showOverlay: false
      };
    }

    // Trust the backend's calculation but also provide frontend fallback
    const backendAccountComplete = Boolean((user as any).accountSetupComplete);
    
    // Fallback: Check profile completion manually if backend flag is missing
    const hasBasicInfo = Boolean(user.firstName && user.lastName && (user.phoneNumber || user.phone));
    const hasAddress = Boolean((user.address1 && user.city && user.state && user.zipCode) || user.address);
    const isProfileComplete = backendAccountComplete || (hasBasicInfo && hasAddress);

    // Check verification status (consider multiple backend flags)
    const isVerified = (
      Boolean(user.isVerified) ||
      Boolean(user.isVerificationBypassed) ||
      Boolean(user.notaryVerificationBypassed) ||
      (user as any).verificationStatus === 'approved'
    );

    const isComplete = isProfileComplete && isVerified;
    const needsProfileCompletion = !isProfileComplete;
    const needsVerification = isProfileComplete && !isVerified;

    // Debug logging
    console.log('🔍 Account completion status check:', {
      user: user.email,
      role: user.role,
      requiresCompletion,
      backendAccountComplete,
      hasBasicInfo,
      hasAddress,
      isProfileComplete,
      isVerified,
      isComplete,
      needsProfileCompletion,
      needsVerification,
      userFields: {
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        phoneNumber: user.phoneNumber,
        address1: user.address1,
        city: user.city,
        state: user.state,
        zipCode: user.zipCode,
        address: user.address,
        isVerified: user.isVerified,
        accountSetupComplete: (user as any).accountSetupComplete
      }
    });

    return {
      isComplete,
      needsProfileCompletion,
      needsVerification,
      showOverlay: !isComplete && requiresCompletion
    };
  };

  const status = getCompletionStatus();

  // Update showOverlay state based on completion status
  useEffect(() => {
    setShowOverlay(status.showOverlay);
  }, [status.showOverlay]);

  // Safety: if user becomes verified while overlay is open, hide it immediately
  useEffect(() => {
    if (status.isComplete && showOverlay) {
      console.log('🎯 Account completion detected, hiding overlay');
      setShowOverlay(false);
    }
  }, [status.isComplete, showOverlay]);

  return {
    ...status,
    showOverlay
  };
}
