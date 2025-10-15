import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NotaryStampManager } from '@/components/user/notary-stamp-manager';
import { SignatureManager } from '@/components/user/signature-manager';
import { NotaryProfileDocumentManager } from '@/components/notary/NotaryProfileDocumentManager';
import { useToast } from '@/hooks/use-toast';
import { 
  Save,
  Edit,
  X,
  User,
  MapPin,
  Phone,
  Building,
  Shield,
  FileText,
  Award,
  Lock
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import TwoFactorAuth from '@/components/TwoFactorAuth';
import { useAuth } from '@/hooks/use-auth';

export default function Profile() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
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
    
    const handleNotaryProfileCompleted = (event: CustomEvent) => {
      console.log('Notary profile completed event received, refreshing profile data...');
      loadUserProfile();
    };
    
    window.addEventListener('notaryProfileCompleted', handleNotaryProfileCompleted as EventListener);
    
    return () => {
      window.removeEventListener('notaryProfileCompleted', handleNotaryProfileCompleted as EventListener);
    };
  }, []);

  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      return '';
    }
  };

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (token && user.id) {
        let profileData = null;
        if (user.role === 'notary' || user.role === 'admin') {
          try {
            const notaryResponse = await fetch(`/api/notary/profile/comprehensive?_t=${Date.now()}`, {
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
        
        if (!profileData) {
          const response = await fetch(`/api/users/${user.id}/profile?_t=${Date.now()}`, {
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
            
            address1: profileData.address1 || '',
            address2: profileData.address2 || '',
            city: profileData.city || '',
            state: profileData.state || '',
            zipCode: profileData.zipCode || '',
            
            title: profileData.title || 'Notary Public',
            nameOnCommission: profileData.nameOnCommission || '',
            commissionNumber: profileData.commissionNumber || '',
            commissionExpiration: formatDateForInput(profileData.commissionExpiration),
            county: profileData.county || '',
            disclosure: profileData.disclosure || 'I acknowledge that this document was signed before me on this date.',
            
            eoInsuranceCompany: profileData.eoInsuranceCompany || '',
            eoInsuranceAmount: profileData.eoInsuranceAmount || 0,
            eoInsuranceExpiration: formatDateForInput(profileData.eoInsuranceExpiration),
            
            bondCompanyName: profileData.bondCompanyName || '',
            bondAmount: profileData.bondAmount || 0,
            bondExpiration: formatDateForInput(profileData.bondExpiration),
            
            publicCertificateExpiration: formatDateForInput(profileData.publicCertificateExpiration),
            publicCertificatePassword: '',
            
            signingAgentCertified: profileData.signingAgentCertified || false,
            signingAgentExpirationDate: formatDateForInput(profileData.signingAgentExpirationDate),
            
            foreignLanguages: profileData.foreignLanguages || [],
            
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
          
          address1: '',
          address2: '',
          city: '',
          state: '',
          zipCode: '',
          
          title: 'Notary Public',
          nameOnCommission: '',
          commissionNumber: '',
          commissionExpiration: '',
          county: '',
          disclosure: 'I acknowledge that this document was signed before me on this date.',
          
          eoInsuranceCompany: '',
          eoInsuranceAmount: 0,
          eoInsuranceExpiration: '',
          
          bondCompanyName: '',
          bondAmount: 0,
          bondExpiration: '',
          
          publicCertificateExpiration: '',
          publicCertificatePassword: '',
          
          signingAgentCertified: false,
          signingAgentExpirationDate: '',
          
          foreignLanguages: [],
          
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

      const hasNotaryPrivileges = authUser?.role === 'notary' || (Array.isArray(authUser?.privileges) && authUser?.privileges.includes('notary'));
      if (hasNotaryPrivileges) {
        const notaryProfileData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          fullName: formData.fullName || (formData.firstName && formData.lastName ? `${formData.firstName} ${formData.lastName}`.trim() : undefined),
          phoneNumber: formData.phone,
          
          address1: formData.address1,
          address2: formData.address2,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          
          nameOnCommission: formData.nameOnCommission,
          commissionNumber: formData.commissionNumber,
          commissionExpiration: formData.commissionExpiration,
          county: formData.county,
          disclosure: formData.disclosure,
          
          eoInsuranceCompany: formData.eoInsuranceCompany,
          eoInsuranceAmount: formData.eoInsuranceAmount ? formData.eoInsuranceAmount * 100 : undefined,
          eoInsuranceExpiration: formData.eoInsuranceExpiration,
          
          bondCompanyName: formData.bondCompanyName,
          bondAmount: formData.bondAmount ? formData.bondAmount * 100 : undefined,
          bondExpiration: formData.bondExpiration,
          
          publicCertificateExpiration: formData.publicCertificateExpiration,
          publicCertificatePassword: formData.publicCertificatePassword,
          
          signingAgentCertified: formData.signingAgentCertified,
          signingAgentExpirationDate: formData.signingAgentCertified ? formData.signingAgentExpirationDate : null,
          
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
          const errText = await response.text();
          throw new Error(`Failed to update notary profile: ${errText}`);
        }

        await loadUserProfile();
        
      } else {
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
          const errText = await response.text();
          throw new Error(`Failed to update profile: ${errText}`);
        }

        await loadUserProfile();
      }

      setIsEditing(false);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully",
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

  const formatRole = (role: string) => {
    if (!role) return 'User';
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!currentUser) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-300 border-t-blue-600 mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">Loading profile...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const isNotary = currentUser?.role === 'notary' || currentUser?.role === 'admin';

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b pb-6 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between pt-6">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">Profile</h1>
              <p className="mt-1 text-sm text-gray-500">{currentUser.email}</p>
              <div className="mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                  {formatRole(currentUser.role)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      loadUserProfile();
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleSaveProfile}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Personal Information */}
          <Card>
            <CardHeader className="border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-gray-600" />
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Username</label>
                  <Input 
                    value={formData.username} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, username: e.target.value}))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <Input 
                    type="email" 
                    value={formData.email} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, email: e.target.value}))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">First Name</label>
                  <Input 
                    value={formData.firstName} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, firstName: e.target.value}))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                  <Input 
                    value={formData.lastName} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, lastName: e.target.value}))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Phone Number</label>
                  <Input 
                    type="tel" 
                    value={formData.phone} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, phone: e.target.value}))}
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader className="border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-gray-600" />
                <CardTitle className="text-lg">Address</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Address Line 1</label>
                  <Input 
                    value={formData.address1} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, address1: e.target.value}))}
                    className="h-10"
                    placeholder="Street address"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Address Line 2</label>
                  <Input 
                    value={formData.address2} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, address2: e.target.value}))}
                    className="h-10"
                    placeholder="Apartment, suite, etc. (optional)"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">City</label>
                  <Input 
                    value={formData.city} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, city: e.target.value}))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">State</label>
                  <Input 
                    value={formData.state} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, state: e.target.value}))}
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">ZIP Code</label>
                  <Input 
                    value={formData.zipCode} 
                    disabled={!isEditing} 
                    onChange={(e) => setFormData(p => ({...p, zipCode: e.target.value}))}
                    className="h-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notary Credentials */}
          {isNotary && (
            <>
              <Card>
                <CardHeader className="border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-gray-600" />
                    <CardTitle className="text-lg">Notary Commission</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Title</label>
                      <Input 
                        value={formData.title} 
                        disabled={!isEditing} 
                        onChange={(e) => setFormData(p => ({...p, title: e.target.value}))}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Name on Commission</label>
                      <Input 
                        value={formData.nameOnCommission} 
                        disabled={!isEditing} 
                        onChange={(e) => setFormData(p => ({...p, nameOnCommission: e.target.value}))}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Commission Number</label>
                      <Input 
                        value={formData.commissionNumber} 
                        disabled={!isEditing} 
                        onChange={(e) => setFormData(p => ({...p, commissionNumber: e.target.value}))}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Commission Expiration</label>
                      <Input 
                        type="date" 
                        value={formData.commissionExpiration} 
                        disabled={!isEditing} 
                        onChange={(e) => setFormData(p => ({...p, commissionExpiration: e.target.value}))}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">County</label>
                      <Input 
                        value={formData.county} 
                        disabled={!isEditing} 
                        onChange={(e) => setFormData(p => ({...p, county: e.target.value}))}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-gray-700">Default Disclosure Text</label>
                      <Textarea 
                        rows={3} 
                        value={formData.disclosure} 
                        disabled={!isEditing} 
                        onChange={(e) => setFormData(p => ({...p, disclosure: e.target.value}))}
                        className="resize-none"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <CardTitle className="text-lg">Insurance & Bond</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">E&O Insurance</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Company</label>
                          <Input 
                            value={formData.eoInsuranceCompany} 
                            disabled={!isEditing} 
                            onChange={(e) => setFormData(p => ({...p, eoInsuranceCompany: e.target.value}))}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Amount</label>
                          <Input 
                            type="number" 
                            value={formData.eoInsuranceAmount} 
                            disabled={!isEditing} 
                            onChange={(e) => setFormData(p => ({...p, eoInsuranceAmount: Number(e.target.value)}))}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Expiration</label>
                          <Input 
                            type="date" 
                            value={formData.eoInsuranceExpiration} 
                            disabled={!isEditing} 
                            onChange={(e) => setFormData(p => ({...p, eoInsuranceExpiration: e.target.value}))}
                            className="h-10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Bond Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Company</label>
                          <Input 
                            value={formData.bondCompanyName} 
                            disabled={!isEditing} 
                            onChange={(e) => setFormData(p => ({...p, bondCompanyName: e.target.value}))}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Amount</label>
                          <Input 
                            type="number" 
                            value={formData.bondAmount} 
                            disabled={!isEditing} 
                            onChange={(e) => setFormData(p => ({...p, bondAmount: Number(e.target.value)}))}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">Expiration</label>
                          <Input 
                            type="date" 
                            value={formData.bondExpiration} 
                            disabled={!isEditing} 
                            onChange={(e) => setFormData(p => ({...p, bondExpiration: e.target.value}))}
                            className="h-10"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-gray-600" />
                    <CardTitle className="text-lg">Digital Certificate & Signing Agent</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                          <Lock className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-blue-900 mb-1">
                              Digital Certificate Information
                            </h4>
                            <p className="text-xs text-blue-700 mb-3">
                              Upload your digital certificate in the Documents & Certificates section below. 
                              You'll be prompted to enter the expiration date and password during upload.
                            </p>
                            {formData.publicCertificateExpiration && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-blue-900">Expires:</span>
                                  <span className="text-blue-700">
                                    {new Date(formData.publicCertificateExpiration).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="font-medium text-blue-900">Password:</span>
                                  <span className="text-blue-700">••••••••</span>
                                  <span className="text-xs text-blue-600">(Set during upload)</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <input 
                          type="checkbox" 
                          id="nsa-certified"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" 
                          disabled={!isEditing} 
                          checked={formData.signingAgentCertified} 
                          onChange={(e) => setFormData(p => ({...p, signingAgentCertified: e.target.checked}))} 
                        />
                        <label htmlFor="nsa-certified" className="text-sm font-medium text-gray-700">
                          Certified Notary Signing Agent
                        </label>
                      </div>
                      {formData.signingAgentCertified && (
                        <div className="space-y-2 ml-7">
                          <label className="text-sm font-medium text-gray-700">NSA Expiration Date</label>
                          <Input 
                            type="date" 
                            value={formData.signingAgentExpirationDate} 
                            disabled={!isEditing} 
                            onChange={(e) => setFormData(p => ({...p, signingAgentExpirationDate: e.target.value}))}
                            className="h-10 max-w-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader className="border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <CardTitle className="text-lg">Documents & Certificates</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <NotaryProfileDocumentManager 
                    notaryId={currentUser.id} 
                    onDocumentsChange={loadUserProfile} 
                  />
                </CardContent>
              </Card>

              {/* Notary Stamp */}
              <Card>
                <CardHeader className="border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-gray-600" />
                    <CardTitle className="text-lg">Notary Stamp</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <NotaryStampManager notaryId={currentUser.id} />
                </CardContent>
              </Card>
            </>
          )}

          {/* Signatures */}
          <Card>
            <CardHeader className="border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-gray-600" />
                <CardTitle className="text-lg">Signatures</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <SignatureManager userId={currentUser.id} />
            </CardContent>
          </Card>

          {/* Security - Two-Factor Authentication */}
          <TwoFactorAuth />
        </div>
      </div>
    </MainLayout>
  );
}
