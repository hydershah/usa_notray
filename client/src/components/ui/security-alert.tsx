import React from 'react';
import { AlertTriangle, Shield, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface SecurityAlertProps {
  type: 'email-exists' | 'security-warning' | 'info';
  title?: string;
  message: string;
  suggestion?: string;
  onRetry?: () => void;
  onSignIn?: () => void;
  className?: string;
}

export function SecurityAlert({ 
  type, 
  title, 
  message, 
  suggestion, 
  onRetry, 
  onSignIn, 
  className 
}: SecurityAlertProps) {
  const getIcon = () => {
    switch (type) {
      case 'email-exists':
        return <Shield className="h-4 w-4" />;
      case 'security-warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'info':
        return <Info className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getVariant = () => {
    switch (type) {
      case 'email-exists':
        return 'destructive' as const;
      case 'security-warning':
        return 'destructive' as const;
      case 'info':
        return 'default' as const;
      default:
        return 'default' as const;
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'email-exists':
        return 'Email Already Registered';
      case 'security-warning':
        return 'Security Notice';
      case 'info':
        return 'Information';
      default:
        return 'Notice';
    }
  };

  return (
    <Alert variant={getVariant()} className={className}>
      {getIcon()}
      <AlertTitle>{title || getDefaultTitle()}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message}</p>
        {suggestion && (
          <p className="text-sm text-muted-foreground">{suggestion}</p>
        )}
        {(onRetry || onSignIn) && (
          <div className="flex gap-2 mt-3">
            {onSignIn && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onSignIn}
                className="text-xs"
              >
                Sign In Instead
              </Button>
            )}
            {onRetry && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onRetry}
                className="text-xs"
              >
                Try Different Email
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Specific component for email already exists error
export function EmailExistsAlert({ 
  email, 
  onSignIn, 
  onRetry,
  className 
}: { 
  email?: string;
  onSignIn?: () => void;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <SecurityAlert
      type="email-exists"
      title="Email Already Registered"
      message={`An account with ${email ? `"${email}"` : 'this email address'} already exists. Email addresses must be unique across all account types (client, notary, admin, title company, etc.).`}
      suggestion="Please use a different email address or sign in to your existing account."
      onSignIn={onSignIn}
      onRetry={onRetry}
      className={className}
    />
  );
}
