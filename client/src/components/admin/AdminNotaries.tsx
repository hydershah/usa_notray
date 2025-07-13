import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Award, 
  Shield, 
  Settings,
  Search,
  Filter,
  Eye,
  Edit,
  UserCheck,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  Hash
} from 'lucide-react';

interface NotaryData {
  id: number;
  fullName: string;
  email: string;
  role: string;
  notaryType: string;
  notaryIdCode?: string;
  isActive: boolean;
  approvalStatus: string;
  
  // Contact Information
  phoneNumber?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  
  // Commission Information
  nameOnCommission?: string;
  commissionNumber?: string;
  commissionExpiration?: string;
  commissionState?: string;
  commissionCounty?: string;
  commissionAddress1?: string;
  commissionAddress2?: string;
  commissionCity?: string;
  commissionZipCode?: string;
  
  // Qualifications
  isNotarySigningAgent?: boolean;
  notarySigningAgentExpiration?: string;
  isSpanishSpeaking?: boolean;
  foreignLanguages?: string[];
  maxConcurrentJobs?: number;
  
  // Insurance and Bond
  eoInsuranceCompany?: string;
  eoInsuranceAmount?: number;
  eoInsuranceExpiration?: string;
  bondCompanyName?: string;
  bondAmount?: number;
  bondExpiration?: string;
  
  // Document Files
  hasCommissionFile?: boolean;
  hasEOInsurance?: boolean;
  hasBond?: boolean;
  hasPublicCertificate?: boolean;
  hasSigningAgentFile?: boolean;
  
  // ID Verification
  idType?: string;
  idNumber?: string;
  idExpirationDate?: string;
  isVerified?: boolean;
  verificationStatus?: string;
  
  // Account Information
  accountBalance?: number;
  totalEarnings?: number;
  totalSpent?: number;
  
  // Timestamps
  createdAt: string;
  lastActivity?: string;
  approvedAt?: string;
  lastProfileUpdate?: string;
  
  // Performance
  assignedCompanies?: string[];
  completedJobs?: number;
}

