import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  UserCheck, 
  User, 
  Hash, 
  Search, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  Clock,
  FileText,
  Mail,
  Calendar,
  MapPin,
  AlertCircle,
  Sparkles,
  Shield,
  Zap,
  Target,
  Star,
  Award,
  TrendingUp,
  Users,
  Settings,
  CheckSquare,
  X
} from 'lucide-react';

interface JobRequest {
  id: number;
  title: string;
  description: string;
  documentType: string;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  preferredDate?: string;
  preferredTime?: string;
  location?: string;
  requestorId: number;
  requestorEmail: string;
  requestorPhone?: string;
  requestorName?: string;
  status: string;
  documents?: Array<{
    id: number;
    name: string;
    url: string;
    uploadedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface Notary {
  id: number;
  name: string;
  email: string;
  status: string;
}

interface ProfessionalAssignmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  jobRequest: JobRequest | null;
  notaries: Notary[];
  currentUser: any;
  onAssign: (assignmentData: any) => Promise<void>;
  isAdminAvailableAsNotary: boolean;
}

const steps = [
  { 
    id: 1, 
    title: 'Assignment Method', 
    description: 'Choose how to assign the notary',
    icon: Settings,
    color: 'blue'
  },
  { 
    id: 2, 
    title: 'Notary Selection', 
    description: 'Select specific notary or use auto-assignment',
    icon: Users,
    color: 'green'
  },
  { 
    id: 3, 
    title: 'Schedule & Details', 
    description: 'Set appointment details and notes',
    icon: Calendar,
    color: 'purple'
  },
  { 
    id: 4, 
    title: 'Review & Confirm', 
    description: 'Review assignment and confirm',
    icon: CheckSquare,
    color: 'orange'
  },
];

export function ProfessionalAssignmentWizard({
  isOpen,
  onClose,
  jobRequest,
  notaries,
  currentUser,
  onAssign,
  isAdminAvailableAsNotary
}: ProfessionalAssignmentWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [assignmentMethod, setAssignmentMethod] = useState<'admin_self' | 'assign' | 'auto' | 'id_code'>('assign');
  const [selectedNotaryId, setSelectedNotaryId] = useState('');
  const [notaryCode, setNotaryCode] = useState('');
  const [notaryCodeResult, setNotaryCodeResult] = useState<any>(null);
  const [notaryCodeLoading, setNotaryCodeLoading] = useState(false);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      resetForm();
      // Trigger entrance animation
      setTimeout(() => setAnimateIn(true), 100);
    } else {
      setAnimateIn(false);
    }
  }, [isOpen]);

  const resetForm = () => {
    setAssignmentMethod('assign');
    setSelectedNotaryId('');
    setNotaryCode('');
    setNotaryCodeResult(null);
    setAssignmentNotes('');
    setPreferredDate('');
    setPreferredTime('');
    setLocation('');
  };

  const lookupNotaryByCode = async (code: string) => {
    if (!code.trim()) return;
    
    setNotaryCodeLoading(true);
    try {
      const response = await fetch(`/api/notaries/lookup/${code}`);
      if (response.ok) {
        const result = await response.json();
        setNotaryCodeResult(result);
        toast.success(`Found notary: ${result.firstName} ${result.lastName}`);
      } else {
        setNotaryCodeResult(null);
        toast.error("No notary found with this ID code");
      }
    } catch (error) {
      console.error('Error looking up notary:', error);
      toast.error("Failed to look up notary. Please try again.");
    } finally {
      setNotaryCodeLoading(false);
    }
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return assignmentMethod === 'assign' || assignmentMethod === 'admin_self' || assignmentMethod === 'auto' || assignmentMethod === 'id_code';
      case 2:
        if (assignmentMethod === 'assign') return selectedNotaryId !== '';
        if (assignmentMethod === 'id_code') return notaryCodeResult !== null;
        return true; // auto and admin_self don't need additional selection
      case 3:
        return true; // All fields are optional in step 3
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (canProceedToNextStep()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!jobRequest) return;

    setIsSubmitting(true);
    try {
      let assignedNotaryId: number | undefined;
      let assignmentType = 'manual';

      switch (assignmentMethod) {
        case 'admin_self':
          assignedNotaryId = currentUser?.id;
          assignmentType = 'admin_self';
          break;
        case 'assign':
          assignedNotaryId = parseInt(selectedNotaryId);
          assignmentType = 'manual';
          break;
        case 'auto':
          assignmentType = 'auto';
          break;
        case 'id_code':
          assignedNotaryId = notaryCodeResult?.id;
          assignmentType = 'id_code';
          break;
      }

      const assignmentData = {
        action: 'assign',
        assignedNotaryId,
        assignmentNotes,
        assignmentType,
        preferredDate,
        preferredTime,
        location
      };

      await onAssign(assignmentData);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Assignment error:', error);
      toast.error("Failed to assign the job request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return 'completed';
    if (stepId === currentStep) return 'current';
    return 'pending';
  };

  const getStepIcon = (stepId: number) => {
    const step = steps.find(s => s.id === stepId);
    const status = getStepStatus(stepId);
    const IconComponent = step?.icon || CheckCircle;
    
    switch (status) {
      case 'completed':
        return (
          <div className="relative">
            <div className="h-10 w-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white shadow-lg">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-white rounded-full flex items-center justify-center">
              <CheckCircle className="h-3 w-3 text-green-600" />
            </div>
          </div>
        );
      case 'current':
        return (
          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white shadow-lg animate-pulse">
            <IconComponent className="h-5 w-5" />
          </div>
        );
      default:
        return (
          <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
            <IconComponent className="h-5 w-5" />
          </div>
        );
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Enhanced Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Settings className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">Assignment Method</h3>
                  <p className="text-sm text-blue-700">
                    Choose how you want to assign this job request to a notary. Each method has different benefits and use cases.
                  </p>
                </div>
              </div>
            </div>

            <RadioGroup value={assignmentMethod} onValueChange={(value: any) => setAssignmentMethod(value)}>
              {/* Assign Myself as Notary */}
                              {isAdminAvailableAsNotary && (
                 <div className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                   assignmentMethod === 'admin_self' 
                     ? 'border-blue-500 bg-blue-50' 
                     : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                 }`}>
                   <div className="flex items-center space-x-3">
                     <RadioGroupItem value="admin_self" id="admin_self" />
                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2 mb-1">
                         <Shield className="h-4 w-4 text-blue-600" />
                         <Label htmlFor="admin_self" className="text-sm font-medium text-gray-900 cursor-pointer">
                           Assign Myself as Notary
                         </Label>
                       </div>
                     </div>
                   </div>
                 </div>
               )}

              {/* Assign Specific Notary */}
                            <div className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                assignmentMethod === 'assign' 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="assign" id="assign" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="h-4 w-4 text-green-600" />
                      <Label htmlFor="assign" className="text-sm font-medium text-gray-900 cursor-pointer">
                        Assign Specific Notary
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto Assignment */}
                            <div className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                assignmentMethod === 'auto' 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="auto" id="auto" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-purple-600" />
                      <Label htmlFor="auto" className="text-sm font-medium text-gray-900 cursor-pointer">
                        Auto Assignment
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notary ID Code Assignment */}
                            <div className={`p-3 border rounded-lg transition-colors cursor-pointer ${
                assignmentMethod === 'id_code' 
                  ? 'border-orange-500 bg-orange-50' 
                  : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="id_code" id="id_code" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Hash className="h-4 w-4 text-orange-600" />
                      <Label htmlFor="id_code" className="text-sm font-medium text-gray-900 cursor-pointer">
                        Enter Notary ID Code
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {/* Enhanced Header Section */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-900">Notary Selection</h3>
                  <p className="text-sm text-green-700">
                    {assignmentMethod === 'assign' && 'Select the specific notary you want to assign to this job.'}
                    {assignmentMethod === 'id_code' && 'Enter the notary ID code to look up and assign a specific notary.'}
                    {assignmentMethod === 'auto' && 'The system will automatically select the best available notary based on availability and expertise.'}
                    {assignmentMethod === 'admin_self' && 'You will be assigned as the notary for this job.'}
                  </p>
                </div>
              </div>
            </div>

            {assignmentMethod === 'assign' && (
              <div className="space-y-4">
                <Label className="text-sm font-medium mb-2 block">Select Notary</Label>
                <Select value={selectedNotaryId} onValueChange={setSelectedNotaryId}>
                  <SelectTrigger className="h-12 border-2 hover:border-green-300 focus:border-green-500 transition-colors">
                    <SelectValue placeholder="Choose an available notary" />
                  </SelectTrigger>
                  <SelectContent>
                    {notaries.length === 0 && !isAdminAvailableAsNotary ? (
                      <SelectItem value="" disabled>
                        <div className="flex items-center gap-2 text-gray-500">
                          <AlertCircle className="h-4 w-4" />
                          No available notaries found
                        </div>
                      </SelectItem>
                    ) : (
                      <>
                        {isAdminAvailableAsNotary && (
                          <SelectItem value={currentUser.id.toString()}>
                            <div className="flex items-center gap-3 p-2">
                              <div className="p-2 bg-blue-100 rounded-full">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{currentUser.firstName} {currentUser.lastName} (You)</div>
                                <div className="text-xs text-gray-500">{currentUser.email}</div>
                                <Badge className="mt-1 bg-blue-100 text-blue-700 text-xs">Admin</Badge>
                              </div>
                            </div>
                          </SelectItem>
                        )}
                        {notaries.map((notary) => (
                          <SelectItem key={notary.id} value={notary.id.toString()}>
                            <div className="flex items-center gap-3 p-2">
                              <div className="p-2 bg-green-100 rounded-full">
                                <User className="h-4 w-4 text-green-600" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{notary.name}</div>
                                <div className="text-xs text-gray-500">{notary.email}</div>
                                <Badge className="mt-1 bg-green-100 text-green-700 text-xs">Contractor</Badge>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {assignmentMethod === 'id_code' && (
              <div className="space-y-4">
                <Label className="text-sm font-medium mb-2 block">Notary ID Code</Label>
                <div className="flex gap-3">
                  <Input
                    value={notaryCode}
                    onChange={(e) => setNotaryCode(e.target.value)}
                    placeholder="Enter notary ID code (e.g., CY0123)"
                    className="h-12 border-2 hover:border-orange-300 focus:border-orange-500 transition-colors"
                  />
                  <Button
                    onClick={() => lookupNotaryByCode(notaryCode)}
                    disabled={!notaryCode || notaryCodeLoading}
                    variant="outline"
                    className="h-12 px-6 border-2 hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    {notaryCodeLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {notaryCodeResult && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-full">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-800">
                          {notaryCodeResult.firstName} {notaryCodeResult.lastName}
                        </p>
                        <p className="text-xs text-green-600">{notaryCodeResult.email}</p>
                        <Badge className="mt-1 bg-green-100 text-green-700 text-xs">Verified Notary</Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(assignmentMethod === 'auto' || assignmentMethod === 'admin_self') && (
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-full">
                    <CheckCircle className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-purple-900">
                      {assignmentMethod === 'auto' ? 'Auto Assignment Selected' : 'Self Assignment Selected'}
                    </p>
                    <p className="text-sm text-purple-700 mt-1">
                      {assignmentMethod === 'auto' 
                        ? 'The system will automatically assign the best available notary based on availability, expertise, and location.'
                        : 'You will be assigned as the notary for this job with full administrative control.'
                      }
                    </p>
                    <Badge className="mt-2 bg-purple-100 text-purple-700 border-purple-200">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {assignmentMethod === 'auto' ? 'Smart Assignment' : 'Admin Control'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            {/* Enhanced Header Section */}
            <div className="bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-purple-900">Schedule & Details</h3>
                  <p className="text-sm text-purple-700">
                    Set appointment details and provide any specific instructions for the assigned notary.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  Preferred Date
                </Label>
                <Input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  placeholder="Select preferred date"
                  className="h-12 border-2 hover:border-purple-300 focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-600" />
                  Preferred Time
                </Label>
                <Input
                  type="time"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  placeholder="Select preferred time"
                  className="h-12 border-2 hover:border-purple-300 focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <MapPin className="h-4 w-4 text-purple-600" />
                Location
              </Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter meeting location or 'Virtual' for online notarization"
                className="h-12 border-2 hover:border-purple-300 focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium mb-2 block flex items-center gap-2">
                <FileText className="h-4 w-4 text-purple-600" />
                Assignment Notes
              </Label>
              <Textarea
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="Provide specific instructions, special requirements, or notes for the assigned notary..."
                rows={4}
                className="border-2 hover:border-purple-300 focus:border-purple-500 transition-colors resize-none"
              />
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                These notes will be visible to the assigned notary and included in the assignment notification.
              </p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {/* Enhanced Header Section */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <CheckSquare className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-orange-900">Review & Confirm</h3>
                  <p className="text-sm text-orange-700">
                    Review all assignment details before confirming. You can go back to make changes if needed.
                  </p>
                </div>
              </div>
            </div>

            {/* Job Request Summary */}
            {jobRequest && (
              <Card className="border-2 border-gray-200 hover:border-gray-300 transition-colors">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-gray-600" />
                    Job Request Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Title:</span>
                      <span className="text-gray-900">{jobRequest.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Type:</span>
                      <Badge variant="outline" className="text-xs">{jobRequest.documentType}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Requestor:</span>
                      <span className="text-gray-900">{jobRequest.requestorName || jobRequest.requestorEmail}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Urgency:</span>
                      <Badge 
                        className={`ml-2 text-xs ${
                          jobRequest.urgency === 'urgent' ? 'bg-red-100 text-red-700 border-red-200' :
                          jobRequest.urgency === 'high' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          jobRequest.urgency === 'normal' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {jobRequest.urgency.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium text-gray-700">Description:</span>
                      <p className="text-gray-900 mt-1">{jobRequest.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Assignment Summary */}
            <Card className="border-2 border-blue-200 hover:border-blue-300 transition-colors">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-600" />
                  Assignment Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Assignment Method:</span>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      {assignmentMethod === 'admin_self' ? 'Self Assignment' :
                       assignmentMethod === 'assign' ? 'Specific Notary' :
                       assignmentMethod === 'auto' ? 'Auto Assignment' : 'ID Code'}
                    </Badge>
                  </div>
                  
                  {assignmentMethod === 'admin_self' && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Assigned Notary:</span>
                      <span className="text-gray-900">{currentUser?.firstName} {currentUser?.lastName} (You)</span>
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Admin</Badge>
                    </div>
                  )}
                  
                  {assignmentMethod === 'assign' && selectedNotaryId && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Assigned Notary:</span>
                      <span className="text-gray-900">{
                        selectedNotaryId === currentUser?.id?.toString() 
                          ? `${currentUser.firstName} ${currentUser.lastName} (You)`
                          : notaries.find(n => n.id.toString() === selectedNotaryId)?.name
                      }</span>
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Contractor</Badge>
                    </div>
                  )}
                  
                  {assignmentMethod === 'id_code' && notaryCodeResult && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Assigned Notary:</span>
                      <span className="text-gray-900">{notaryCodeResult.firstName} {notaryCodeResult.lastName}</span>
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">Verified</Badge>
                    </div>
                  )}
                  
                  {assignmentMethod === 'auto' && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-700">Assignment:</span>
                      <span className="text-gray-900">System will automatically select the best available notary</span>
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Smart Match</Badge>
                    </div>
                  )}

                  {preferredDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-700">Preferred Date:</span>
                      <span className="text-gray-900">{preferredDate}</span>
                    </div>
                  )}

                  {preferredTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-700">Preferred Time:</span>
                      <span className="text-gray-900">{preferredTime}</span>
                    </div>
                  )}

                  {location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-700">Location:</span>
                      <span className="text-gray-900">{location}</span>
                    </div>
                  )}

                  {assignmentNotes && (
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-gray-500 mt-1" />
                      <div>
                        <span className="font-medium text-gray-700">Notes:</span>
                        <p className="text-gray-900 mt-1">{assignmentNotes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-500 ${
        animateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}>
        {/* Enhanced Header */}
        <div className="flex-shrink-0 pb-6 border-b bg-gradient-to-r from-gray-50 to-gray-100">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                  <UserCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-gray-900">Assign Job Request</DialogTitle>
                  <DialogDescription>
                    Follow the steps below to assign this job request to a notary
                  </DialogDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 hover:bg-gray-100 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        {/* Enhanced Progress Steps */}
        <div className="flex-shrink-0 py-6 border-b bg-white">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center">
                  {getStepIcon(step.id)}
                  <div className="ml-4">
                    <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="mx-6 h-px bg-gradient-to-r from-gray-300 to-gray-200 w-12" />
                )}
              </div>
            ))}
          </div>
          
          {/* Enhanced Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Step {currentStep} of {steps.length}</span>
            <span>{Math.round((currentStep / steps.length) * 100)}% Complete</span>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-6 px-2">
          <div className={`transition-all duration-300 ${animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {renderStepContent()}
          </div>
        </div>

        {/* Enhanced Navigation Buttons */}
        <div className="flex-shrink-0 pt-6 border-t bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? onClose : handlePrevious}
              disabled={isSubmitting}
              className="px-6 py-3 border-2 hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {currentStep === 1 ? 'Cancel' : 'Previous'}
            </Button>

            <div className="flex gap-3">
              {currentStep < steps.length ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceedToNextStep() || isSubmitting}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Assign to Notary
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 