import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';

interface NotaryProfileStatus {
  profileComplete: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'requires_update';
  isActive: boolean;
  missingFields: string[];
  missingFiles: string[];
  canAccessDashboard: boolean;
  lastProfileUpdate: string | null;
}

export function useNotaryProfileStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<NotaryProfileStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkProfileStatus = async () => {
      if (!user || user.role !== 'notary') {
        setIsLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/notary/profile/status', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check profile status');
        }

        const statusData = await response.json();
        setStatus(statusData);
      } catch (err) {
        console.error('Error checking profile status:', err);
        setError(err instanceof Error ? err.message : 'Failed to check profile status');
      } finally {
        setIsLoading(false);
      }
    };

    checkProfileStatus();
  }, [user]);

  const needsProfileCompletion = status && !status.profileComplete;
  const needsApproval = status && status.profileComplete && status.approvalStatus === 'pending';
  const isRejected = status && status.approvalStatus === 'rejected';
  const requiresUpdate = status && status.approvalStatus === 'requires_update';

  return {
    status,
    isLoading,
    error,
    needsProfileCompletion,
    needsApproval,
    isRejected,
    requiresUpdate,
    canAccessDashboard: status?.canAccessDashboard || false,
  };
} 