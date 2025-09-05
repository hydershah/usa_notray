import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Activity,
  Shield,
  Key,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Globe,
  Monitor,
  Clock,
  MapPin as LocationIcon,
  Smartphone,
  Wifi,
  Eye,
  LogIn,
  LogOut,
  Users as UsersIcon
} from 'lucide-react';
import { format } from 'date-fns';

interface UserData {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  approvalStatus: string;
  phoneNumber?: string;
  state?: string;
  city?: string;
  createdAt: string;
  lastActivity?: string;
  notaryType?: string;
  isAdmin?: boolean;
  isNotary?: boolean;
}

interface CertificateStatus {
  hasCertificate: boolean;
  certificate?: {
    id: string;
    certificateId: string;
    commonName: string;
    userRole: string;
    issuedAt: string;
    expiresAt: string;
    status: string;
    isExpired: boolean;
    downloadUrl: string;
  };
  error?: string;
}

interface UserActivityLog {
  id: number;
  action: string;
  actionDescription: string;
  ipAddress?: string;
  userAgent?: string;
  city?: string;
  state?: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  isSuccessful: boolean;
  sessionId?: string;
}

interface UserActivityData {
  recentActivity: UserActivityLog[];
  loginSessions: {
    totalSessions: number;
    uniqueIPs: number;
    uniqueLocations: number;
    lastLogin?: string;
    mostCommonLocation?: string;
    mostCommonDevice?: string;
  };
  securityInfo: {
    suspiciousActivity: number;
    failedLogins: number;
    multipleLocations: boolean;
    deviceCount: number;
  };
}

