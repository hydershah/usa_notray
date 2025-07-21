import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Brain, CheckCircle } from 'lucide-react';
import { KBAPopup } from '@/components/verification/KBAPopup';

interface JobCreationWithKBAProps {
  userId: number;
  userInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    ssn?: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
    };
    phone?: string;
    email: string;
  };
}

export function JobCreationWithKBA({ userId, userInfo }: JobCreationWithKBAProps) {
  const [kbaRequired, setKbaRequired] = useState<string>('');
  const [kbaCompleted, setKbaCompleted] = useState(false);
  const [showKbaPopup, setShowKbaPopup] = useState(false);
  const [jobData, setJobData] = useState({
    title: '',
    description: '',
    // ... other job fields
  });

  const handleKbaSelection = (value: string) => {
    setKbaRequired(value);
    
    if (value === 'yes') {
      // Show KBA popup immediately when user selects "Yes"
      setShowKbaPopup(true);
    } else {
      setKbaCompleted(false);
    }
  };

  const handleKbaSuccess = () => {
    setKbaCompleted(true);
    setShowKbaPopup(false);
    // KBA verification successful - user can now proceed
  };

  const handleKbaClose = () => {
    setShowKbaPopup(false);
    // If user closes popup without completing KBA, reset the selection
    if (!kbaCompleted) {
      setKbaRequired('');
    }
  };

  const canSubmitJob = () => {
    // Job can only be submitted if:
    // 1. KBA is not required (user selected "no"), OR
    // 2. KBA is required and completed successfully
    return kbaRequired === 'no' || (kbaRequired === 'yes' && kbaCompleted);
  };

  const handleSubmitJob = async () => {
    if (!canSubmitJob()) return;

    try {
      // Submit job with KBA status
      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...jobData,
          kbaRequired: kbaRequired === 'yes',
          kbaCompleted,
          userId
        })
      });

      if (response.ok) {
        // Job created successfully
        console.log('Job created with KBA status:', { kbaRequired, kbaCompleted });
      }
    } catch (error) {
      console.error('Job creation error:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Notary Job</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Job basic info fields would go here */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Job Title</Label>
              <input
                id="title"
                className="w-full p-2 border rounded"
                value={jobData.title}
                onChange={(e) => setJobData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter job title..."
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                className="w-full p-2 border rounded h-24"
                value={jobData.description}
                onChange={(e) => setJobData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter job description..."
              />
            </div>
          </div>

          {/* KBA Requirement Section */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-blue-600" />
                Knowledge-Based Authentication (KBA)
              </CardTitle>
              <p className="text-sm text-gray-600">
                Do you want to require KBA verification for this notary session?
              </p>
            </CardHeader>
            <CardContent>
              <RadioGroup value={kbaRequired} onValueChange={handleKbaSelection}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="kba-yes" />
                  <Label htmlFor="kba-yes" className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    Yes, require KBA verification (Recommended for high-security documents)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="kba-no" />
                  <Label htmlFor="kba-no">
                    No, skip KBA verification
                  </Label>
                </div>
              </RadioGroup>

              {/* KBA Status Display */}
              {kbaRequired === 'yes' && (
                <div className="mt-4">
                  {kbaCompleted ? (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        <strong>KBA Verification Completed!</strong> 
                        <br />
                        You have successfully completed the knowledge-based authentication.
                        The notary session will require participants to complete KBA verification.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="border-orange-200 bg-orange-50">
                      <Brain className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-orange-800">
                        <strong>KBA Verification Required</strong>
                        <br />
                        You need to complete KBA verification to proceed with creating this job.
                        <Button
                          onClick={() => setShowKbaPopup(true)}
                          className="mt-2 bg-blue-600 hover:bg-blue-700"
                          size="sm"
                        >
                          Start KBA Verification
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSubmitJob}
              disabled={!canSubmitJob()}
              className="px-8"
            >
              {kbaRequired === 'yes' && !kbaCompleted ? (
                <>Complete KBA First</>
              ) : (
                <>Create Job</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KBA Popup */}
      <KBAPopup
        isOpen={showKbaPopup}
        onClose={handleKbaClose}
        userId={userId}
        userInfo={userInfo}
        onSuccess={handleKbaSuccess}
      />
    </div>
  );
}

export default JobCreationWithKBA; 