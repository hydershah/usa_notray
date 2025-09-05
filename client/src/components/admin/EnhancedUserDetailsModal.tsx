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

interface EnhancedUserDetailsModalProps {
  user: UserData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EnhancedUserDetailsModal: React.FC<EnhancedUserDetailsModalProps> = ({
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
      const response = await fetch(`/api/admin/logs/user/${userId}?limit=20`, {
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
        
        // Find most common location
        const locationCounts: Record<string, number> = {};
        logs.forEach((log: any) => {
          if (log.city && log.country) {
            const location = `${log.city}, ${log.country}`;
            locationCounts[location] = (locationCounts[location] || 0) + 1;
          }
        });
        const mostCommonLocation = Object.keys(locationCounts).reduce((a, b) => 
          locationCounts[a] > locationCounts[b] ? a : b, 'Unknown'
        );

        // Find most common device
        const deviceTypeCounts: Record<string, number> = {};
        logs.forEach((log: any) => {
          const device = getBrowserInfo(log.userAgent);
          deviceTypeCounts[device] = (deviceTypeCounts[device] || 0) + 1;
        });
        const mostCommonDevice = Object.keys(deviceTypeCounts).reduce((a, b) => 
          deviceTypeCounts[a] > deviceTypeCounts[b] ? a : b, 'Unknown'
        );
        
        const activityData: UserActivityData = {
          recentActivity: logs.slice(0, 15),
          loginSessions: {
            totalSessions: loginLogs.length,
            uniqueIPs: uniqueIPs.size,
            uniqueLocations: uniqueLocations.size,
            lastLogin: loginLogs[0]?.createdAt,
            mostCommonLocation: Object.keys(locationCounts).length > 0 ? mostCommonLocation : 'Unknown',
            mostCommonDevice: Object.keys(deviceTypeCounts).length > 0 ? mostCommonDevice : 'Unknown'
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
      
      if (!isAdmin && !isOwnCertificate) {
        alert('You can only download your own certificate or you must be an admin.');
        return;
      }

      const response = await fetch(`/api/admin/users/${userId}/certificate/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${user?.fullName || 'user'}-certificate.p12`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to download certificate');
      }
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('Failed to download certificate');
    }
  };

  const getStatusBadge = (user: UserData) => {
    if (!user.isActive) {
      return <Badge variant="destructive">Inactive</Badge>;
    }
    
    switch (user.approvalStatus) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800">Approved</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{user.approvalStatus}</Badge>;
    }
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
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
            Comprehensive user information including activity tracking, security details, and certificates
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="activity">Activity & Tracking</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="certificates">Certificates</TabsTrigger>
          </TabsList>

          {/* Basic Information Tab */}
          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Role:</span>
                      {getRoleBadge(user.role)}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Status:</span>
                      {getStatusBadge(user)}
                    </div>
                    
                    {user.notaryType && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Notary Type:</span>
                        <Badge variant="outline">{user.notaryType}</Badge>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    {user.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Phone:</span>
                        <span className="text-gray-700">{user.phoneNumber}</span>
                      </div>
                    )}
                    
                    {user.state && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">Location:</span>
                        <span className="text-gray-700">
                          {user.city && `${user.city}, `}{user.state}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Registered:</span>
                      <span className="text-gray-700">
                        {format(new Date(user.createdAt), 'PPP')}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity & Tracking Tab */}
          <TabsContent value="activity" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Login Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {activityLoading ? '...' : activityData?.loginSessions.totalSessions || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Total sessions</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <LocationIcon className="h-4 w-4" />
                    Locations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {activityLoading ? '...' : activityData?.loginSessions.uniqueLocations || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Different locations</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    IP Addresses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {activityLoading ? '...' : activityData?.loginSessions.uniqueIPs || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Different IPs</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Devices
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {activityLoading ? '...' : activityData?.securityInfo.deviceCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Different devices</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Recent user activities with location and device information</CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading activity data...</span>
                  </div>
                ) : activityData?.recentActivity.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Browser</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityData.recentActivity.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {log.action === 'login' && <LogIn className="h-4 w-4 text-green-500" />}
                              {log.action === 'logout' && <LogOut className="h-4 w-4 text-orange-500" />}
                              {log.action === 'session_join' && <UsersIcon className="h-4 w-4 text-blue-500" />}
                              <div>
                                <div className="font-medium">{log.action.replace('_', ' ')}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[200px]">
                                  {log.actionDescription}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.city && log.country ? (
                              <div className="flex items-center gap-1">
                                <LocationIcon className="h-3 w-3 text-gray-400" />
                                <div>
                                  <div className="text-sm">{log.city}, {log.country}</div>
                                  {log.timezone && (
                                    <div className="text-xs text-gray-500">{log.timezone}</div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-sm">Unknown</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {log.ipAddress || 'N/A'}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Monitor className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">
                                {log.userAgent ? (
                                  log.userAgent.includes('Chrome') ? 'Chrome' :
                                  log.userAgent.includes('Firefox') ? 'Firefox' :
                                  log.userAgent.includes('Safari') ? 'Safari' :
                                  log.userAgent.includes('Edge') ? 'Edge' : 'Unknown'
                                ) : 'Unknown'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-600">
                              {format(new Date(log.createdAt), 'MMM d, HH:mm')}
                            </span>
                          </TableCell>
                          <TableCell>
                            {log.isSuccessful ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-800">Success</Badge>
                            ) : (
                              <Badge variant="destructive">Failed</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No recent activity found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Security Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Failed Login Attempts</span>
                    <Badge variant={activityData?.securityInfo.failedLogins ? "destructive" : "secondary"}>
                      {activityData?.securityInfo.failedLogins || 0}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Multiple Locations</span>
                    <Badge variant={activityData?.securityInfo.multipleLocations ? "outline" : "secondary"}>
                      {activityData?.securityInfo.multipleLocations ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Device Count</span>
                    <Badge variant="outline">
                      {activityData?.securityInfo.deviceCount || 0}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Account Status</span>
                    <Badge variant={user.isActive ? "default" : "destructive"}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Access Patterns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-sm font-medium">Most Common Location</span>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <LocationIcon className="h-3 w-3" />
                      {activityData?.loginSessions.mostCommonLocation || 'Unknown'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium">Most Common Device</span>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <Monitor className="h-3 w-3" />
                      {activityData?.loginSessions.mostCommonDevice || 'Unknown'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium">Last Login</span>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {activityData?.loginSessions.lastLogin 
                        ? format(new Date(activityData.loginSessions.lastLogin), 'PPP p')
                        : 'Never'
                      }
                    </p>
                  </div>

                  <div>
                    <span className="text-sm font-medium">Registration Date</span>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(user.createdAt), 'PPP')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Certificates Tab */}
          <TabsContent value="certificates" className="space-y-4">
            {(user.role === 'signer' || user.role === 'witness') ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Digital Certificate
                  </CardTitle>
                  <CardDescription>
                    Self-signed certificate for document signing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getCertificateStatusIcon()}
                      <span className="font-medium">Certificate Status:</span>
                      <span className="text-gray-700">{getCertificateStatusText()}</span>
                    </div>
                    
                    {certificateStatus?.hasCertificate && certificateStatus.certificate && !certificateStatus.certificate.isExpired && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadCertificate(user.id)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Certificate
                      </Button>
                    )}
                  </div>
                  
                  {certificateStatus?.certificate && (
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <span className="font-medium text-gray-700">Common Name:</span>
                          <p className="text-gray-600">{certificateStatus.certificate.commonName}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Status:</span>
                          <p className="text-gray-600 capitalize">{certificateStatus.certificate.status}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Issued:</span>
                          <p className="text-gray-600">
                            {format(new Date(certificateStatus.certificate.issuedAt), 'PPP')}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Expires:</span>
                          <p className={`${certificateStatus.certificate.isExpired ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                            {format(new Date(certificateStatus.certificate.expiresAt), 'PPP')}
                          </p>
                        </div>
                      </div>
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
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="text-center py-8">
                  <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Certificates Available</h3>
                  <p className="text-gray-600">
                    Digital certificates are only available for signers and witnesses.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
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
      </DialogContent>
    </Dialog>
  );
};
