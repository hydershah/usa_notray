import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotaryStampManager } from '@/components/user/notary-stamp-manager';
import { SignatureManager } from '@/components/user/signature-manager';
import { NotaryProfileDocumentManager } from '@/components/notary/NotaryProfileDocumentManager';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  Mail, 
  Shield, 
  Stamp,
  Settings,
  Save,
  Edit,
  Calendar,
  Hash,
  MapPin,
  FileText,
  Pencil,
  Phone,
  Building,
  Check,
  Star,
  Camera,
  Award,
  Clock,
  Globe,
  Lock,
  Bell,
  Zap
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import TwoFactorAuth from '@/components/TwoFactorAuth';

export default function Profile() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    fullName: '',
    phone: '',
    address: '',
    
    // Personal Address
    address1: '',
    address2: '',
    city: '',
    state: '',
    zipCode: '',
    
    // Notary specific fields
    title: '',
    nameOnCommission: '',
    commissionNumber: '',
    commissionExpiration: '',
    county: '',
    disclosure: '',
    
    // Commission Address
    commissionAddress1: '',
    commissionAddress2: '',
    commissionCity: '',
    commissionState: '',
    commissionZipCode: '',
    commissionCounty: '',
    
    // E&O Insurance
    eoInsuranceCompany: '',
    eoInsuranceAmount: 0,
    eoInsuranceExpiration: '',
    
    // Bond Information
    bondCompanyName: '',
    bondAmount: 0,
    bondExpiration: '',
    
    // Public Certificate
    publicCertificateExpiration: '',
    publicCertificatePassword: '',
    
    // Signing Agent
    signingAgentCertified: false,
    signingAgentExpirationDate: '',
    
    // Languages
    foreignLanguages: [],
    
    // File status
    hasNotaryCommissionFile: false,
    hasEOInsuranceFile: false,
    hasPublicCertificateFile: false,
    hasBondFile: false,
    hasSigningAgentFile: false
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  // Helper function to format date for HTML date input
  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
    } catch (error) {
      return '';
    }
  };

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      

      
      if (token && user.id) {
        // Try to get comprehensive notary profile first
        let profileData = null;
        if (user.role === 'notary' || user.role === 'admin') {
          try {
            const notaryResponse = await fetch(`/api/notary/profile/comprehensive`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (notaryResponse.ok) {
              profileData = await notaryResponse.json();
            }
          } catch (error) {
            console.log('Could not load notary profile, falling back to basic profile');
          }
        }
        
        // Fall back to basic profile if notary profile not available
        if (!profileData) {
          const response = await fetch(`/api/users/${user.id}/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            profileData = await response.json();
          }
        }

        if (profileData) {
          setCurrentUser(profileData);
          setFormData({
            username: profileData.username || '',
            email: profileData.email || '',
            firstName: profileData.firstName || '',
            lastName: profileData.lastName || '',
            fullName: profileData.fullName || '',
            phone: profileData.phoneNumber || '',
            address: profileData.address || '',
            
            // Personal Address
            address1: profileData.address1 || '',
            address2: profileData.address2 || '',
            city: profileData.city || '',
            state: profileData.state || '',
            zipCode: profileData.zipCode || '',
            
            // Notary specific fields
            title: profileData.title || 'Notary Public',
            nameOnCommission: profileData.nameOnCommission || '',
            commissionNumber: profileData.commissionNumber || '',
            commissionExpiration: formatDateForInput(profileData.commissionExpiration),
            county: profileData.county || '',
            disclosure: profileData.disclosure || 'I acknowledge that this document was signed before me on this date.',
            
            // Commission Address
            commissionAddress1: profileData.commissionAddress1 || '',
            commissionAddress2: profileData.commissionAddress2 || '',
            commissionCity: profileData.commissionCity || '',
            commissionState: profileData.commissionState || '',
            commissionZipCode: profileData.commissionZipCode || '',
            commissionCounty: profileData.commissionCounty || '',
            
            // E&O Insurance
            eoInsuranceCompany: profileData.eoInsuranceCompany || '',
            eoInsuranceAmount: profileData.eoInsuranceAmount || 0,
            eoInsuranceExpiration: formatDateForInput(profileData.eoInsuranceExpiration),
            
            // Bond Information
            bondCompanyName: profileData.bondCompanyName || '',
            bondAmount: profileData.bondAmount || 0,
            bondExpiration: formatDateForInput(profileData.bondExpiration),
            
            // Public Certificate
            publicCertificateExpiration: formatDateForInput(profileData.publicCertificateExpiration),
            publicCertificatePassword: '',
            
            // Signing Agent
            signingAgentCertified: profileData.signingAgentCertified || false,
            signingAgentExpirationDate: formatDateForInput(profileData.signingAgentExpirationDate),
            
            // Languages
            foreignLanguages: profileData.foreignLanguages || [],
            
            // File status
            hasNotaryCommissionFile: profileData.hasNotaryCommissionFile || false,
            hasEOInsuranceFile: profileData.hasEOInsuranceFile || false,
            hasPublicCertificateFile: profileData.hasPublicCertificateFile || false,
            hasBondFile: profileData.hasBondFile || false,
            hasSigningAgentFile: profileData.hasSigningAgentFile || false
          });
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        setFormData({
          username: user.username || '',
          email: user.email || '',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          fullName: user.fullName || '',
          phone: user.phone || '',
          address: user.address || '',
          
          // Personal Address
          address1: '',
          address2: '',
          city: '',
          state: '',
          zipCode: '',
          
          // Notary specific fields
          title: 'Notary Public',
          nameOnCommission: '',
          commissionNumber: '',
          commissionExpiration: '',
          county: '',
          disclosure: 'I acknowledge that this document was signed before me on this date.',
          
          // Commission Address
          commissionAddress1: '',
          commissionAddress2: '',
          commissionCity: '',
          commissionState: '',
          commissionZipCode: '',
          commissionCounty: '',
          
          // E&O Insurance
          eoInsuranceCompany: '',
          eoInsuranceAmount: 0,
          eoInsuranceExpiration: '',
          
          // Bond Information
          bondCompanyName: '',
          bondAmount: 0,
          bondExpiration: '',
          
          // Public Certificate
          publicCertificateExpiration: '',
          publicCertificatePassword: '',
          
          // Signing Agent
          signingAgentCertified: false,
          signingAgentExpirationDate: '',
          
          // Languages
          foreignLanguages: [],
          
          // File status
          hasNotaryCommissionFile: false,
          hasEOInsuranceFile: false,
          hasPublicCertificateFile: false,
          hasBondFile: false,
          hasSigningAgentFile: false
        });
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !currentUser) {
        throw new Error('No authentication token found');
      }

      // For notary users, use the comprehensive notary profile API
      if (currentUser?.role === 'notary' || currentUser?.role === 'admin') {
        const notaryProfileData = {
          // Basic personal information
          firstName: formData.firstName,
          lastName: formData.lastName,
          fullName: formData.fullName || (formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}`.trim() : undefined),
          phoneNumber: formData.phone,
          
          // Personal address
          address1: formData.address1,
          address2: formData.address2,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          
          // Notary-specific fields
          nameOnCommission: formData.nameOnCommission,
          commissionNumber: formData.commissionNumber,
          commissionExpiration: formData.commissionExpiration,
          county: formData.county,
          disclosure: formData.disclosure,
          
          // Commission Address
          commissionAddress1: formData.commissionAddress1,
          commissionAddress2: formData.commissionAddress2,
          commissionCity: formData.commissionCity,
          commissionState: formData.commissionState,
          commissionZipCode: formData.commissionZipCode,
          commissionCounty: formData.commissionCounty,
          
          // E&O Insurance
          eoInsuranceCompany: formData.eoInsuranceCompany,
          eoInsuranceAmount: formData.eoInsuranceAmount ? formData.eoInsuranceAmount * 100 : undefined, // Convert to cents
          eoInsuranceExpiration: formData.eoInsuranceExpiration,
          
          // Bond Information
          bondCompanyName: formData.bondCompanyName,
          bondAmount: formData.bondAmount ? formData.bondAmount * 100 : undefined, // Convert to cents
          bondExpiration: formData.bondExpiration,
          
          // Public Certificate
          publicCertificateExpiration: formData.publicCertificateExpiration,
          publicCertificatePassword: formData.publicCertificatePassword,
          
          // Signing Agent
          signingAgentCertified: formData.signingAgentCertified,
          signingAgentExpirationDate: formData.signingAgentCertified ? formData.signingAgentExpirationDate : null,
          
          // Languages (keep existing)
          foreignLanguages: formData.foreignLanguages,
        };

        const response = await fetch('/api/notary/profile/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(notaryProfileData)
        });

        if (!response.ok) {
          throw new Error('Failed to update notary profile');
        }

        // Reload the profile data after successful save
        await loadUserProfile();
        
      } else {
        // For non-notary users, use the basic profile API
        const response = await fetch(`/api/users/${currentUser.id}/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            ...formData,
            phoneNumber: formData.phone
          })
        });

        if (!response.ok) {
          throw new Error('Failed to update profile');
        }

        const updatedUser = await response.json();
        setCurrentUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }

      setIsEditing(false);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully and will be reflected in live signing sessions",
      });
    } catch (error) {
      console.error('Update profile error:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg';
      case 'notary':
        return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg';
      case 'title_company':
        return 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg';
      case 'client':
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg';
      default:
        return 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-lg';
    }
  };

  const formatRole = (role: string) => {
    if (!role) return 'User'; // Default fallback for undefined/null roles
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (username: string) => {
    if (!username) return 'U';
    const words = username.split(' ');
    return words.length > 1 
      ? `${words[0][0]}${words[1][0]}`.toUpperCase()
      : username.substring(0, 2).toUpperCase();
  };

  if (!currentUser) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">Loading your profile...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Enhanced Header Section */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl opacity-90"></div>
            <div className="relative bg-white/10 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 bg-gradient-to-br from-white/20 to-white/10 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-white/20">
                      {getInitials(currentUser.username)}
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-white">
                    <h1 className="text-3xl font-bold mb-2">{currentUser.username}</h1>
                    <p className="text-white/80 text-lg mb-3">{currentUser.email}</p>
                    <div className="flex items-center gap-3">
                      <Badge className={`${getRoleBadgeColor(currentUser?.role || 'client')} px-4 py-2 text-sm font-medium`}>
                        {formatRole(currentUser?.role || 'user')}
                      </Badge>
                      <div className="flex items-center gap-2 text-white/80">
                        <Shield className="w-4 h-4" />
                        <span className="text-sm">Verified Account</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost"
                    size="lg"
                    className="text-white hover:bg-white/10 border-2 border-white/20 hover:border-white/30 transition-all duration-200"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Change Photo
                  </Button>
                  <Button 
                    size="lg"
                    onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                    className={`${
                      isEditing 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    } px-6 py-3 rounded-xl shadow-lg transition-all duration-200`}
                  >
                    {isEditing ? (
                      <>
                        <Save className="w-5 h-5 mr-2" />
                        Save Changes
                      </>
                    ) : (
                      <>
                        <Edit className="w-5 h-5 mr-2" />
                        Edit Profile
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Account Status</p>
                    <p className="text-2xl font-bold text-blue-800">Active</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Check className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Profile Complete</p>
                    <p className="text-2xl font-bold text-green-800">85%</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <User className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Security Level</p>
                    <p className="text-2xl font-bold text-purple-800">High</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600 font-medium">Last Login</p>
                    <p className="text-2xl font-bold text-orange-800">Today</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Clock className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Main Content */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
            <Tabs defaultValue="profile" className="w-full">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <TabsList className={`grid w-full h-16 bg-transparent p-2 ${
                  (currentUser?.role === 'notary' || currentUser?.role === 'admin') ? 'grid-cols-5' : 
                  (currentUser?.role === 'title_company') ? 'grid-cols-3' : 'grid-cols-4'
                }`}>
                  <TabsTrigger 
                    value="profile" 
                    className="flex items-center gap-2 h-12 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 rounded-xl transition-all duration-200"
                  >
                    <User className="w-5 h-5" />
                    Profile
                  </TabsTrigger>
                  {(currentUser?.role === 'notary' || currentUser?.role === 'admin') && (
                    <TabsTrigger 
                      value="stamps" 
                      className="flex items-center gap-2 h-12 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 rounded-xl transition-all duration-200"
                    >
                      <Stamp className="w-5 h-5" />
                      Notary Stamps
                    </TabsTrigger>
                  )}
                  {currentUser?.role !== 'title_company' && (
                    <TabsTrigger 
                      value="signatures" 
                      className="flex items-center gap-2 h-12 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 rounded-xl transition-all duration-200"
                    >
                      <Pencil className="w-5 h-5" />
                      Signatures
                    </TabsTrigger>
                  )}
                  {(currentUser?.role === 'notary' || currentUser?.role === 'admin' || currentUser?.role === 'title_company') && (
                    <TabsTrigger 
                      value="documents" 
                      className="flex items-center gap-2 h-12 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 rounded-xl transition-all duration-200"
                    >
                      <FileText className="w-5 h-5" />
                      Documents
                    </TabsTrigger>
                  )}
                  <TabsTrigger 
                    value="settings" 
                    className="flex items-center gap-2 h-12 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 rounded-xl transition-all duration-200"
                  >
                    <Settings className="w-5 h-5" />
                    Settings
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-8">
                {/* Enhanced Profile Tab */}
                <TabsContent value="profile" className="space-y-8">
                  <div className="space-y-8">
                    {/* Personal Information Section */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                          <User className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">Personal Information</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Username</label>
                          <Input
                            value={formData.username}
                            onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                            disabled={!isEditing}
                            className="h-12 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                          <Input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            disabled={!isEditing}
                            className="h-12 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                          <Input
                            value={formData.firstName}
                            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                            disabled={!isEditing}
                            className="h-12 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                          <Input
                            value={formData.lastName}
                            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                            disabled={!isEditing}
                            className="h-12 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            Phone Number
                          </label>
                          <Input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                            disabled={!isEditing}
                            className="h-12 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Building className="w-4 h-4" />
                            Address
                          </label>
                          <Input
                            value={formData.address}
                            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                            disabled={!isEditing}
                            className="h-12 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Personal Address Section - Available to ALL users */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">Personal Address</h3>
                        <Badge className="bg-green-100 text-green-800">Residential</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Address Line 1</label>
                          <Input
                            value={formData.address1}
                            onChange={(e) => setFormData(prev => ({ ...prev, address1: e.target.value }))}
                            disabled={!isEditing}
                            placeholder="123 Main Street"
                            className="h-12 bg-white border-2 border-gray-200 focus:border-green-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Address Line 2</label>
                          <Input
                            value={formData.address2}
                            onChange={(e) => setFormData(prev => ({ ...prev, address2: e.target.value }))}
                            disabled={!isEditing}
                            placeholder="Apt 4B, Suite 100, etc."
                            className="h-12 bg-white border-2 border-gray-200 focus:border-green-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                          <Input
                            value={formData.city}
                            onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                            disabled={!isEditing}
                            placeholder="Los Angeles"
                            className="h-12 bg-white border-2 border-gray-200 focus:border-green-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                          <Input
                            value={formData.state}
                            onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                            disabled={!isEditing}
                            placeholder="CA"
                            className="h-12 bg-white border-2 border-gray-200 focus:border-green-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2">ZIP Code</label>
                          <Input
                            value={formData.zipCode}
                            onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                            disabled={!isEditing}
                            placeholder="90210"
                            className="h-12 bg-white border-2 border-gray-200 focus:border-green-500 rounded-xl transition-all duration-200"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Notary Information Section */}
                    {(currentUser?.role === 'notary' || currentUser?.role === 'admin') && (
                      <>
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-100">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                              <Shield className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">Basic Notary Information</h3>
                            <Badge className="bg-purple-100 text-purple-800">Professional</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <Award className="w-4 h-4" />
                                Professional Title
                              </label>
                              <Input
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="Notary Public"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-purple-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <User className="w-4 h-4" />
                                Name on Commission
                              </label>
                              <Input
                                value={formData.nameOnCommission}
                                onChange={(e) => setFormData(prev => ({ ...prev, nameOnCommission: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="Full name as it appears on commission"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-purple-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <Hash className="w-4 h-4" />
                                Commission Number
                              </label>
                              <Input
                                value={formData.commissionNumber}
                                onChange={(e) => setFormData(prev => ({ ...prev, commissionNumber: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="NC123456"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-purple-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Commission Expiration
                              </label>
                              <Input
                                type="date"
                                value={formData.commissionExpiration}
                                onChange={(e) => setFormData(prev => ({ ...prev, commissionExpiration: e.target.value }))}
                                disabled={!isEditing}
                                className="h-12 bg-white border-2 border-gray-200 focus:border-purple-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                State
                              </label>
                              <Input
                                value={formData.state}
                                onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="California"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-purple-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                County
                              </label>
                              <Input
                                value={formData.county}
                                onChange={(e) => setFormData(prev => ({ ...prev, county: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="Los Angeles County"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-purple-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Default Disclosure Text
                              </label>
                              <Textarea
                                value={formData.disclosure}
                                onChange={(e) => setFormData(prev => ({ ...prev, disclosure: e.target.value }))}
                                disabled={!isEditing}
                                rows={3}
                                placeholder="I acknowledge that this document was signed before me on this date."
                                className="bg-white border-2 border-gray-200 focus:border-purple-500 rounded-xl resize-none transition-all duration-200"
                              />
                              <p className="text-xs text-gray-500 mt-2">
                                This text will be used when you add a disclosure to documents
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Commission Address Section */}
                        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 border border-orange-100">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                              <Building className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">Commission Address</h3>
                            <Badge className="bg-orange-100 text-orange-800">Official</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Commission Address Line 1</label>
                              <Input
                                value={formData.commissionAddress1}
                                onChange={(e) => setFormData(prev => ({ ...prev, commissionAddress1: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="Address on commission certificate"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-orange-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Commission Address Line 2</label>
                              <Input
                                value={formData.commissionAddress2}
                                onChange={(e) => setFormData(prev => ({ ...prev, commissionAddress2: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="Suite, unit, etc."
                                className="h-12 bg-white border-2 border-gray-200 focus:border-orange-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Commission City</label>
                              <Input
                                value={formData.commissionCity}
                                onChange={(e) => setFormData(prev => ({ ...prev, commissionCity: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="City on commission"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-orange-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Commission State</label>
                              <Input
                                value={formData.commissionState}
                                onChange={(e) => setFormData(prev => ({ ...prev, commissionState: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="State of commission"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-orange-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Commission ZIP Code</label>
                              <Input
                                value={formData.commissionZipCode}
                                onChange={(e) => setFormData(prev => ({ ...prev, commissionZipCode: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="ZIP code on commission"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-orange-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Commission County</label>
                              <Input
                                value={formData.commissionCounty}
                                onChange={(e) => setFormData(prev => ({ ...prev, commissionCounty: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="County of commission"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-orange-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* E&O Insurance Section */}
                        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 border border-blue-100">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                              <Shield className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">E&O Insurance</h3>
                            <Badge className="bg-blue-100 text-blue-800">Coverage</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Insurance Company</label>
                              <Input
                                value={formData.eoInsuranceCompany}
                                onChange={(e) => setFormData(prev => ({ ...prev, eoInsuranceCompany: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="Insurance provider name"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Coverage Amount ($)</label>
                              <Input
                                type="number"
                                value={formData.eoInsuranceAmount}
                                onChange={(e) => setFormData(prev => ({ ...prev, eoInsuranceAmount: Number(e.target.value) }))}
                                disabled={!isEditing}
                                placeholder="25000"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Expiration Date</label>
                              <Input
                                type="date"
                                value={formData.eoInsuranceExpiration}
                                onChange={(e) => setFormData(prev => ({ ...prev, eoInsuranceExpiration: e.target.value }))}
                                disabled={!isEditing}
                                className="h-12 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Bond Information Section */}
                        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-8 border border-yellow-100">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center">
                              <FileText className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">Notary Bond</h3>
                            <Badge className="bg-yellow-100 text-yellow-800">Security</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Bond Company</label>
                              <Input
                                value={formData.bondCompanyName}
                                onChange={(e) => setFormData(prev => ({ ...prev, bondCompanyName: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="Bond company name"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-yellow-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Bond Amount ($)</label>
                              <Input
                                type="number"
                                value={formData.bondAmount}
                                onChange={(e) => setFormData(prev => ({ ...prev, bondAmount: Number(e.target.value) }))}
                                disabled={!isEditing}
                                placeholder="15000"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-yellow-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Bond Expiration</label>
                              <Input
                                type="date"
                                value={formData.bondExpiration}
                                onChange={(e) => setFormData(prev => ({ ...prev, bondExpiration: e.target.value }))}
                                disabled={!isEditing}
                                className="h-12 bg-white border-2 border-gray-200 focus:border-yellow-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Public Certificate Section */}
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-8 border border-indigo-100">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                              <Lock className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">Digital Certificate</h3>
                            <Badge className="bg-indigo-100 text-indigo-800">Encryption</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Certificate Expiration</label>
                              <Input
                                type="date"
                                value={formData.publicCertificateExpiration}
                                onChange={(e) => setFormData(prev => ({ ...prev, publicCertificateExpiration: e.target.value }))}
                                disabled={!isEditing}
                                className="h-12 bg-white border-2 border-gray-200 focus:border-indigo-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Certificate Password</label>
                              <Input
                                type="password"
                                value={formData.publicCertificatePassword}
                                onChange={(e) => setFormData(prev => ({ ...prev, publicCertificatePassword: e.target.value }))}
                                disabled={!isEditing}
                                placeholder="••••••••"
                                className="h-12 bg-white border-2 border-gray-200 focus:border-indigo-500 rounded-xl transition-all duration-200"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Signing Agent Section */}
                        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-8 border border-teal-100">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center">
                              <Award className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">Signing Agent Certification</h3>
                            {formData.signingAgentCertified && <Badge className="bg-teal-100 text-teal-800">Certified</Badge>}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">NSA Certified</label>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={formData.signingAgentCertified}
                                  onChange={(e) => setFormData(prev => ({ ...prev, signingAgentCertified: e.target.checked }))}
                                  disabled={!isEditing}
                                  className="h-5 w-5 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-700">Certified Notary Signing Agent</span>
                              </div>
                            </div>
                            {formData.signingAgentCertified && (
                              <div className="space-y-2">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">NSA Expiration Date</label>
                                <Input
                                  type="date"
                                  value={formData.signingAgentExpirationDate}
                                  onChange={(e) => setFormData(prev => ({ ...prev, signingAgentExpirationDate: e.target.value }))}
                                  disabled={!isEditing}
                                  className="h-12 bg-white border-2 border-gray-200 focus:border-teal-500 rounded-xl transition-all duration-200"
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Languages Section */}
                        <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-8 border border-pink-100">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-pink-500 rounded-xl flex items-center justify-center">
                              <Globe className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">Languages</h3>
                            <Badge className="bg-pink-100 text-pink-800">Multilingual</Badge>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="block text-sm font-semibold text-gray-700 mb-2">Foreign Languages</label>
                              <div className="flex flex-wrap gap-2">
                                {formData.foreignLanguages && formData.foreignLanguages.length > 0 ? (
                                  formData.foreignLanguages.map((language, index) => (
                                    <Badge key={index} variant="secondary" className="bg-pink-100 text-pink-800">
                                      {language}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-gray-500 text-sm">No additional languages specified</span>
                                )}
                              </div>
                              {isEditing && (
                                <p className="text-xs text-gray-500">
                                  Use the profile completion form to edit languages
                                </p>
                              )}
                            </div>
                          </div>
                        </div>


                      </>
                    )}

                    {/* Enhanced Account Status Section */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">Account Verification</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                              <Shield className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-gray-900">Account Verified</span>
                          </div>
                          <p className="text-sm text-gray-600">Your account has been successfully verified</p>
                        </div>
                        <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                              <Mail className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-gray-900">Email Confirmed</span>
                          </div>
                          <p className="text-sm text-gray-600">Your email address is verified and active</p>
                        </div>
                        <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                              <User className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold text-gray-900">Profile Complete</span>
                          </div>
                          <p className="text-sm text-gray-600">Your profile information is complete</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Notary Stamps Tab */}
                {(currentUser?.role === 'notary' || currentUser?.role === 'admin') && (
                  <TabsContent value="stamps">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                      <NotaryStampManager notaryId={currentUser.id} />
                    </div>
                  </TabsContent>
                )}

                {/* Signatures Tab */}
                {currentUser?.role !== 'title_company' && (
                  <TabsContent value="signatures">
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-100">
                      <SignatureManager userId={currentUser.id} />
                    </div>
                  </TabsContent>
                )}

                {/* Documents Tab */}
                {(currentUser?.role === 'notary' || currentUser?.role === 'admin' || currentUser?.role === 'title_company') && (
                  <TabsContent value="documents">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900">Document Management</h3>
                          <p className="text-gray-600 mt-1">View, download, and manage your notary documents</p>
                        </div>
                      </div>
                      <NotaryProfileDocumentManager 
                        notaryId={currentUser.id}
                        onDocumentsChange={loadUserProfile}
                      />
                    </div>
                  </TabsContent>
                )}

                {/* Enhanced Settings Tab */}
                <TabsContent value="settings" className="space-y-8">
                  <div className="space-y-8">
                    {/* Two-Factor Authentication */}
                    <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-8 border border-red-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
                          <Lock className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h3>
                      </div>
                      <TwoFactorAuth />
                    </div>

                    {/* Security Settings */}
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-8 border border-orange-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">Security Settings</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-white rounded-xl p-6 border border-orange-200 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                                <Lock className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">Change Password</h4>
                                <p className="text-sm text-gray-600">Update your account password for better security</p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="hover:bg-orange-50 hover:border-orange-300">
                              Change Password
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preferences */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                          <Settings className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900">Preferences</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                <Bell className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">Email Notifications</h4>
                                <p className="text-sm text-gray-600">Receive updates about your jobs and documents</p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="hover:bg-blue-50 hover:border-blue-300">
                              Configure
                            </Button>
                          </div>
                        </div>
                        <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                <Globe className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-gray-900">Time Zone</h4>
                                <p className="text-sm text-gray-600">Set your preferred time zone for scheduling</p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="hover:bg-blue-50 hover:border-blue-300">
                              Update
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </MainLayout>
  );
} 