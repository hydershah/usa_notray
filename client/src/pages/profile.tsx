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
  User, 
  Save,
  Edit,
  Calendar,
  Hash,
  MapPin,
  FileText,
  Phone,
  Building,
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
    
    // Listen for notary profile completion events to refresh data
    const handleNotaryProfileCompleted = (event: CustomEvent) => {
      console.log('🔄 Notary profile completed event received, refreshing profile data...');
      loadUserProfile();
    };
    
    window.addEventListener('notaryProfileCompleted', handleNotaryProfileCompleted as EventListener);
    
    return () => {
      window.removeEventListener('notaryProfileCompleted', handleNotaryProfileCompleted as EventListener);
    };
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
            // Add cache-busting parameter to ensure fresh data
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
        
        // Fall back to basic profile if notary profile not available
        if (!profileData) {
          // Add cache-busting parameter to ensure fresh data
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

      // Use comprehensive notary profile API ONLY if user has notary privileges
      const hasNotaryPrivileges = authUser?.role === 'notary' || (Array.isArray(authUser?.privileges) && authUser?.privileges.includes('notary'));
      if (hasNotaryPrivileges) {
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
          const errText = await response.text();
          throw new Error(`Failed to update notary profile: ${errText}`);
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
          const errText = await response.text();
          throw new Error(`Failed to update profile: ${errText}`);
        }

        // Reload full profile to avoid partial response issues
        await loadUserProfile();
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
        <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-300 border-t-transparent mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">Loading your profile...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Profile</h1>
            <p className="text-sm text-gray-600">{currentUser.email}</p>
                    </div>
          <div className="flex items-center gap-2">
                  <Button 
              onClick={() => (isEditing ? handleSaveProfile() : setIsEditing(true))}
              variant={isEditing ? 'success' : 'default'}
                  >
                    {isEditing ? (
                      <>
                  <Save className="w-4 h-4 mr-2" /> Save
                      </>
                    ) : (
                      <>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                      </>
                    )}
                  </Button>
            </div>
          </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-6">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
                        <Input value={formData.username} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, username: e.target.value}))} />
                  </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                        <Input type="email" value={formData.email} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, email: e.target.value}))} />
                  </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">First Name</label>
                        <Input value={formData.firstName} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, firstName: e.target.value}))} />
                </div>
                  <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Last Name</label>
                        <Input value={formData.lastName} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, lastName: e.target.value}))} />
                  </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</label>
                        <Input type="tel" value={formData.phone} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, phone: e.target.value}))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><Building className="w-3 h-3" /> Address</label>
                        <Input value={formData.address} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, address: e.target.value}))} />
                  </div>
                </div>
              </CardContent>
            </Card>

                {/* Address Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Address Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 1</label>
                        <Input value={formData.address1} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, address1: e.target.value}))} />
                  </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 2</label>
                        <Input value={formData.address2} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, address2: e.target.value}))} />
                  </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                        <Input value={formData.city} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, city: e.target.value}))} />
                </div>
                  <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                        <Input value={formData.state} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, state: e.target.value}))} />
                  </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">ZIP Code</label>
                        <Input value={formData.zipCode} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, zipCode: e.target.value}))} />
                  </div>
                </div>
              </CardContent>
            </Card>

                    {(currentUser?.role === 'notary' || currentUser?.role === 'admin') && (
                      <>
                    {/* Notary Credentials */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Notary Credentials</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><Award className="w-3 h-3" /> Title</label>
                            <Input value={formData.title} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, title: e.target.value}))} />
                            </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Name on Commission</label>
                            <Input value={formData.nameOnCommission} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, nameOnCommission: e.target.value}))} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><Hash className="w-3 h-3" /> Commission Number</label>
                            <Input value={formData.commissionNumber} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, commissionNumber: e.target.value}))} />
                            </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Commission Expiration</label>
                            <Input type="date" value={formData.commissionExpiration} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, commissionExpiration: e.target.value}))} />
                            </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> State</label>
                            <Input value={formData.state} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, state: e.target.value}))} />
                            </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">County</label>
                            <Input value={formData.county} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, county: e.target.value}))} />
                            </div>
                            <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Default Disclosure Text</label>
                            <Textarea rows={3} value={formData.disclosure} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, disclosure: e.target.value}))} />
                            </div>
                          </div>
                      </CardContent>
                    </Card>


                    {/* Insurance & Bond */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Insurance & Bond</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">E&O Company</label>
                            <Input value={formData.eoInsuranceCompany} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, eoInsuranceCompany: e.target.value}))} />
                            </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">E&O Amount ($)</label>
                            <Input type="number" value={formData.eoInsuranceAmount} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, eoInsuranceAmount: Number(e.target.value)}))} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">E&O Expiration</label>
                            <Input type="date" value={formData.eoInsuranceExpiration} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, eoInsuranceExpiration: e.target.value}))} />
                            </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Bond Company</label>
                            <Input value={formData.bondCompanyName} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, bondCompanyName: e.target.value}))} />
                            </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Bond Amount ($)</label>
                            <Input type="number" value={formData.bondAmount} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, bondAmount: Number(e.target.value)}))} />
                            </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Bond Expiration</label>
                            <Input type="date" value={formData.bondExpiration} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, bondExpiration: e.target.value}))} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Digital Certificate & Signing Agent */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Digital Certificate & Signing Agent</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1"><Lock className="w-3 h-3" /> Certificate Expiration</label>
                            <Input type="date" value={formData.publicCertificateExpiration} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, publicCertificateExpiration: e.target.value}))} />
                            </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Certificate Password</label>
                            <Input type="password" value={formData.publicCertificatePassword} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, publicCertificatePassword: e.target.value}))} />
                          </div>
                          <div className="col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">NSA Certified</label>
                            <div className="flex items-center gap-2">
                              <input type="checkbox" className="h-4 w-4" disabled={!isEditing} checked={formData.signingAgentCertified} onChange={(e) => setFormData(p => ({...p, signingAgentCertified: e.target.checked}))} />
                                <span className="text-sm text-gray-700">Certified Notary Signing Agent</span>
                              </div>
                            </div>
                            {formData.signingAgentCertified && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">NSA Expiration</label>
                              <Input type="date" value={formData.signingAgentExpirationDate} disabled={!isEditing} onChange={(e) => setFormData(p => ({...p, signingAgentExpirationDate: e.target.value}))} />
                              </div>
                            )}
                          </div>
                      </CardContent>
                    </Card>
                      </>
                    )}
                {/* Security (visible to all roles) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Security</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Two-Factor Authentication
                      </label>
                      <TwoFactorAuth />
                        </div>
                  </CardContent>
                </Card>
              {/* Documents Section */}
              {(() => {
                const canSeeDocuments = currentUser?.role === 'notary' || currentUser?.role === 'admin' || currentUser?.role === 'title_company';
                return canSeeDocuments ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Documents
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <NotaryProfileDocumentManager notaryId={currentUser.id} onDocumentsChange={loadUserProfile} />
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              {/* Assets Section */}
              {(() => {
                const canSeeStamps = currentUser?.role === 'notary' || currentUser?.role === 'admin';
                const canSeeSignatures = currentUser?.role !== 'title_company';
                const showAssets = canSeeStamps || canSeeSignatures;
                return showAssets ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Hash className="w-4 h-4" /> Assets
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {canSeeStamps && (
                        <NotaryStampManager notaryId={currentUser.id} />
                      )}
                      {canSeeSignatures && (
                        <SignatureManager userId={currentUser.id} />
                      )}
                    </CardContent>
                  </Card>
                ) : null;
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
} 