export function AdminNotaries() {
  const [, setLocation] = useLocation();
  const [allNotaries, setAllNotaries] = useState<NotaryData[]>([]);
  const [selectedNotary, setSelectedNotary] = useState<NotaryData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotariesData();
  }, []);

  const fetchNotariesData = async () => {
    try {
      setLoading(true);
      // Use comprehensive profile endpoint for detailed notary information
      const response = await fetch('/api/users/notaries-comprehensive', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      // If comprehensive endpoint doesn't exist, fall back to basic endpoint
      if (!response.ok && response.status === 404) {
        const basicResponse = await fetch('/api/users/notaries', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!basicResponse.ok) {
          throw new Error('Failed to fetch notaries');
        }
        
        const basicNotaries = await basicResponse.json();
        const mappedNotaries = Array.isArray(basicNotaries) ? basicNotaries.map((user: any) => ({
          id: user.id,
          fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email,
          email: user.email,
          role: 'notary',
          notaryType: user.notaryType || 'contractor',
          notaryIdCode: user.notaryIdCode,
          isActive: user.isActive !== false,
          approvalStatus: user.approvalStatus || (user.isActive ? 'approved' : 'pending'),
          phoneNumber: user.phoneNumber,
          state: user.state,
          city: user.city,
          commissionNumber: user.commissionNumber,
          commissionExpiration: user.commissionExpiration,
          isNotarySigningAgent: user.isNotarySigningAgent,
          isSpanishSpeaking: user.isSpanishSpeaking,
          createdAt: user.createdAt,
          lastActivity: user.lastLoginAt,
          hasCommissionFile: user.hasCommissionFile || false,
          hasEOInsurance: user.hasEOInsurance || false,
          hasBond: user.hasBond || false,
          hasPublicCertificate: user.hasPublicCertificate || false,
          assignedCompanies: [],
          completedJobs: 0
        })) : [];
        
        setAllNotaries(mappedNotaries);
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch comprehensive notary data');
      }
      
      const comprehensiveNotaries = await response.json();
      console.log('👨‍⚖️ Comprehensive notaries fetched:', comprehensiveNotaries);
      
      // Map comprehensive notary data
      const mappedNotaries = Array.isArray(comprehensiveNotaries) ? comprehensiveNotaries.map((user: any) => ({
        id: user.id,
        fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email,
        email: user.email,
        role: 'notary',
        notaryType: user.notaryType || 'contractor',
        notaryIdCode: user.notaryIdCode,
        isActive: user.isActive !== false,
        approvalStatus: user.approvalStatus || (user.isActive ? 'approved' : 'pending'),
        
        // Contact Information
        phoneNumber: user.phoneNumber,
        address1: user.address1,
        address2: user.address2,
        city: user.city,
        state: user.state,
        zipCode: user.zipCode,
        
        // Commission Information
        nameOnCommission: user.nameOnCommission,
        commissionNumber: user.commissionNumber,
        commissionExpiration: user.commissionExpiration,
        commissionState: user.commissionState,
        commissionCounty: user.commissionCounty,
        commissionAddress1: user.commissionAddress1,
        commissionAddress2: user.commissionAddress2,
        commissionCity: user.commissionCity,
        commissionZipCode: user.commissionZipCode,
        
        // Qualifications
        isNotarySigningAgent: user.isNotarySigningAgent,
        notarySigningAgentExpiration: user.notarySigningAgentExpiration,
        isSpanishSpeaking: user.isSpanishSpeaking,
        foreignLanguages: user.foreignLanguages,
        maxConcurrentJobs: user.maxConcurrentJobs,
        
        // Insurance and Bond
        eoInsuranceCompany: user.eoInsuranceCompany,
        eoInsuranceAmount: user.eoInsuranceAmount,
        eoInsuranceExpiration: user.eoInsuranceExpiration,
        bondCompanyName: user.bondCompanyName,
        bondAmount: user.bondAmount,
        bondExpiration: user.bondExpiration,
        
        // Document Files
        hasCommissionFile: user.hasCommissionFile || !!user.notaryCommissionFile,
        hasEOInsurance: user.hasEOInsurance || !!user.eoInsuranceFile,
        hasBond: user.hasBond || !!user.bondFile,
        hasPublicCertificate: user.hasPublicCertificate || !!user.publicCertificateFile,
        hasSigningAgentFile: user.hasSigningAgentFile || !!user.signingAgentFile,
        
        // ID Verification
        idType: user.idType,
        idNumber: user.idNumber,
        idExpirationDate: user.idExpirationDate,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        
        // Account Information
        accountBalance: user.accountBalance,
        totalEarnings: user.totalEarnings,
        totalSpent: user.totalSpent,
        
        // Timestamps
        createdAt: user.createdAt,
        lastActivity: user.lastLoginAt,
        approvedAt: user.approvedAt,
        lastProfileUpdate: user.lastProfileUpdate,
        
        // Performance
        assignedCompanies: [],
        completedJobs: 0
      })) : [];
      
      console.log('👨‍⚖️ Processed comprehensive notaries:', mappedNotaries);
      setAllNotaries(mappedNotaries);
    } catch (error) {
      console.error('Error fetching notaries data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotaries = allNotaries.filter(notary => {
    const matchesSearch = notary.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notary.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || notary.notaryType === typeFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && notary.isActive && notary.approvalStatus === 'approved') ||
                         (statusFilter === 'inactive' && !notary.isActive) ||
                         (statusFilter === 'pending' && notary.approvalStatus === 'pending');
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusColor = (notary: NotaryData) => {
    if (notary.approvalStatus === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (!notary.isActive) return 'bg-red-100 text-red-800';
    if (notary.approvalStatus === 'approved') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (notary: NotaryData) => {
    if (notary.approvalStatus === 'pending') return 'Pending';
    if (!notary.isActive) return 'Inactive';
    if (notary.approvalStatus === 'approved') return 'Active';
    return 'Unknown';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'subscriber':
        return 'bg-blue-100 text-blue-800';
      case 'contractor':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notary Management</h1>
          <p className="text-gray-600 mt-2">Manage notaries and their assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Award className="h-3 w-3 mr-1" />
            {allNotaries.length} notaries
          </Badge>
          <Button 
            onClick={() => setLocation('/notary-management')}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Settings className="h-4 w-4 mr-2" />
            Advanced Management
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Types</option>
          <option value="subscriber">Subscriber</option>
          <option value="contractor">Contractor</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notary List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notaries</CardTitle>
              <CardDescription>
                Showing {filteredNotaries.length} of {allNotaries.length} notaries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredNotaries.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No notaries found</p>
                  </div>
                ) : (
                  filteredNotaries.map((notary) => (
                    <div
                      key={notary.id}
                      onClick={() => setSelectedNotary(notary)}
                      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                        selectedNotary?.id === notary.id
                          ? 'bg-blue-50 border-2 border-blue-200'
                          : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Award className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{notary.fullName}</p>
                            <p className="text-sm text-gray-600">{notary.email}</p>
                            {notary.notaryIdCode && (
                              <p className="text-xs text-gray-500 font-mono mt-1">ID: {notary.notaryIdCode}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getTypeColor(notary.notaryType)}`}
                              >
                                {notary.notaryType}
                              </Badge>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${getStatusColor(notary)}`}
                              >
                                {getStatusText(notary)}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedNotary(notary);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notary Details */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notary Details</CardTitle>
              <CardDescription>
                {selectedNotary ? `Details for ${selectedNotary.fullName}` : 'Select a notary to view details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedNotary ? (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Award className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{selectedNotary.fullName}</h3>
                        <p className="text-sm text-gray-600">{selectedNotary.email}</p>
                      </div>
                    </div>

                    {/* ID Code and Status */}
                    <div className="grid grid-cols-1 gap-3">
                      {selectedNotary.notaryIdCode && (
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">ID Code:</span>
                          <Badge variant="outline" className="font-mono text-blue-600 bg-blue-50">
                            {selectedNotary.notaryIdCode}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Type:</span>
                        <Badge 
                          variant="secondary" 
                          className={getTypeColor(selectedNotary.notaryType)}
                        >
                          {selectedNotary.notaryType}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Status:</span>
                        <Badge 
                          variant="secondary" 
                          className={getStatusColor(selectedNotary)}
                        >
                          {getStatusText(selectedNotary)}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Contact Information */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Contact Information
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selectedNotary.phoneNumber && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span>{selectedNotary.phoneNumber}</span>
                        </div>
                      )}
                      {(selectedNotary.address1 || selectedNotary.city || selectedNotary.state) && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span>
                            {[selectedNotary.address1, selectedNotary.city, selectedNotary.state, selectedNotary.zipCode]
                              .filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Commission Information */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Award className="h-4 w-4" />
                      Commission Details
                    </h4>
                    <div className="space-y-2 text-sm">
                      {selectedNotary.nameOnCommission && (
                        <div><strong>Name:</strong> {selectedNotary.nameOnCommission}</div>
                      )}
                      {selectedNotary.commissionNumber && (
                        <div><strong>Number:</strong> {selectedNotary.commissionNumber}</div>
                      )}
                      {selectedNotary.commissionExpiration && (
                        <div><strong>Expires:</strong> {new Date(selectedNotary.commissionExpiration).toLocaleDateString()}</div>
                      )}
                      {selectedNotary.commissionState && (
                        <div><strong>State:</strong> {selectedNotary.commissionState}</div>
                      )}
                      {selectedNotary.commissionCounty && (
                        <div><strong>County:</strong> {selectedNotary.commissionCounty}</div>
                      )}
                    </div>
                  </div>

                  {/* Qualifications */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Qualifications
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        {selectedNotary.isNotarySigningAgent ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>Notary Signing Agent (NSA)</span>
                        {selectedNotary.notarySigningAgentExpiration && (
                          <span className="text-xs text-gray-500">
                            (Expires: {new Date(selectedNotary.notarySigningAgentExpiration).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedNotary.isSpanishSpeaking ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>Spanish Speaking</span>
                      </div>
                      {selectedNotary.foreignLanguages && selectedNotary.foreignLanguages.length > 0 && (
                        <div>
                          <strong>Languages:</strong> {selectedNotary.foreignLanguages.join(', ')}
                        </div>
                      )}
                      {selectedNotary.maxConcurrentJobs && (
                        <div>
                          <strong>Max Concurrent Jobs:</strong> {selectedNotary.maxConcurrentJobs}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Insurance & Bond */}
                  {(selectedNotary.eoInsuranceCompany || selectedNotary.bondCompanyName) && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Insurance & Bond
                      </h4>
                      <div className="space-y-2 text-sm">
                        {selectedNotary.eoInsuranceCompany && (
                          <div>
                            <strong>E&O Insurance:</strong> {selectedNotary.eoInsuranceCompany}
                            {selectedNotary.eoInsuranceAmount && (
                              <span> - ${(selectedNotary.eoInsuranceAmount / 100).toLocaleString()}</span>
                            )}
                            {selectedNotary.eoInsuranceExpiration && (
                              <span className="text-xs text-gray-500 ml-1">
                                (Expires: {new Date(selectedNotary.eoInsuranceExpiration).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                        )}
                        {selectedNotary.bondCompanyName && (
                          <div>
                            <strong>Bond:</strong> {selectedNotary.bondCompanyName}
                            {selectedNotary.bondAmount && (
                              <span> - ${(selectedNotary.bondAmount / 100).toLocaleString()}</span>
                            )}
                            {selectedNotary.bondExpiration && (
                              <span className="text-xs text-gray-500 ml-1">
                                (Expires: {new Date(selectedNotary.bondExpiration).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Document Status */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Required Documents
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'hasCommissionFile', label: 'Commission' },
                        { key: 'hasEOInsurance', label: 'E&O Insurance' },
                        { key: 'hasBond', label: 'Bond' },
                        { key: 'hasPublicCertificate', label: 'Certificate' },
                        { key: 'hasSigningAgentFile', label: 'NSA Certificate' }
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          {selectedNotary[key as keyof NotaryData] ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-xs text-gray-600">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ID Verification */}
                  {(selectedNotary.idType || selectedNotary.isVerified !== undefined) && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        ID Verification
                      </h4>
                      <div className="space-y-2 text-sm">
                        {selectedNotary.idType && (
                          <div><strong>ID Type:</strong> {selectedNotary.idType}</div>
                        )}
                        {selectedNotary.idNumber && (
                          <div><strong>ID Number:</strong> {selectedNotary.idNumber}</div>
                        )}
                        {selectedNotary.idExpirationDate && (
                          <div><strong>ID Expires:</strong> {new Date(selectedNotary.idExpirationDate).toLocaleDateString()}</div>
                        )}
                        {selectedNotary.isVerified !== undefined && (
                          <div className="flex items-center gap-2">
                            {selectedNotary.isVerified ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span>Verified Status: {selectedNotary.isVerified ? 'Verified' : 'Not Verified'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Account Information */}
                  {(selectedNotary.accountBalance !== undefined || selectedNotary.totalEarnings !== undefined) && (
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Account Information
                      </h4>
                      <div className="space-y-2 text-sm">
                        {selectedNotary.accountBalance !== undefined && (
                          <div><strong>Balance:</strong> ${(selectedNotary.accountBalance / 100).toFixed(2)}</div>
                        )}
                        {selectedNotary.totalEarnings !== undefined && (
                          <div><strong>Total Earnings:</strong> ${(selectedNotary.totalEarnings / 100).toFixed(2)}</div>
                        )}
                        {selectedNotary.totalSpent !== undefined && (
                          <div><strong>Total Spent:</strong> ${(selectedNotary.totalSpent / 100).toFixed(2)}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Activity
                    </h4>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div><strong>Created:</strong> {new Date(selectedNotary.createdAt).toLocaleDateString()}</div>
                      {selectedNotary.lastActivity && (
                        <div><strong>Last Active:</strong> {new Date(selectedNotary.lastActivity).toLocaleDateString()}</div>
                      )}
                      {selectedNotary.approvedAt && (
                        <div><strong>Approved:</strong> {new Date(selectedNotary.approvedAt).toLocaleDateString()}</div>
                      )}
                      {selectedNotary.lastProfileUpdate && (
                        <div><strong>Profile Updated:</strong> {new Date(selectedNotary.lastProfileUpdate).toLocaleDateString()}</div>
                      )}
                    </div>
                  </div>

                  {/* Performance Stats */}
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Performance:</h4>
                    <div className="text-sm text-gray-600">
                      <p>Completed Jobs: {selectedNotary.completedJobs || 0}</p>
                      {selectedNotary.assignedCompanies && (
                        <p>Assigned Companies: {selectedNotary.assignedCompanies.length}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation('/notary-management')}
                      className="w-full"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Notary
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation('/title-company-assignments')}
                      className="w-full"
                    >
                      <Building className="h-4 w-4 mr-2" />
                      Company Assignments
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a notary to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 