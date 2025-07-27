import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, FileText, Shield, Building2, ArrowRight } from 'lucide-react';

type SignupType = 'client' | 'notary' | 'company';

interface SignupContent {
  icon: React.ReactNode;
  title: string;
  description: string;
  nextSteps: string[];
  actionButton: {
    text: string;
    path: string;
  };
  bgColor: string;
  iconBg: string;
  buttonColor: string;
}

const signupContent: Record<SignupType, SignupContent> = {
  client: {
    icon: <FileText className="h-8 w-8 text-blue-600" />,
    title: "Welcome to Sharp Note!",
    description: "Your account has been created successfully. You can now start getting your documents notarized quickly and securely.",
    nextSteps: [
      "Complete your profile with address information",
      "Upload documents for notarization",
      "Schedule a session with a certified notary",
      "Complete your notarization online"
    ],
    actionButton: {
      text: "Get Started",
      path: "/login"
    },
    bgColor: "from-blue-50 to-white",
    iconBg: "bg-blue-100",
    buttonColor: "bg-blue-600 hover:bg-blue-700"
  },
  notary: {
    icon: <Shield className="h-8 w-8 text-green-600" />,
    title: "Notary Application Submitted!",
    description: "Thank you for applying to join our notary network. Your application is under review by our admin team.",
    nextSteps: [
      "Admin review of your credentials and experience",
      "Verification of your notary commission",
      "Background check and compliance verification",
      "Email notification once approved",
      "Access to notary dashboard and job assignments"
    ],
    actionButton: {
      text: "Check Application Status",
      path: "/login"
    },
    bgColor: "from-green-50 to-white",
    iconBg: "bg-green-100",
    buttonColor: "bg-green-600 hover:bg-green-700"
  },
  company: {
    icon: <Building2 className="h-8 w-8 text-purple-600" />,
    title: "Company Registration Submitted!",
    description: "Your title company has been registered and is pending admin approval. We'll review your information and get you set up soon.",
    nextSteps: [
      "Admin review of company information",
      "Verification of business credentials",
      "Setup of company account and billing",
      "Email notification to primary manager once approved",
      "Access to company dashboard and team management"
    ],
    actionButton: {
      text: "Access Manager Account",
      path: "/login"
    },
    bgColor: "from-purple-50 to-white",
    iconBg: "bg-purple-100",
    buttonColor: "bg-purple-600 hover:bg-purple-700"
  }
};

export default function SignupSuccess() {
  const [, setLocation] = useLocation();
  const [signupType, setSignupType] = useState<SignupType>('client');

  useEffect(() => {
    // Get signup type from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') as SignupType;
    if (type && ['client', 'notary', 'company'].includes(type)) {
      setSignupType(type);
    }
  }, []);

  const content = signupContent[signupType];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${content.bgColor} flex items-center justify-center p-4`}>
      <div className="w-full max-w-2xl">
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-6">
            <div className={`mx-auto mb-4 p-3 ${content.iconBg} rounded-full w-20 h-20 flex items-center justify-center`}>
              <CheckCircle className="h-12 w-12 text-green-500 absolute" />
              <div className="ml-8 mt-8">
                {content.icon}
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
              {content.title}
            </CardTitle>
            <CardDescription className="text-lg text-gray-600 max-w-lg mx-auto">
              {content.description}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What happens next?</h3>
              <div className="space-y-3">
                {content.nextSteps.map((step, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600 mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-gray-700">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {signupType === 'notary' || signupType === 'company' ? (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-amber-800">Approval Required</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Your account is pending admin approval. You'll receive an email notification once your application has been reviewed and approved.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => setLocation(content.actionButton.path)}
                className={`flex-1 ${content.buttonColor} text-white`}
              >
                {content.actionButton.text}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => setLocation('/')}
                className="flex-1"
              >
                Back to Home
              </Button>
            </div>

            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Need help?{' '}
                <a href="mailto:support@sharpnote.com" className="text-blue-600 hover:text-blue-700 font-medium">
                  Contact our support team
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 