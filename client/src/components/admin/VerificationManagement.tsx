import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { 
  Search, 
  Filter, 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  FileText, 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Eye,
  SkipForward,
  RotateCcw,
  History,
  Download,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface VerificationUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  role: string;
  phone_number: string;
  is_verified: boolean;
  verification_status: 'pending' | 'approved' | 'denied' | 'review';
  is_verification_bypassed: boolean;
  verification_bypassed_at: string | null;
  verification_bypass_reason: string | null;
  bypassed_by_admin: string | null;
  evs_transaction_id: string | null;
  evs_verification_confidence: number | null;
  evs_verified_at: string | null;
  evs_extracted_first_name: string | null;
  evs_extracted_last_name: string | null;
  evs_extracted_date_of_birth: string | null;
  id_type: string | null;
  id_number: string | null;
  id_expiration_date: string | null;
  evs_face_match_result: boolean | null;
  evs_face_match_confidence: number | null;
  evs_liveness_score: number | null;
  verification_retry_count: number;
  total_verification_attempts: number;
  latest_verification_attempt: string | null;
  last_login_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface VerificationAttempt {
  id: number;
  attemptNumber: number;
  evsTransactionId: string;
  status: string;
  confidenceScore: number;
  documentType: string;
  frontImageUploaded: boolean;
  backImageUploaded: boolean;
  selfieUploaded: boolean;
  extractedFirstName: string;
  extractedLastName: string;
  extractedDateOfBirth: string;
  faceMatchResult: boolean;
  faceMatchConfidence: number;
  livenessScore: number;
  errors: string[];
  warnings: string[];
  attemptedAt: string;
  processingTimeMs: number;
}

export function VerificationManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<VerificationUser | null>(null);
  const [bypassReason, setBypassReason] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const queryClient = useQueryClient();

  // Fetch users requiring verification
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['/api/admin/verification-users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/verification-users');
      return response.json();
    },
  });

  // Fetch verification attempts for selected user
  const { data: verificationAttempts = [] } = useQuery({
    queryKey: ['/api/admin/verification-attempts', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return [];
      const response = await apiRequest('GET', `/api/admin/verification-attempts/${selectedUser.id}`);
      return response.json();
    },
    enabled: !!selectedUser,
  });

  // Bypass verification mutation
  const bypassVerificationMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
      const response = await apiRequest('POST', `/api/admin/bypass-verification/${userId}`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/verification-users'] });
      toast({
        title: "Success",
        description: "Verification bypassed successfully.",
      });
      setBypassReason('');
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to bypass verification.",
      });
    },
  });

  // Remove bypass mutation
  const removeBypassMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
      const response = await apiRequest('POST', `/api/admin/remove-bypass/${userId}`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/verification-users'] });
      toast({
        title: "Success",
        description: "Verification bypass removed successfully.",
      });
      setBypassReason('');
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove verification bypass.",
      });
    },
  });

  // Filter users based on search and filters
  const filteredUsers = users.filter((user: VerificationUser) => {
    const displayName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username;
    const matchesSearch = 
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'verified' && user.is_verified) ||
      (statusFilter === 'pending' && !user.is_verified && user.verification_status === 'pending') ||
      (statusFilter === 'bypassed' && user.is_verification_bypassed) ||
      (statusFilter === 'denied' && user.verification_status === 'denied') ||
      (statusFilter === 'review' && user.verification_status === 'review');
    
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  const getStatusBadge = (user: VerificationUser) => {
    if (user.is_verification_bypassed) {
      return (
        <Badge className="bg-purple-100 text-purple-800 border-purple-300">
          <Shield className="w-3 h-3 mr-1" />
          Bypassed
        </Badge>
      );
    }
    
    if (user.is_verified) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Verified
        </Badge>
      );
    }
    
    switch (user.verification_status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'denied':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <XCircle className="w-3 h-3 mr-1" />
            Denied
          </Badge>
        );
      case 'review':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Review
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-300">
            <AlertCircle className="w-3 h-3 mr-1" />
            Unknown
          </Badge>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      notary: 'bg-blue-100 text-blue-800',
      signer: 'bg-green-100 text-green-800',
      witness: 'bg-purple-100 text-purple-800',
    };
    
    return (
      <Badge className={colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleBypassVerification = () => {
    if (!selectedUser || !bypassReason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a reason for bypassing verification.",
      });
      return;
    }
    
    bypassVerificationMutation.mutate({
      userId: selectedUser.id,
      reason: bypassReason.trim()
    });
  };

  const handleRemoveBypass = () => {
    if (!selectedUser || !bypassReason.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a reason for removing the bypass.",
      });
      return;
    }
    
    removeBypassMutation.mutate({
      userId: selectedUser.id,
      reason: bypassReason.trim()
    });
  };

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            Error loading verification data: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KYC/KBA Verification Management</h1>
          <p className="text-gray-600">Manage identity verification for notaries, signers, and witnesses</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {filteredUsers.length} Users
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, email, or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="bypassed">Bypassed</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
                <SelectItem value="review">Under Review</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="notary">Notary</SelectItem>
                <SelectItem value="signer">Signer</SelectItem>
                <SelectItem value="witness">Witness</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">Loading verification data...</div>
            </CardContent>
          </Card>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-500">
                No users found matching your criteria.
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredUsers.map((user: VerificationUser) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* User Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold text-lg">
                        {user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}
                      </h3>
                      {getRoleBadge(user.role)}
                      {getStatusBadge(user)}
                      {!user.is_active && (
                        <Badge variant="destructive">Inactive</Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {user.email}
                      </div>
                      {user.phone_number && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {user.phone_number}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                      </div>
                    </div>
                    
                    {/* Verification Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      {user.evs_transaction_id && (
                        <div>
                          <span className="font-medium">Transaction ID:</span>
                          <br />
                          <code className="text-xs bg-gray-100 px-1 rounded">{user.evs_transaction_id}</code>
                        </div>
                      )}
                      
                      {user.evs_verification_confidence && (
                        <div>
                          <span className="font-medium">Confidence:</span>
                          <br />
                          <span className={`font-semibold ${getConfidenceColor(user.evs_verification_confidence)}`}>
                            {user.evs_verification_confidence}%
                          </span>
                        </div>
                      )}
                      
                      {user.total_verification_attempts > 0 && (
                        <div>
                          <span className="font-medium">Attempts:</span>
                          <br />
                          <span>{user.total_verification_attempts}</span>
                        </div>
                      )}
                      
                      {user.latest_verification_attempt && (
                        <div>
                          <span className="font-medium">Last Attempt:</span>
                          <br />
                          <span>{new Date(user.latest_verification_attempt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Bypass Info */}
                    {user.is_verification_bypassed && (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-purple-800 font-medium mb-1">
                          <Shield className="w-4 h-4" />
                          Verification Bypassed
                        </div>
                        <div className="text-sm text-purple-700">
                          <div>By: {user.bypassed_by_admin}</div>
                          <div>Date: {user.verification_bypassed_at ? new Date(user.verification_bypassed_at).toLocaleString() : 'Unknown'}</div>
                          {user.verification_bypass_reason && (
                            <div>Reason: {user.verification_bypass_reason}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                                    {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" onClick={() => setSelectedUser(user)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Verification Details - {user.full_name || user.username}</DialogTitle>
                          <DialogDescription>
                            View complete verification information and manage verification status
                          </DialogDescription>
                        </DialogHeader>
                        
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="attempts">Verification Attempts</TabsTrigger>
                            <TabsTrigger value="actions">Admin Actions</TabsTrigger>
                          </TabsList>
                          
                          <TabsContent value="overview" className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Basic Info */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">User Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  <div><span className="font-medium">Name:</span> {user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username}</div>
                                  <div><span className="font-medium">Email:</span> {user.email}</div>
                                  <div><span className="font-medium">Phone:</span> {user.phone_number || 'Not provided'}</div>
                                  <div><span className="font-medium">Role:</span> {user.role}</div>
                                  <div><span className="font-medium">Status:</span> {user.is_active ? 'Active' : 'Inactive'}</div>
                                  <div><span className="font-medium">Created:</span> {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}</div>
                                  {user.last_login_at && (
                                    <div><span className="font-medium">Last Login:</span> {new Date(user.last_login_at).toLocaleDateString()}</div>
                                  )}
                                </CardContent>
                              </Card>
                              
                              {/* Verification Status */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Verification Status</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                  <div><span className="font-medium">Verified:</span> {user.is_verified ? 'Yes' : 'No'}</div>
                                  <div><span className="font-medium">Status:</span> {user.verification_status}</div>
                                  <div><span className="font-medium">Bypassed:</span> {user.is_verification_bypassed ? 'Yes' : 'No'}</div>
                                  <div><span className="font-medium">Attempts:</span> {user.total_verification_attempts}</div>
                                  <div><span className="font-medium">Retry Count:</span> {user.verification_retry_count}</div>
                                  {user.evs_verified_at && (
                                    <div><span className="font-medium">Verified At:</span> {new Date(user.evs_verified_at).toLocaleString()}</div>
                                  )}
                                </CardContent>
                              </Card>
                            </div>
                            
                            {/* EVS Data */}
                            {user.evs_transaction_id && (
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">BlueAssure Verification Data</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <span className="font-medium">Transaction ID:</span>
                                    <br />
                                    <code className="text-xs bg-gray-100 px-1 rounded">{user.evs_transaction_id}</code>
                                  </div>
                                  
                                  {user.evs_verification_confidence && (
                                    <div>
                                      <span className="font-medium">Confidence Score:</span>
                                      <br />
                                      <span className={`font-semibold ${getConfidenceColor(user.evs_verification_confidence)}`}>
                                        {user.evs_verification_confidence}%
                                      </span>
                                    </div>
                                  )}
                                  
                                  {user.id_type && (
                                    <div>
                                      <span className="font-medium">Document Type:</span>
                                      <br />
                                      <span>{user.id_type.replace('_', ' ').toUpperCase()}</span>
                                    </div>
                                  )}
                                  
                                  {user.evs_face_match_result !== null && (
                                    <div>
                                      <span className="font-medium">Face Match:</span>
                                      <br />
                                      <span className={user.evs_face_match_result ? 'text-green-600' : 'text-red-600'}>
                                        {user.evs_face_match_result ? 'Passed' : 'Failed'}
                                        {user.evs_face_match_confidence && ` (${user.evs_face_match_confidence}%)`}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {user.evs_liveness_score && (
                                    <div>
                                      <span className="font-medium">Liveness Score:</span>
                                      <br />
                                      <span className={getConfidenceColor(user.evs_liveness_score)}>
                                        {user.evs_liveness_score}%
                                      </span>
                                    </div>
                                  )}
                                  
                                  {user.evs_extracted_first_name && (
                                    <div>
                                      <span className="font-medium">Extracted Name:</span>
                                      <br />
                                      <span>{user.evs_extracted_first_name} {user.evs_extracted_last_name}</span>
                                    </div>
                                  )}
                                  
                                  {user.evs_extracted_date_of_birth && (
                                    <div>
                                      <span className="font-medium">Date of Birth:</span>
                                      <br />
                                      <span>{user.evs_extracted_date_of_birth}</span>
                                    </div>
                                  )}
                                  
                                  {user.id_number && (
                                    <div>
                                      <span className="font-medium">ID Number:</span>
                                      <br />
                                      <span className="font-mono text-xs">***{user.id_number.slice(-4)}</span>
                                    </div>
                                  )}
                                  
                                  {user.id_expiration_date && (
                                    <div>
                                      <span className="font-medium">ID Expiration:</span>
                                      <br />
                                      <span>{user.id_expiration_date}</span>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="attempts" className="space-y-4">
                            {verificationAttempts.length === 0 ? (
                              <div className="text-center text-gray-500 py-8">
                                No verification attempts found for this user.
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {verificationAttempts.map((attempt: VerificationAttempt) => (
                                  <Card key={attempt.id}>
                                    <CardHeader>
                                      <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm">
                                          Attempt #{attempt.attemptNumber}
                                        </CardTitle>
                                        <Badge className={
                                          attempt.status === 'approved' ? 'bg-green-100 text-green-800' :
                                          attempt.status === 'denied' ? 'bg-red-100 text-red-800' :
                                          'bg-yellow-100 text-yellow-800'
                                        }>
                                          {attempt.status}
                                        </Badge>
                                      </div>
                                      <CardDescription>
                                        {new Date(attempt.attemptedAt).toLocaleString()}
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium">Transaction ID:</span>
                                        <br />
                                        <code className="text-xs bg-gray-100 px-1 rounded">{attempt.evsTransactionId}</code>
                                      </div>
                                      
                                      <div>
                                        <span className="font-medium">Confidence:</span>
                                        <br />
                                        <span className={getConfidenceColor(attempt.confidenceScore)}>
                                          {attempt.confidenceScore}%
                                        </span>
                                      </div>
                                      
                                      <div>
                                        <span className="font-medium">Document Type:</span>
                                        <br />
                                        <span>{attempt.documentType}</span>
                                      </div>
                                      
                                      <div>
                                        <span className="font-medium">Images Uploaded:</span>
                                        <br />
                                        <div className="flex gap-1 mt-1">
                                          <Badge variant="outline" className={`text-xs ${attempt.frontImageUploaded ? 'bg-green-50' : 'bg-red-50'}`}>
                                            Front
                                          </Badge>
                                          <Badge variant="outline" className={`text-xs ${attempt.backImageUploaded ? 'bg-green-50' : 'bg-red-50'}`}>
                                            Back
                                          </Badge>
                                          <Badge variant="outline" className={`text-xs ${attempt.selfieUploaded ? 'bg-green-50' : 'bg-red-50'}`}>
                                            Selfie
                                          </Badge>
                                        </div>
                                      </div>
                                      
                                      <div>
                                        <span className="font-medium">Face Match:</span>
                                        <br />
                                        <span className={attempt.faceMatchResult ? 'text-green-600' : 'text-red-600'}>
                                          {attempt.faceMatchResult ? 'Passed' : 'Failed'} ({attempt.faceMatchConfidence}%)
                                        </span>
                                      </div>
                                      
                                      <div>
                                        <span className="font-medium">Liveness Score:</span>
                                        <br />
                                        <span className={getConfidenceColor(attempt.livenessScore)}>
                                          {attempt.livenessScore}%
                                        </span>
                                      </div>
                                      
                                      {attempt.extractedFirstName && (
                                        <div className="md:col-span-2">
                                          <span className="font-medium">Extracted Name:</span>
                                          <br />
                                          <span>{attempt.extractedFirstName} {attempt.extractedLastName}</span>
                                        </div>
                                      )}
                                      
                                      {attempt.extractedDateOfBirth && (
                                        <div>
                                          <span className="font-medium">Date of Birth:</span>
                                          <br />
                                          <span>{attempt.extractedDateOfBirth}</span>
                                        </div>
                                      )}
                                      
                                      <div>
                                        <span className="font-medium">Processing Time:</span>
                                        <br />
                                        <span>{attempt.processingTimeMs}ms</span>
                                      </div>
                                    </CardContent>
                                    
                                    {(attempt.errors?.length > 0 || attempt.warnings?.length > 0) && (
                                      <CardContent className="pt-0">
                                        {attempt.errors?.length > 0 && (
                                          <div className="mb-2">
                                            <span className="text-sm font-medium text-red-600">Errors:</span>
                                            <ul className="text-sm text-red-600 list-disc list-inside">
                                              {attempt.errors.map((error, index) => (
                                                <li key={index}>{error}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        
                                        {attempt.warnings?.length > 0 && (
                                          <div>
                                            <span className="text-sm font-medium text-yellow-600">Warnings:</span>
                                            <ul className="text-sm text-yellow-600 list-disc list-inside">
                                              {attempt.warnings.map((warning, index) => (
                                                <li key={index}>{warning}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </CardContent>
                                    )}
                                  </Card>
                                ))}
                              </div>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="actions" className="space-y-4">
                            <div className="space-y-6">
                              {/* Current Status */}
                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm">Current Verification Status</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    {getStatusBadge(user)}
                                    {user.is_verification_bypassed && (
                                      <span className="text-sm text-purple-600">
                                        (Bypassed by {user.bypassed_by_admin} on {user.verification_bypassed_at ? new Date(user.verification_bypassed_at).toLocaleDateString() : 'Unknown'})
                                      </span>
                                    )}
                                  </div>
                                  {user.verification_bypass_reason && (
                                    <div className="text-sm text-gray-600">
                                      <span className="font-medium">Bypass Reason:</span> {user.verification_bypass_reason}
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                              
                              {/* Actions */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Bypass Verification */}
                                {!user.is_verification_bypassed && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-sm text-purple-600 flex items-center gap-2">
                                        <SkipForward className="w-4 h-4" />
                                        Bypass Verification
                                      </CardTitle>
                                      <CardDescription>
                                        Manually approve this user without completing verification
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <Textarea
                                        placeholder="Reason for bypassing verification (required)"
                                        value={bypassReason}
                                        onChange={(e) => setBypassReason(e.target.value)}
                                        rows={3}
                                      />
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button 
                                            variant="outline" 
                                            className="w-full border-purple-300 text-purple-600 hover:bg-purple-50"
                                            disabled={!bypassReason.trim()}
                                          >
                                            <Shield className="w-4 h-4 mr-2" />
                                            Bypass Verification
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Bypass Verification</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to bypass verification for {user.full_name || user.username}? 
                                              This will mark them as verified without completing the BlueAssure verification process.
                                              This action will be logged and audited.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction 
                                              onClick={handleBypassVerification}
                                              className="bg-purple-600 hover:bg-purple-700"
                                            >
                                              Confirm Bypass
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </CardContent>
                                  </Card>
                                )}
                                
                                {/* Remove Bypass */}
                                {user.is_verification_bypassed && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="text-sm text-red-600 flex items-center gap-2">
                                        <RotateCcw className="w-4 h-4" />
                                        Remove Bypass
                                      </CardTitle>
                                      <CardDescription>
                                        Remove the verification bypass and require normal verification
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <Textarea
                                        placeholder="Reason for removing bypass (required)"
                                        value={bypassReason}
                                        onChange={(e) => setBypassReason(e.target.value)}
                                        rows={3}
                                      />
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button 
                                            variant="outline" 
                                            className="w-full border-red-300 text-red-600 hover:bg-red-50"
                                            disabled={!bypassReason.trim()}
                                          >
                                            <RotateCcw className="w-4 h-4 mr-2" />
                                            Remove Bypass
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Remove Verification Bypass</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to remove the verification bypass for {user.full_name || user.username}? 
                                              This will mark them as not verified and they will need to complete the normal verification process.
                                              This action will be logged and audited.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction 
                                              onClick={handleRemoveBypass}
                                              className="bg-red-600 hover:bg-red-700"
                                            >
                                              Confirm Removal
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </CardContent>
                                  </Card>
                                )}
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </DialogContent>
                    </Dialog>
                    
                    {/* Quick Bypass Button */}
                    {!user.is_verification_bypassed && !user.is_verified && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-purple-600 border-purple-300 hover:bg-purple-50">
                            <SkipForward className="w-4 h-4 mr-2" />
                            Quick Bypass
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Bypass Verification</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will bypass verification requirements for {user.full_name || user.username}. Please provide a reason.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-4">
                            <Textarea
                              placeholder="Enter reason for bypassing verification..."
                              value={bypassReason}
                              onChange={(e) => setBypassReason(e.target.value)}
                              className="min-h-[100px]"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setBypassReason('')}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                if (!bypassReason.trim()) {
                                  toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: "Please provide a reason for bypassing verification.",
                                  });
                                  return;
                                }
                                bypassVerificationMutation.mutate({
                                  userId: user.id,
                                  reason: bypassReason.trim()
                                });
                              }}
                              disabled={!bypassReason.trim() || bypassVerificationMutation.isPending}
                              className="bg-purple-600 hover:bg-purple-700"
                            >
                              {bypassVerificationMutation.isPending ? 'Processing...' : 'Bypass Verification'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    
                    {user.is_verification_bypassed && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-orange-600 border-orange-300 hover:bg-orange-50">
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Remove Bypass
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Verification Bypass</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the verification bypass for {user.full_name || user.username} and require them to complete verification. Please provide a reason.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="space-y-4">
                            <Textarea
                              placeholder="Enter reason for removing bypass..."
                              value={bypassReason}
                              onChange={(e) => setBypassReason(e.target.value)}
                              className="min-h-[100px]"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setBypassReason('')}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => {
                                if (!bypassReason.trim()) {
                                  toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: "Please provide a reason for removing the bypass.",
                                  });
                                  return;
                                }
                                removeBypassMutation.mutate({
                                  userId: user.id,
                                  reason: bypassReason.trim()
                                });
                              }}
                              disabled={!bypassReason.trim() || removeBypassMutation.isPending}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              {removeBypassMutation.isPending ? 'Processing...' : 'Remove Bypass'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}