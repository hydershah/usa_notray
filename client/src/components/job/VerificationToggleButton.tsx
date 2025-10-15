import { useState } from 'react';
import { ShieldCheck, ShieldX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface VerificationToggleButtonProps {
  userId: number;
  jobId: number;
  currentUserRole: string;
  isVerified: boolean;
  signerName: string;
  onToggleComplete?: () => void;
  compact?: boolean;
}

export function VerificationToggleButton({
  userId,
  jobId,
  currentUserRole,
  isVerified,
  signerName,
  onToggleComplete,
  compact = false
}: VerificationToggleButtonProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast } = useToast();

  // Only show to notary and admin users
  const canToggle = currentUserRole === 'notary' || currentUserRole === 'admin';

  if (!canToggle) {
    return null;
  }

  const handleConfirm = async () => {
    try {
      setIsToggling(true);
      setShowConfirm(false);

      const response = await fetch(`/api/verification/toggle/${userId}/${jobId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: isVerified ? 'revoke' : 'bypass',
          signerName
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to toggle verification');
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: result.message || `Verification ${isVerified ? 'revoked' : 'bypassed'} for ${signerName}`,
      });

      // Notify parent component to refresh data
      if (onToggleComplete) {
        onToggleComplete();
      }
    } catch (error) {
      console.error('Toggle verification error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to toggle verification status'
      });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={() => setShowConfirm(true)}
        disabled={isToggling}
        className={`
          ${isVerified 
            ? 'border-red-300 text-red-600 hover:bg-red-50' 
            : 'border-green-300 text-green-600 hover:bg-green-50'
          }
          ${compact ? 'h-8 px-3' : ''}
        `}
      >
        {isToggling ? (
          <Loader2 className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} animate-spin`} />
        ) : isVerified ? (
          <ShieldX className={`${compact ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
        ) : (
          <ShieldCheck className={`${compact ? 'h-3 w-3 mr-1' : 'h-4 w-4 mr-2'}`} />
        )}
        <span>
          {isVerified ? 'Revoke Verification' : 'Bypass Verification'}
        </span>
      </Button>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isVerified ? 'Revoke Verification?' : 'Bypass Verification?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isVerified 
                ? `Are you sure you want to revoke verification for ${signerName}? They will need to verify again.`
                : `Are you sure you want to bypass verification for ${signerName}? They will be marked as verified without ID verification.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirm}
              className={isVerified ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
            >
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

