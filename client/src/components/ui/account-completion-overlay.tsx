import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { EVSVerification } from '@/components/verification/evs-verification';
import { 
  User, 
  MapPin, 
  Phone, 
  Shield,
  CheckCircle,
  ArrowRight,
  Clock,
  AlertCircle,
  Camera,
  FileText,
  Lock,
  LogOut
} from 'lucide-react';

interface AccountCompletionOverlayProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface ProfileForm {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
}

type CompletionStep = 'profile' | 'verification' | 'complete';

export function AccountCompletionOverlay({ isOpen, onComplete }: AccountCompletionOverlayProps) {
  const { user, refetch, logout } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<CompletionStep>('profile');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: ''
  });
  const [formErrors, setFormErrors] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    address1: '',
    city: '',
    state: '',
    zipCode: ''
  });
  // Prevent prefill overwriting user edits
  const hasPrefilledRef = useRef(false);
  // Allow temporarily forcing a step (e.g., after save, show verification)
  const forcedStepRef = useRef<CompletionStep | null>(null);

  // Check completion status on mount and when user changes
  useEffect(() => {
    if (user && isOpen) {
      // If we have a temporarily forced step, respect it and skip server-driven step changes
      if (forcedStepRef.current) {
        setCurrentStep(forcedStepRef.current);
        return;
      }
      const hasBasicInfo = user.firstName && user.lastName && (user.phoneNumber || user.phone);
      const hasAddress = (user.address1 && user.city && user.state && user.zipCode) || user.address;
      const isProfileComplete = hasBasicInfo && hasAddress;
      const isVerified = user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed;

      // Pre-fill once when overlay opens; do not overwrite user typing
      if (!hasPrefilledRef.current) {
        hasPrefilledRef.current = true;
        setProfileForm({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          phoneNumber: user.phoneNumber || user.phone || '',
          address1: user.address1 || '',
          address2: user.address2 || '',
          city: user.city || '',
          state: user.state || '',
          zipCode: user.zipCode || ''
        });
      }

      // Determine the current step
      // Ensure deterministic step progression: once profile is complete, do not show it again
      if (!isProfileComplete) {
        setCurrentStep('profile');
      } else if (!isVerified) {
        setCurrentStep('verification');
      } else {
        // User is fully complete - don't show complete step, just close the overlay
        // The hook should handle not showing the overlay when user is complete
        setCurrentStep('complete');
        // Don't call onComplete here as it causes a loop
        // The parent should already handle hiding the overlay when user is complete
      }
    }
  }, [user, isOpen, onComplete]);
  // Reset prefill flag whenever overlay closes
  useEffect(() => {
    if (!isOpen) {
      hasPrefilledRef.current = false;
    }
  }, [isOpen]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form before submitting
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form before continuing.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const submitData = {
        ...profileForm,
        phone: profileForm.phoneNumber, // Legacy compatibility
        phoneNumber: profileForm.phoneNumber
      };
      
      console.log('🚀 Submitting profile data:', submitData);
      
      const response = await fetch(`/api/users/${user?.id}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      console.log('📥 Backend response:', updatedUser);

      // Refresh user data once to get updated profile
      const refreshed = await refetch?.();
      console.log('🔄 Refetched user data:', refreshed);
      
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved successfully.",
        className: "bg-green-50 border-green-200",
      });

      // Determine next step based on refreshed user data
      const currentUser = refreshed || user;
      const hasBasicInfo = currentUser?.firstName && currentUser?.lastName && (currentUser?.phoneNumber || currentUser?.phone);
      const hasAddress = (currentUser?.address1 && currentUser?.city && currentUser?.state && currentUser?.zipCode) || currentUser?.address;
      const isProfileComplete = hasBasicInfo && hasAddress;
      const isVerified = currentUser?.isVerified || currentUser?.isVerificationBypassed || currentUser?.notaryVerificationBypassed || (currentUser as any)?.verificationStatus === 'approved';

      if (isProfileComplete && isVerified) {
        console.log('✅ User complete after profile save');
        forcedStepRef.current = null;
        setCurrentStep('complete');
        onComplete();
      } else if (isProfileComplete) {
        console.log('📋 Profile complete, proceed to verification');
        forcedStepRef.current = 'verification';
        setCurrentStep('verification');
      } else {
        console.log('⚠️ Profile still incomplete, staying on profile');
        forcedStepRef.current = 'profile';
        setCurrentStep('profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationComplete = async (result: any) => {
    console.log('✅ Verification completed:', result);
    
    // Refresh user data to get updated verification status
    await refetch?.();
    
    toast({
      title: "Verification Complete!",
      description: "Your identity has been verified successfully.",
      className: "bg-green-50 border-green-200",
    });

    // Close immediately; wrapper will hide overlay when status is complete
    console.log('🎉 Setting completion step and calling onComplete');
    forcedStepRef.current = null;
    setCurrentStep('complete');
    onComplete();
  };

  const handleVerificationFailed = (error: string) => {
    console.error('Verification failed:', error);
    toast({
      title: "Verification Failed",
      description: "Identity verification failed. Please try again or contact support.",
      variant: "destructive",
    });
  };

  // When profile is saved, force-step to verification so users don't see profile again
  // This is already done in handleProfileSubmit; ensure it sticks across user refetch
  useEffect(() => {
    if (currentStep === 'verification') {
      forcedStepRef.current = 'verification';
    }
  }, [currentStep]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const validateField = (field: string, value: string) => {
    switch (field) {
      case 'firstName':
        return value.trim() ? '' : 'First name is required';
      case 'lastName':
        return value.trim() ? '' : 'Last name is required';
      case 'phoneNumber':
        const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
        if (!value.trim()) return 'Phone number is required';
        if (!phoneRegex.test(value.replace(/\D/g, ''))) return 'Enter a valid 10-digit phone number';
        return '';
      case 'address1':
        return value.trim() ? '' : 'Street address is required';
      case 'city':
        return value.trim() ? '' : 'City is required';
      case 'state':
        return value.trim() ? '' : 'State is required';
      case 'zipCode':
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!value.trim()) return 'ZIP code is required';
        if (!zipRegex.test(value)) return 'Enter a valid ZIP code (12345 or 12345-6789)';
        return '';
      default:
        return '';
    }
  };

  const validateForm = () => {
    const errors = {
      firstName: validateField('firstName', profileForm.firstName),
      lastName: validateField('lastName', profileForm.lastName),
      phoneNumber: validateField('phoneNumber', profileForm.phoneNumber),
      address1: validateField('address1', profileForm.address1),
      city: validateField('city', profileForm.city),
      state: validateField('state', profileForm.state),
      zipCode: validateField('zipCode', profileForm.zipCode)
    };
    
    setFormErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  const isFormValid = () => {
    return (
      profileForm.firstName.trim() &&
      profileForm.lastName.trim() &&
      profileForm.phoneNumber.trim() &&
      profileForm.address1.trim() &&
      profileForm.city.trim() &&
      profileForm.state.trim() &&
      profileForm.zipCode.trim() &&
      !Object.values(formErrors).some(error => error !== '')
    );
  };

  if (!isOpen) return null;

  // Also don't render if we're on the complete step and user is actually complete
  // This prevents the overlay from being stuck
  if (currentStep === 'complete' && user) {
    const hasBasicInfo = Boolean(user.firstName && user.lastName && (user.phoneNumber || user.phone));
    const hasAddress = Boolean((user.address1 && user.city && user.state && user.zipCode) || user.address);
    const isProfileComplete = hasBasicInfo && hasAddress;
    const isVerified = Boolean(user.isVerified || user.isVerificationBypassed || user.notaryVerificationBypassed || (user as any).verificationStatus === 'approved');
    
    if (isProfileComplete && isVerified) {
      console.log('🚫 Preventing overlay render - user is complete');
      return null;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Complete Account Setup</h2>
                <p className="text-blue-100 text-sm">Required to access signing sessions</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <div className="flex items-center justify-center space-x-8">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === 'profile' ? 'bg-blue-600 text-white' : 
                currentStep === 'verification' || currentStep === 'complete' ? 'bg-green-600 text-white' :
                'bg-gray-300 text-gray-600'
              }`}>
                {currentStep === 'verification' || currentStep === 'complete' ? <CheckCircle className="h-5 w-5" /> : '1'}
              </div>
              <span className={`text-sm font-medium ${
                currentStep === 'profile' ? 'text-blue-600' : 
                currentStep === 'verification' || currentStep === 'complete' ? 'text-blue-600' :
                'text-gray-500'
              }`}>
                Profile Information
              </span>
            </div>
            
            <ArrowRight className="h-4 w-4 text-gray-400" />
            
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                currentStep === 'verification' ? 'bg-blue-600 text-white' : 
                currentStep === 'complete' ? 'bg-green-600 text-white' :
                'bg-gray-300 text-gray-600'
              }`}>
                {currentStep === 'complete' ? <CheckCircle className="h-5 w-5" /> : '2'}
              </div>
              <span className={`text-sm font-medium ${
                currentStep === 'verification' ? 'text-blue-600' : 
                currentStep === 'complete' ? 'text-blue-600' :
                'text-gray-500'
              }`}>
                ID Verification
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {currentStep === 'profile' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Complete Your Profile
                </CardTitle>
                <p className="text-sm text-gray-600">
                  We need this information for identity verification and compliance with notarization regulations.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSubmit} className="space-y-6" onKeyDown={(e) => {
                  // Prevent Enter key from submitting prematurely while typing
                  if ((e.target as HTMLElement).tagName === 'INPUT' && e.key === 'Enter') {
                    e.preventDefault();
                  }
                }}>
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={profileForm.firstName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProfileForm(prev => ({ ...prev, firstName: value }));
                            // Clear error when user starts typing
                            if (formErrors.firstName) {
                              setFormErrors(prev => ({ ...prev, firstName: '' }));
                            }
                          }}
                          onBlur={(e) => {
                            const error = validateField('firstName', e.target.value);
                            setFormErrors(prev => ({ ...prev, firstName: error }));
                          }}
                          placeholder="Enter your first name"
                          className={formErrors.firstName ? 'border-red-500' : ''}
                          required
                        />
                        {formErrors.firstName && (
                          <p className="text-sm text-red-600">{formErrors.firstName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={profileForm.lastName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProfileForm(prev => ({ ...prev, lastName: value }));
                            if (formErrors.lastName) {
                              setFormErrors(prev => ({ ...prev, lastName: '' }));
                            }
                          }}
                          onBlur={(e) => {
                            const error = validateField('lastName', e.target.value);
                            setFormErrors(prev => ({ ...prev, lastName: error }));
                          }}
                          placeholder="Enter your last name"
                          className={formErrors.lastName ? 'border-red-500' : ''}
                          required
                        />
                        {formErrors.lastName && (
                          <p className="text-sm text-red-600">{formErrors.lastName}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber">Phone Number *</Label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        value={profileForm.phoneNumber}
                        onChange={(e) => {
                          const value = e.target.value;
                          setProfileForm(prev => ({ ...prev, phoneNumber: value }));
                          if (formErrors.phoneNumber) {
                            setFormErrors(prev => ({ ...prev, phoneNumber: '' }));
                          }
                        }}
                        onBlur={(e) => {
                          const error = validateField('phoneNumber', e.target.value);
                          setFormErrors(prev => ({ ...prev, phoneNumber: error }));
                        }}
                        placeholder="(555) 123-4567"
                        className={formErrors.phoneNumber ? 'border-red-500' : ''}
                        required
                      />
                      {formErrors.phoneNumber && (
                        <p className="text-sm text-red-600">{formErrors.phoneNumber}</p>
                      )}
                    </div>
                  </div>

                  {/* Address Information */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Address Information
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="address1">Address Line 1 *</Label>
                        <Input
                          id="address1"
                          value={profileForm.address1}
                          onChange={(e) => {
                            const value = e.target.value;
                            setProfileForm(prev => ({ ...prev, address1: value }));
                            if (formErrors.address1) {
                              setFormErrors(prev => ({ ...prev, address1: '' }));
                            }
                          }}
                          onBlur={(e) => {
                            const error = validateField('address1', e.target.value);
                            setFormErrors(prev => ({ ...prev, address1: error }));
                          }}
                          placeholder="Street address"
                          className={formErrors.address1 ? 'border-red-500' : ''}
                          required
                        />
                        {formErrors.address1 && (
                          <p className="text-sm text-red-600">{formErrors.address1}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address2">Address Line 2</Label>
                        <Input
                          id="address2"
                          value={profileForm.address2}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, address2: e.target.value }))}
                          placeholder="Apartment, suite, unit, etc. (optional)"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="city">City *</Label>
                          <Input
                            id="city"
                            value={profileForm.city}
                            onChange={(e) => {
                              const value = e.target.value;
                              setProfileForm(prev => ({ ...prev, city: value }));
                              if (formErrors.city) {
                                setFormErrors(prev => ({ ...prev, city: '' }));
                              }
                            }}
                            onBlur={(e) => {
                              const error = validateField('city', e.target.value);
                              setFormErrors(prev => ({ ...prev, city: error }));
                            }}
                            placeholder="City"
                            className={formErrors.city ? 'border-red-500' : ''}
                            required
                          />
                          {formErrors.city && (
                            <p className="text-sm text-red-600">{formErrors.city}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State *</Label>
                          <Input
                            id="state"
                            value={profileForm.state}
                            onChange={(e) => {
                              const value = e.target.value;
                              setProfileForm(prev => ({ ...prev, state: value }));
                              if (formErrors.state) {
                                setFormErrors(prev => ({ ...prev, state: '' }));
                              }
                            }}
                            onBlur={(e) => {
                              const error = validateField('state', e.target.value);
                              setFormErrors(prev => ({ ...prev, state: error }));
                            }}
                            placeholder="State"
                            className={formErrors.state ? 'border-red-500' : ''}
                            required
                          />
                          {formErrors.state && (
                            <p className="text-sm text-red-600">{formErrors.state}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="zipCode">ZIP Code *</Label>
                          <Input
                            id="zipCode"
                            value={profileForm.zipCode}
                            onChange={(e) => {
                              const value = e.target.value;
                              setProfileForm(prev => ({ ...prev, zipCode: value }));
                              if (formErrors.zipCode) {
                                setFormErrors(prev => ({ ...prev, zipCode: '' }));
                              }
                            }}
                            onBlur={(e) => {
                              const error = validateField('zipCode', e.target.value);
                              setFormErrors(prev => ({ ...prev, zipCode: error }));
                            }}
                            placeholder="ZIP Code"
                            className={formErrors.zipCode ? 'border-red-500' : ''}
                            required
                          />
                          {formErrors.zipCode && (
                            <p className="text-sm text-red-600">{formErrors.zipCode}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={!isFormValid() || isSubmitting}
                      className="w-full md:w-auto"
                    >
                      {isSubmitting ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Continue to Verification
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {currentStep === 'verification' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  Identity Verification
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Complete identity verification to access document signing sessions.
                </p>
              </CardHeader>
              <CardContent>
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Camera className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900 mb-1">What You'll Need</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• A government-issued photo ID (driver's license, passport, or state ID)</li>
                        <li>• A device with a camera (smartphone or computer)</li>
                        <li>• Good lighting for clear photos</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <EVSVerification
                  userId={user?.id || 0}
                  onVerificationComplete={handleVerificationComplete}
                  onVerificationFailed={handleVerificationFailed}
                />

                {/* Optional: Signature setup after verification (inline lightweight manager) */}
                <div className="mt-6">
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-700">
                      After your ID is verified, you can create your digital signature from your profile page. We’ll take you there automatically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 'complete' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <CheckCircle className="h-5 w-5" />
                  Account Setup Complete!
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Welcome to Digital Notarization!
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Your account is now fully set up and verified. You can now participate in document signing sessions.
                  </p>
                  <Button 
                    onClick={async () => {
                      console.log('✅ Continue to Dashboard clicked');
                      // Force close the overlay by calling onComplete
                      // This should trigger the parent to hide the overlay
                      onComplete();
                      
                      // Force a page reload after a short delay to ensure fresh data
                      setTimeout(() => {
                        window.location.reload();
                      }, 100);
                    }} 
                    className="w-full md:w-auto"
                  >
                    Continue to Dashboard
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer Warning */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span>This information is required by law for notarization services and cannot be skipped.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-gray-600 hover:text-gray-800"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Continue Later
            </Button>
            

          </div>
        </div>
      </div>
    </div>
  );
}
