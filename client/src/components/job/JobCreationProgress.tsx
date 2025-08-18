import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Circle, Loader2, Upload, Users, Mail, Settings, AlertCircle, Clock, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JobCreationStep {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  estimatedTime?: string;
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
    estimatedTime: '2-3s',
  },
  {
    id: 'uploading',
    label: 'Uploading Documents',
    description: 'Securely uploading your documents to the cloud',
    icon: Upload,
    estimatedTime: '3-5s',
  },
  {
    id: 'creating-signers',
    label: 'Creating Participants',
    description: 'Setting up signer and witness accounts',
    icon: Users,
    estimatedTime: '2-3s',
  },
  {
    id: 'sending-invites',
    label: 'Sending Invitations',
    description: 'Notifying all participants via email',
    icon: Mail,
    estimatedTime: '3-4s',
  },
  {
    id: 'finalizing',
    label: 'Finalizing Job',
    description: 'Completing job setup and preparing for notarization',
    icon: CheckCircle,
    estimatedTime: '2-3s',
  },
];

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      staggerChildren: 0.1,
      ease: "easeOut"
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.4,
      ease: "easeOut"
    }
  }
};

const progressVariants = {
  initial: { width: 0 },
  animate: (progress: number) => ({
    width: `${progress}%`,
    transition: {
      duration: 0.8,
      ease: "easeOut"
    }
  })
};

