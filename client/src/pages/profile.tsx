import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignatureManager } from '@/components/user/signature-manager';
import { NotaryStampManager } from '@/components/user/notary-stamp-manager';
import { toast } from '@/hooks/use-toast';
import { 
  User, 
  Mail, 
  Shield, 
  FileSignature, 
  Stamp,
  Settings,
  Save,
  Edit,
  Calendar,
  Hash,
  MapPin,
  FileText
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

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
        // Load full profile from new endpoint
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
      // Fallback to localStorage
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
          phoneNumber: formData.phone // Map phone to phoneNumber
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const updatedUser = await response.json();
      
      // Update both state and localStorage
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
        return 'bg-red-100 text-red-800';
      case 'notary':
        return 'bg-blue-100 text-blue-800';
      case 'title_company':
        return 'bg-green-100 text-green-800';
      case 'client':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatRole = (role: string) => {
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!currentUser) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-600 mt-2">Loading profile...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Profile Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {currentUser.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{currentUser.username}</h1>
                  <p className="text-gray-600">{currentUser.email}</p>
                  <Badge className={getRoleBadgeColor(currentUser.role)}>
                    {formatRole(currentUser.role)}
                  </Badge>
                </div>
              </div>
              <Button 
                variant={isEditing ? "default" : "outline"}
                onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
              >
                {isEditing ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Main Content */}
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="signatures">
              <FileSignature className="w-4 h-4 mr-2" />
              Signatures
            </TabsTrigger>
            {(currentUser.role === 'notary' || currentUser.role === 'admin') && (
              <TabsTrigger value="stamps">
                <Stamp className="w-4 h-4 mr-2" />
                Notary Stamps
              </TabsTrigger>
            )}
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Username</label>
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">First Name</label>
                    <Input
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Last Name</label>
                    <Input
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone</label>
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Address</label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                {/* Notary Information - Only show for notary and admin roles */}
                {(currentUser.role === 'notary' || currentUser.role === 'admin') && (
                  <div className="pt-6 border-t">
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <Shield className="w-5 h-5 mr-2 text-blue-500" />
                      Notary Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center">
                          <User className="w-4 h-4 mr-1" />
                          Title
                        </label>
                        <Input
                          value={formData.title}
                          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                          disabled={!isEditing}
                          placeholder="Notary Public"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center">
                          <Hash className="w-4 h-4 mr-1" />
                          Commission Number
                        </label>
                        <Input
                          value={formData.commissionNumber}
                          onChange={(e) => setFormData(prev => ({ ...prev, commissionNumber: e.target.value }))}
                          disabled={!isEditing}
                          placeholder="NC123456"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          Commission Expiration
                        </label>
                        <Input
                          type="date"
                          value={formData.commissionExpiration}
                          onChange={(e) => setFormData(prev => ({ ...prev, commissionExpiration: e.target.value }))}
                          disabled={!isEditing}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          State
                        </label>
                        <Input
                          value={formData.state}
                          onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                          disabled={!isEditing}
                          placeholder="California"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2 flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          County
                        </label>
                        <Input
                          value={formData.county}
                          onChange={(e) => setFormData(prev => ({ ...prev, county: e.target.value }))}
                          disabled={!isEditing}
                          placeholder="Los Angeles County"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2 flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          Default Disclosure Text
                        </label>
                        <Textarea
                          value={formData.disclosure}
                          onChange={(e) => setFormData(prev => ({ ...prev, disclosure: e.target.value }))}
                          disabled={!isEditing}
                          rows={3}
                          placeholder="I acknowledge that this document was signed before me on this date."
                          className="resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          This text will be used when you add a disclosure to documents
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Account Status */}
                <div className="pt-6 border-t">
                  <h3 className="text-lg font-medium mb-4">Account Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-5 h-5 text-green-500" />
                      <span className="text-sm">Account Verified</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Mail className="w-5 h-5 text-green-500" />
                      <span className="text-sm">Email Confirmed</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="w-5 h-5 text-blue-500" />
                      <span className="text-sm">Profile Complete</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Signatures Tab */}
          <TabsContent value="signatures">
            <SignatureManager userId={currentUser.id} />
          </TabsContent>

          {/* Notary Stamps Tab */}
          {(currentUser.role === 'notary' || currentUser.role === 'admin') && (
            <TabsContent value="stamps">
              <NotaryStampManager notaryId={currentUser.id} />
            </TabsContent>
          )}

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Security Settings</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Two-Factor Authentication</h4>
                        <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Enable 2FA
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Change Password</h4>
                        <p className="text-sm text-gray-600">Update your account password</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Change Password
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <h3 className="text-lg font-medium mb-4">Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Email Notifications</h4>
                        <p className="text-sm text-gray-600">Receive updates about your jobs and documents</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Configure
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Time Zone</h4>
                        <p className="text-sm text-gray-600">Set your preferred time zone for scheduling</p>
                      </div>
                      <Button variant="outline" size="sm">
                        Update
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
} 