import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';

interface NotaryProfileStatus {
  isComplete: boolean;
  needsProfileCompletion: boolean;
  showOverlay: boolean;
  profileData?: any;
  isLoading: boolean;
  error?: string;
}

export function useNotaryProfileCompletion(): NotaryProfileStatus {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [showOverlay, setShowOverlay] = useState(false);
  const [profileStatus, setProfileStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const checkProfileStatus = async () => {
    if (!user || user.role !== 'notary' || !isAuthenticated) {
      return {
        isComplete: true, // Non-notaries don't need profile completion
        needsProfileCompletion: false,
        showOverlay: false,
        isLoading: false
      };
    }

    try {
      setIsLoading(true);
      setError(undefined);
      
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No authentication token found for notary profile check');
        return {
          isComplete: false,
          needsProfileCompletion: true,
          showOverlay: false,
          isLoading: false
        };
      }

      const response = await fetch('/api/notary/profile/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to check notary profile status');
      }

      const statusData = await response.json();
      setProfileStatus(statusData);

      // Check if profile completion is needed
      const profileComplete = statusData.profileComplete || false;
      const isApproved = statusData.approvalStatus === 'approved';
      const canAccessDashboard = statusData.canAccessDashboard || false;

      // Notary needs profile completion if:
      // 1. Profile is not complete, OR
      // 2. Profile is complete but not approved (and not rejected - let them access dashboard for rejected status)
      const needsCompletion = !profileComplete;
      
      // Show overlay if notary needs profile completion
      const shouldShowOverlay = needsCompletion;

      console.log('🔍 Notary profile completion check:', {
        user: user.email,
        profileComplete,
        isApproved,
        canAccessDashboard,
        needsCompletion,
        shouldShowOverlay,
        statusData
      });

      return {
        isComplete: profileComplete && isApproved,
        needsProfileCompletion: needsCompletion,
        showOverlay: shouldShowOverlay,
        profileData: statusData,
        isLoading: false
      };

    } catch (err) {
      console.error('Error checking notary profile status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check profile status');
      
      // On error, assume completion is needed to be safe
      return {
        isComplete: false,
        needsProfileCompletion: true,
        showOverlay: true,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to check profile status'
      };
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const getStatus = async () => {
      if (authLoading) return;
      
      const status = await checkProfileStatus();
      setShowOverlay(status.showOverlay);
    };

    getStatus();
  }, [user, isAuthenticated, authLoading]);

  // Manual refresh function for components to call after profile updates
  const refresh = async () => {
    const status = await checkProfileStatus();
    setShowOverlay(status.showOverlay);
    return status;
  };

  const getCompletionStatus = (): NotaryProfileStatus => {
    if (authLoading || isLoading) {
      return {
        isComplete: false,
        needsProfileCompletion: false,
        showOverlay: false,
        isLoading: true
      };
    }

    if (!isAuthenticated || !user) {
      return {
        isComplete: true,
        needsProfileCompletion: false,
        showOverlay: false,
        isLoading: false
      };
    }

    // Only apply this flow to notaries
    const isNotary = user.role === 'notary';
    
    if (!isNotary) {
      return {
        isComplete: true,
        needsProfileCompletion: false,
        showOverlay: false,
        isLoading: false
      };
    }

    // For notaries, use the profile status data
    if (!profileStatus) {
      return {
        isComplete: false,
        needsProfileCompletion: true,
        showOverlay: showOverlay,
        isLoading: false
      };
    }

    const profileComplete = profileStatus.profileComplete || false;
    const isApproved = profileStatus.approvalStatus === 'approved';
    const needsCompletion = !profileComplete;

    console.log('🔍 Final notary status calculation:', {
      profileComplete,
      isApproved,
      needsCompletion,
      showOverlay,
      profileStatus
    });

    return {
      isComplete: profileComplete && isApproved,
      needsProfileCompletion: needsCompletion,
      showOverlay: showOverlay,
      profileData: profileStatus,
      isLoading: false,
      error
    };
  };

  return {
    ...getCompletionStatus(),
    refresh
  } as NotaryProfileStatus & { refresh: () => Promise<NotaryProfileStatus> };
}