export function JobCreationProgress({
  isOpen,
  currentStep,
  completedSteps,
  error,
  progress,
}: JobCreationProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [showSparkles, setShowSparkles] = useState(false);
  const [completedStepsWithAnimation, setCompletedStepsWithAnimation] = useState<string[]>([]);

  // Animate progress bar
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setAnimatedProgress(progress);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [progress, isOpen]);

  // Animate completed steps with delay
  useEffect(() => {
    completedSteps.forEach((stepId, index) => {
      if (!completedStepsWithAnimation.includes(stepId)) {
        setTimeout(() => {
          setCompletedStepsWithAnimation(prev => [...prev, stepId]);
        }, index * 200);
      }
    });
  }, [completedSteps, completedStepsWithAnimation]);

  // Show sparkles when job is complete
  useEffect(() => {
    if (progress === 100 && !error) {
      setShowSparkles(true);
      const timer = setTimeout(() => setShowSparkles(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [progress, error]);

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
        return (
          <motion.div 
            className="relative"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <AnimatePresence>
              {showSparkles && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="w-4 h-4 text-yellow-400 animate-bounce" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      case 'current':
        return (
          <motion.div 
            className="relative"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
            <motion.div 
              className="absolute inset-0 rounded-full bg-blue-200"
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.3, 0, 0.3]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
        );
      case 'error':
        return (
          <motion.div 
            className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
          </motion.div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <IconComponent className="w-4 h-4 text-gray-400" />
          </div>
        );
    }
  };

  const getStepClasses = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-sm';
      case 'current':
        return 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-300 ring-2 ring-blue-200 shadow-md';
      case 'error':
        return 'bg-gradient-to-r from-red-50 to-rose-50 border-red-200 shadow-sm';
      default:
        return 'bg-gray-50/50 border-gray-200';
    }
  };

  const getStepTextColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-800';
      case 'current':
        return 'text-blue-800';
      case 'error':
        return 'text-red-800';
      default:
        return 'text-gray-600';
    }
  };

  const getStepDescriptionColor = (status: string) => {
    switch (status) {
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          <DialogHeader className="pb-4">
            <motion.div 
              className="flex items-center gap-3 text-xl font-bold text-gray-900"
              variants={itemVariants}
            >
              <div className="relative">
                <motion.div 
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
                >
                  <Settings className="h-6 w-6 text-white" />
                </motion.div>
                <AnimatePresence>
                  {showSparkles && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute -top-2 -right-2"
                    >
                      <Sparkles className="w-5 h-5 text-yellow-400 animate-bounce" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div>
                <motion.div 
                  className="text-xl font-bold text-gray-900"
                  variants={itemVariants}
                >
                  Creating Your Job
                </motion.div>
                <motion.div 
                  className="text-sm font-medium text-gray-500"
                  variants={itemVariants}
                >
                  Setting up your notarization session
                </motion.div>
              </div>
            </motion.div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Overall Progress Section */}
            <motion.div 
              className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-4 border border-gray-200"
              variants={itemVariants}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="w-3 h-3 bg-blue-500 rounded-full"
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.7, 1]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                  <span className="font-semibold text-gray-700">Overall Progress</span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                      {Math.round(animatedProgress)}%
                    </Badge>
                  </motion.div>
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    ~{Math.ceil((100 - animatedProgress) / 20)}s remaining
                  </span>
                </div>
              </div>
              <div className="relative">
                <Progress 
                  value={100} 
                  className="h-3 bg-gray-200" 
                />
                <motion.div
                  className="absolute top-0 left-0 h-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                  variants={progressVariants}
                  initial="initial"
                  animate="animate"
                  custom={animatedProgress}
                />
              </div>
              <motion.div 
                className="mt-2 text-xs text-gray-500 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {progress === 100 ? 'Job creation complete!' : 'Please wait while we set up your job...'}
              </motion.div>
            </motion.div>

            {/* Steps */}
            <div className="space-y-3">
              {JOB_CREATION_STEPS.map((step, index) => {
                const status = getStepStatus(step);
                const isLast = index === JOB_CREATION_STEPS.length - 1;
                
                return (
                  <motion.div 
                    key={step.id}
                    variants={itemVariants}
                    whileHover={{ scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ease-out',
                        getStepClasses(status),
                        status === 'current' && 'scale-[1.02] transform'
                      )}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getStepIcon(step, status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={cn(
                            'text-sm font-semibold',
                            getStepTextColor(status)
                          )}>
                            {step.label}
                          </h4>
                          <div className="flex items-center gap-2">
                            <AnimatePresence>
                              {status === 'completed' && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs">
                                    Complete
                                  </Badge>
                                </motion.div>
                              )}
                              {status === 'current' && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                                    In Progress
                                  </Badge>
                                </motion.div>
                              )}
                              {status === 'error' && (
                                <motion.div
                                  initial={{ scale: 0, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  exit={{ scale: 0, opacity: 0 }}
                                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-xs">
                                    Error
                                  </Badge>
                                </motion.div>
                              )}
                              {step.estimatedTime && status === 'pending' && (
                                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                                  ~{step.estimatedTime}
                                </Badge>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                        <p className={cn(
                          'text-sm leading-relaxed',
                          getStepDescriptionColor(status)
                        )}>
                          {status === 'error' && error ? error : step.description}
                        </p>
                      </div>
                    </div>
                    {!isLast && (
                      <div className="ml-8 my-2">
                        <motion.div 
                          className="w-px h-6 bg-gradient-to-b from-gray-200 to-transparent"
                          initial={{ height: 0 }}
                          animate={{ height: 24 }}
                          transition={{ delay: index * 0.1, duration: 0.3 }}
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Enhanced Footer */}
            <motion.div 
              className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200"
              variants={itemVariants}
            >
              <div className="flex items-center gap-3">
                <motion.div 
                  className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"
                  animate={{ 
                    rotate: progress === 100 ? 360 : 0,
                    scale: progress === 100 ? [1, 1.1, 1] : 1
                  }}
                  transition={{ 
                    rotate: { duration: 0.6, ease: "easeOut" },
                    scale: { duration: 0.3, ease: "easeOut" }
                  }}
                >
                  {progress === 100 ? (
                    <Check className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-blue-600" />
                  )}
                </motion.div>
                <div className="flex-1">
                  <motion.p 
                    className="text-sm font-medium text-blue-900"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {progress === 100 ? 'Job Created Successfully!' : 'Please Wait'}
                  </motion.p>
                  <motion.p 
                    className="text-xs text-blue-700 mt-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    {progress === 100 
                      ? 'Your notarization job is ready. You will receive a confirmation email shortly.'
                      : 'This process typically takes 10-15 seconds. Please don\'t close this window.'
                    }
                  </motion.p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
} 