import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Shield, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Key,
  Award,
  FileText,
  Clock,
  Users,
  TrendingUp
} from 'lucide-react';

interface CertificateStats {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  nearExpiry: number;
}

interface AdminCertificateManagerProps {
  selectedUserIds?: number[];
  onClose?: () => void;
}

export function AdminCertificateManager({ selectedUserIds = [], onClose }: AdminCertificateManagerProps) {
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [isBulkGenerateDialogOpen, setIsBulkGenerateDialogOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch certificate statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/certificates/stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/certificates/stats');
      const data = await response.json();
      return data.stats as CertificateStats;
    }
  });

  // Generate certificate for single user
  const generateCertificateMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('POST', `/api/certificates/generate/${userId}`);
      return response.json();
    },
    onSuccess: (data, userId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/certificates/stats'] });
      toast({
        title: "Certificate Generated",
        description: `Certificate generated successfully for user ${userId}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate certificate",
      });
    },
  });

  // Bulk certificate operations
  const bulkCertificatesMutation = useMutation({
    mutationFn: async ({ action, userIds }: { action: string; userIds: number[] }) => {
      const response = await apiRequest('POST', '/api/certificates/bulk', {
        action,
        userIds
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/certificates/stats'] });
      setBulkResults(data.results || []);
      setIsBulkGenerateDialogOpen(false);
      
      const successCount = data.results?.filter((r: any) => r.success).length || 0;
      const failCount = data.results?.length - successCount || 0;
      
      toast({
        title: "Bulk Operation Complete",
        description: `${successCount} successful, ${failCount} failed`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Bulk operation failed",
      });
    },
  });

  // Download certificate
  const downloadCertificate = async (userId: number, fileType: 'p12' | 'pem' = 'p12') => {
    try {
      const response = await apiRequest('GET', `/api/certificates/download/${userId}?type=${fileType}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notary-certificate-${userId}.${fileType}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Show password if available
        const password = response.headers.get('X-Certificate-Password');
        if (password && fileType === 'p12') {
          toast({
            title: "Certificate Downloaded",
            description: `P12 Password: ${password}`,
          });
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download certificate",
      });
    }
  };

  // Revoke certificate
  const revokeCertificateMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
      const response = await apiRequest('POST', `/api/certificates/revoke/${userId}`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/certificates/stats'] });
      toast({
        title: "Certificate Revoked",
        description: "Certificate has been revoked successfully",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to revoke certificate",
      });
    },
  });

  const handleBulkGenerate = () => {
    if (selectedUserIds.length === 0) {
      toast({
        variant: "destructive",
        title: "No Users Selected",
        description: "Please select users first",
      });
      return;
    }
    setIsBulkGenerateDialogOpen(true);
  };

  const confirmBulkGenerate = () => {
    bulkCertificatesMutation.mutate({
      action: 'generate',
      userIds: selectedUserIds
    });
  };

  const getStatsIcon = (type: string) => {
    switch (type) {
      case 'total': return <Users className="h-4 w-4" />;
      case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'expired': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'revoked': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'nearExpiry': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (statsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2">Loading certificate data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Certificate Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Digital Certificate Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatsIcon('total')}
              </div>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatsIcon('active')}
              </div>
              <div className="text-2xl font-bold text-green-600">{stats?.active || 0}</div>
              <div className="text-sm text-gray-600">Active</div>
            </div>
            
            <div className="p-4 bg-red-50 rounded-lg text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatsIcon('expired')}
              </div>
              <div className="text-2xl font-bold text-red-600">{stats?.expired || 0}</div>
              <div className="text-sm text-gray-600">Expired</div>
            </div>
            
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatsIcon('revoked')}
              </div>
              <div className="text-2xl font-bold text-orange-600">{stats?.revoked || 0}</div>
              <div className="text-sm text-gray-600">Revoked</div>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg text-center">
              <div className="flex items-center justify-center mb-2">
                {getStatsIcon('nearExpiry')}
              </div>
              <div className="text-2xl font-bold text-yellow-600">{stats?.nearExpiry || 0}</div>
              <div className="text-sm text-gray-600">Near Expiry</div>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleBulkGenerate}
              disabled={selectedUserIds.length === 0 || bulkCertificatesMutation.isPending}
            >
              <Key className="h-4 w-4 mr-2" />
              Generate Certificates ({selectedUserIds.length})
            </Button>
            
            <Button
              variant="outline"
              onClick={() => bulkCertificatesMutation.mutate({ action: 'validate', userIds: selectedUserIds })}
              disabled={selectedUserIds.length === 0 || bulkCertificatesMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Validate Certificates ({selectedUserIds.length})
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setIsStatsDialogOpen(true)}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              View Details
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Certificate Actions Helper */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Individual Certificate Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Certificate actions available in user dropdown menus:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>Generate Certificate:</strong> Create new digital certificate for approved notaries</li>
                  <li><strong>Download Certificate:</strong> Download .p12 or .pem certificate files</li>
                  <li><strong>Validate Certificate:</strong> Check certificate status and validity</li>
                  <li><strong>Revoke Certificate:</strong> Revoke compromised or invalid certificates</li>
                </ul>
              </AlertDescription>
            </Alert>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Certificate Requirements</h4>
              <p className="text-blue-800 text-sm">
                Only <strong>approved notary users</strong> can have digital certificates generated. 
                Certificates are valid for 3 years and enable secure document signing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Generate Confirmation Dialog */}
      <Dialog open={isBulkGenerateDialogOpen} onOpenChange={setIsBulkGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Certificates</DialogTitle>
            <DialogDescription>
              Generate digital certificates for {selectedUserIds.length} selected users?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This will generate digital certificates for all selected notary users. 
                Non-notary users will be skipped.
              </AlertDescription>
            </Alert>
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsBulkGenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={confirmBulkGenerate}
                disabled={bulkCertificatesMutation.isPending}
              >
                {bulkCertificatesMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Generate Certificates
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Certificate Statistics Detail Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Certificate System Statistics</DialogTitle>
            <DialogDescription>
              Detailed overview of the digital certificate system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Certificate Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Active Certificates
                        </span>
                        <Badge className="bg-green-100 text-green-800">{stats.active}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-yellow-500" />
                          Near Expiry
                        </span>
                        <Badge className="bg-yellow-100 text-yellow-800">{stats.nearExpiry}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-500" />
                          Expired
                        </span>
                        <Badge className="bg-red-100 text-red-800">{stats.expired}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Revoked
                        </span>
                        <Badge className="bg-orange-100 text-orange-800">{stats.revoked}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">System Health</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Active Rate</span>
                          <span>{stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Expiry Risk</span>
                          <span>{stats.total > 0 ? Math.round(((stats.nearExpiry + stats.expired) / stats.total) * 100) : 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-yellow-600 h-2 rounded-full" 
                            style={{ width: `${stats.total > 0 ? ((stats.nearExpiry + stats.expired) / stats.total) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Certificate Authority Information:</strong> The system uses a self-signed Certificate Authority 
                with 4096-bit RSA keys. User certificates are 2048-bit RSA with 3-year validity periods.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Results */}
      {bulkResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Bulk Operation Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bulkResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>{result.userId}</TableCell>
                    <TableCell>
                      {result.success ? (
                        <Badge className="bg-green-100 text-green-800">Success</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">Failed</Badge>
                      )}
                    </TableCell>
                    <TableCell>{result.error || result.message || 'Completed'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AdminCertificateManager; 