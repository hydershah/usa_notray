import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotaryStampManager } from '@/components/user/notary-stamp-manager';
import { SignatureManager } from '@/components/user/signature-manager';
import { toast } from '@/hooks/use-toast';
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    // Notary specific fields
    title: '',
    commissionNumber: '',
    commissionExpiration: '',
    state: '',
    county: '',
    disclosure: ''
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (token && user.id) {
        const response = await fetch(`/api/users/${user.id}/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const profileData = await response.json();
          setCurrentUser(profileData);
          setFormData({
            username: profileData.username || '',
            email: profileData.email || '',
            firstName: profileData.firstName || '',
            lastName: profileData.lastName || '',
            phone: profileData.phoneNumber || '',
            address: profileData.address || '',
            title: profileData.title || 'Notary Public',
            commissionNumber: profileData.commissionNumber || '',
            commissionExpiration: profileData.commissionExpiration || '',
            state: profileData.state || '',
            county: profileData.county || '',
            disclosure: profileData.disclosure || 'I acknowledge that this document was signed before me on this date.'
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
          phone: user.phone || '',
          address: user.address || '',
          title: 'Notary Public',
          commissionNumber: '',
          commissionExpiration: '',
          state: '',
          county: '',
          disclosure: 'I acknowledge that this document was signed before me on this date.'
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
                      <Badge className={`${getRoleBadgeColor(currentUser.role)} px-4 py-2 text-sm font-medium`}>
                        {formatRole(currentUser.role)}
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
                  (currentUser.isNotary || currentUser.role === 'notary' || currentUser.role === 'admin') ? 'grid-cols-4' : 
                  (currentUser.role === 'title_company') ? 'grid-cols-2' : 'grid-cols-3'
                }`}>
                  <TabsTrigger 
                    value="profile" 
                    className="flex items-center gap-2 h-12 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 rounded-xl transition-all duration-200"
                  >
                    <User className="w-5 h-5" />
                    Profile
                  </TabsTrigger>
                  {(currentUser.isNotary || currentUser.role === 'notary' || currentUser.role === 'admin') && (
                    <TabsTrigger 
                      value="stamps" 
                      className="flex items-center gap-2 h-12 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 rounded-xl transition-all duration-200"
                    >
                      <Stamp className="w-5 h-5" />
                      Notary Stamps
                    </TabsTrigger>
                  )}
                  {currentUser.role !== 'title_company' && (
                    <TabsTrigger 
                      value="signatures" 
                      className="flex items-center gap-2 h-12 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-blue-600 rounded-xl transition-all duration-200"
                    >
                      <Pencil className="w-5 h-5" />
                      Signatures
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

                    {/* Enhanced Notary Information Section */}
                    {(currentUser.isNotary || currentUser.role === 'notary' || currentUser.role === 'admin') && (
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-100">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="text-2xl font-bold text-gray-900">Notary Information</h3>
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
                          <div className="md:col-span-2">
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
                {(currentUser.isNotary || currentUser.role === 'notary' || currentUser.role === 'admin') && (
                  <TabsContent value="stamps">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                      <NotaryStampManager notaryId={currentUser.id} />
                    </div>
                  </TabsContent>
                )}

                {/* Signatures Tab */}
                {currentUser.role !== 'title_company' && (
                  <TabsContent value="signatures">
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 border border-purple-100">
                      <SignatureManager userId={currentUser.id} />
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