interface UserDetailsModalProps {
  user: UserData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  isOpen,
  onClose
}) => {
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const [activityData, setActivityData] = useState<UserActivityData | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      fetchCertificateStatus(user.id);
      fetchUserActivity(user.id);
    } else {
      setCertificateStatus(null);
      setActivityData(null);
    }
  }, [user, isOpen]);

  const fetchCertificateStatus = async (userId: number) => {
    if (!user || !['signer', 'witness'].includes(user.role)) {
      setCertificateStatus({ 
        hasCertificate: false, 
        error: 'Self-signed certificates are only available for signers and witnesses' 
      });
      return;
    }

    try {
      setCertificateLoading(true);
      const response = await fetch(`/api/admin/users/${userId}/certificate`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCertificateStatus(data);
      } else {
        const errorData = await response.json();
        setCertificateStatus({ 
          hasCertificate: false, 
          error: errorData.error || 'Failed to fetch certificate status' 
        });
      }
    } catch (error) {
      console.error('Error fetching certificate status:', error);
      setCertificateStatus({ 
        hasCertificate: false, 
        error: 'Failed to fetch certificate status' 
      });
    } finally {
      setCertificateLoading(false);
    }
  };

  const fetchUserActivity = async (userId: number) => {
    try {
      setActivityLoading(true);
      const response = await fetch(`/api/admin/logs/user/${userId}?limit=10`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Process the activity data
        const logs = data.logs || [];
        const loginLogs = logs.filter((log: any) => log.action === 'login');
        const uniqueIPs = new Set(logs.map((log: any) => log.ipAddress).filter(Boolean));
        const uniqueLocations = new Set(
          logs.map((log: any) => `${log.city || 'Unknown'}, ${log.country || 'Unknown'}`)
            .filter(loc => !loc.includes('Unknown'))
        );
        
        // Extract browser info from user agent
        const getBrowserInfo = (userAgent: string) => {
          if (!userAgent) return 'Unknown';
          if (userAgent.includes('Chrome')) return 'Chrome';
          if (userAgent.includes('Firefox')) return 'Firefox';
          if (userAgent.includes('Safari')) return 'Safari';
          if (userAgent.includes('Edge')) return 'Edge';
          return 'Unknown';
        };
        
        const deviceCounts = new Set(logs.map((log: any) => getBrowserInfo(log.userAgent)));
        const failedLogins = logs.filter((log: any) => 
          log.action === 'login' && !log.isSuccessful
        );
        
        const activityData: UserActivityData = {
          recentActivity: logs.slice(0, 10),
          loginSessions: {
            totalSessions: loginLogs.length,
            uniqueIPs: uniqueIPs.size,
            uniqueLocations: uniqueLocations.size,
            lastLogin: loginLogs[0]?.createdAt,
            mostCommonLocation: logs.find((log: any) => log.city && log.country)?.city && logs.find((log: any) => log.city && log.country)?.country 
              ? `${logs.find((log: any) => log.city && log.country)?.city}, ${logs.find((log: any) => log.city && log.country)?.country}` 
              : 'Unknown',
            mostCommonDevice: logs.find((log: any) => log.userAgent) 
              ? getBrowserInfo(logs.find((log: any) => log.userAgent)?.userAgent) 
              : 'Unknown'
          },
          securityInfo: {
            suspiciousActivity: 0, // This would need more sophisticated analysis
            failedLogins: failedLogins.length,
            multipleLocations: uniqueLocations.size > 1,
            deviceCount: deviceCounts.size
          }
        };
        
        setActivityData(activityData);
      } else {
        console.error('Failed to fetch user activity');
        setActivityData(null);
      }
    } catch (error) {
      console.error('Error fetching user activity:', error);
      setActivityData(null);
    } finally {
      setActivityLoading(false);
    }
  };

  const downloadCertificate = async (userId: number) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const isAdmin = currentUser.role === 'admin' || (currentUser.privileges && currentUser.privileges.includes('admin'));
      const isOwnCertificate = currentUser.id === userId;
      
      let downloadUrl;
      if (isAdmin && !isOwnCertificate) {
        downloadUrl = `/api/admin/users/${userId}/certificate/download`;
      } else {
        downloadUrl = `/api/user/certificate/download`;
      }
      
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user-${userId}-certificate.pem`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        const errorData = await response.json();
        if (errorData.error === 'Admin access required' && !isAdmin) {
          alert('You can only download your own certificate. Admin access is required to download other users\' certificates.');
        } else {
          alert(`Download failed: ${errorData.error}`);
        }
      }
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Failed to download certificate');
    }
  };

  const getStatusBadge = (user: UserData) => {
    if (user.approvalStatus === 'pending') {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
    if (!user.isActive) {
      return <Badge variant="secondary" className="bg-red-100 text-red-800">Inactive</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      notary: 'bg-blue-100 text-blue-800',
      title_company: 'bg-indigo-100 text-indigo-800',
      client: 'bg-gray-100 text-gray-800',
      signer: 'bg-green-100 text-green-800',
      witness: 'bg-orange-100 text-orange-800'
    };
    return (
      <Badge variant="outline" className={colors[role] || 'bg-gray-100 text-gray-800'}>
        {role.replace('_', ' ')}
      </Badge>
    );
  };

  const getCertificateStatusIcon = () => {
    if (certificateLoading) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (!certificateStatus) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    if (certificateStatus.error) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    if (!certificateStatus.hasCertificate) {
      return <XCircle className="h-4 w-4 text-gray-400" />;
    }
    if (certificateStatus.certificate?.isExpired) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getCertificateStatusText = () => {
    if (certificateLoading) return 'Loading...';
    if (!certificateStatus) return 'Unknown';
    if (certificateStatus.error) return 'Not Available';
    if (!certificateStatus.hasCertificate) return 'No Certificate';
    if (certificateStatus.certificate?.isExpired) return 'Expired';
    return 'Valid';
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">
                {user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{user.fullName}</h3>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          </DialogTitle>
          <DialogDescription>
            Comprehensive user information including activity tracking and security details
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <User className="h-4 w-4" />
              Basic Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Role:</span>
                  {getRoleBadge(user.role)}
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Status:</span>
                  {getStatusBadge(user)}
                </div>
                
                {user.notaryType && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Notary Type:</span>
                    <Badge variant="outline" className="text-xs">{user.notaryType}</Badge>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                {user.phoneNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Phone:</span>
                    <span className="text-gray-700">{user.phoneNumber}</span>
                  </div>
                )}
                
                {user.state && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">Location:</span>
                    <span className="text-gray-700">
                      {user.city && `${user.city}, `}{user.state}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Activity Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity Information
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Registered:</span>
                <span className="text-gray-700">{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              
              {user.lastActivity && (
                <div className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Last Activity:</span>
                  <span className="text-gray-700">{new Date(user.lastActivity).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Certificate Information */}
          {['signer', 'witness'].includes(user.role) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Self-Signed Certificate
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    {getCertificateStatusIcon()}
                    <span className="font-medium">Status:</span>
                    <span className="text-gray-700">{getCertificateStatusText()}</span>
                  </div>
                  
                  {certificateStatus?.hasCertificate && certificateStatus.certificate && (
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Certificate ID:</span>
                          <p className="text-gray-900 font-mono text-xs break-all">
                            {certificateStatus.certificate.certificateId}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Common Name:</span>
                          <p className="text-gray-900">
                            {certificateStatus.certificate.commonName}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Issued:</span>
                          <p className="text-gray-900">
                            {new Date(certificateStatus.certificate.issuedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Expires:</span>
                          <p className="text-gray-900">
                            {new Date(certificateStatus.certificate.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadCertificate(user.id)}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Certificate (.pem)
                      </Button>
                    </div>
                  )}
                  
                  {certificateStatus?.error && (
                    <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                      {certificateStatus.error}
                    </div>
                  )}
                  
                  {!certificateStatus?.hasCertificate && !certificateStatus?.error && !certificateLoading && (
                    <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                      <p className="font-medium text-blue-900 mb-1">Certificate Not Generated</p>
                      <p className="text-blue-800">
                        This user needs to complete ID verification to automatically generate their self-signed certificate.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => window.open(`mailto:${user.email}`, '_blank')}
              className="flex-1"
            >
              <Mail className="h-4 w-4 mr-2" />
              Send Email
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}; 