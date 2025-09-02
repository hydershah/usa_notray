import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Loader2, Upload, Users, Mail, Settings, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JobCreationStep {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface JobCreationProgressProps {
  isOpen: boolean;
  currentStep: string;
  completedSteps: string[];
  error?: string | null;
  progress: number;
}

const JOB_CREATION_STEPS: JobCreationStep[] = [
  {
    id: 'preparing',
    label: 'Preparing Job',
    description: 'Setting up job details and validating information',
    icon: Settings,
  },
  {
    id: 'uploading',
    label: 'Uploading Documents',
    description: 'Securely uploading your documents to the cloud',
    icon: Upload,
  },
  {
    id: 'creating-signers',
    label: 'Creating Participants',
    description: 'Setting up signer and witness accounts',
    icon: Users,
  },
  {
    id: 'sending-invites',
    label: 'Sending Invitations',
    description: 'Notifying all participants via email',
    icon: Mail,
  },
  {
    id: 'finalizing',
    label: 'Finalizing Job',
    description: 'Completing job setup and preparing for notarization',
    icon: CheckCircle,
  },
];

export function JobCreationProgress({
  isOpen,
  currentStep,
  completedSteps,
  error,
  progress,
}: JobCreationProgressProps) {
  const getStepStatus = (step: JobCreationStep) => {
    if (error && currentStep === step.id) return 'error';
    if (completedSteps.includes(step.id)) return 'completed';
    if (currentStep === step.id) return 'current';
    return 'pending';
  };

  const getStepIcon = (step: JobCreationStep, status: string) => {
    const IconComponent = step.icon;
    
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'current':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <IconComponent className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStepClasses = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200';
      case 'current':
        return 'bg-blue-50 border-blue-200 ring-2 ring-blue-100';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-blue-500" />
            Creating Your Job
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-gray-600">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {JOB_CREATION_STEPS.map((step) => {
              const status = getStepStatus(step);
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border transition-all duration-200',
                    getStepClasses(status)
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(step, status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={cn(
                        'text-sm font-medium',
                        status === 'completed' ? 'text-green-700' :
                        status === 'current' ? 'text-blue-700' :
                        status === 'error' ? 'text-red-700' :
                        'text-gray-600'
                      )}>
                        {step.label}
                      </h4>
                      {status === 'completed' && (
                        <span className="text-xs text-blue-600 bg-green-100 px-2 py-0.5 rounded-full">
                          Complete
                        </span>
                      )}
                      {status === 'current' && (
                        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      'text-xs mt-1',
                      status === 'error' ? 'text-red-600' : 'text-gray-500'
                    )}>
                      {status === 'error' && error ? error : step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer message */}
          <div className="text-center py-2">
            <p className="text-xs text-gray-500">
              This process typically takes 10-15 seconds. Please don't close this window.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 