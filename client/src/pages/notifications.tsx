import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell,
  Check,
  Clock,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  User,
  FileText,
  Calendar,
  Mail,
  Settings,
  Filter,
  MoreVertical,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface Notification {
  id: number;
  type: 'job_update' | 'system' | 'reminder' | 'alert' | 'message';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'medium' | 'high';
  category: string;
  actionUrl?: string;
  actionText?: string;
  jobId?: number;
  fromUser?: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterRead, setFilterRead] = useState('all');
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);

  // Mock data - replace with actual API call
  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return mockNotifications;
    }
  });

  const mockNotifications: Notification[] = [
    {
      id: 1,
      type: 'job_update',
      title: 'Signing Session Scheduled',
      message: 'Your signing session for ABC Title Company has been scheduled for tomorrow at 2:00 PM.',
      timestamp: '2024-01-15T10:30:00Z',
      read: false,
      priority: 'high',
      category: 'Scheduling',
      actionUrl: '/signing-jobs',
      actionText: 'View Details',
      jobId: 123
    },
    {
      id: 2,
      type: 'reminder',
      title: 'ID Verification Required',
      message: 'Please complete your identity verification to proceed with upcoming signing sessions.',
      timestamp: '2024-01-15T09:15:00Z',
      read: false,
      priority: 'medium',
      category: 'Verification',
      actionUrl: '/id-verification',
      actionText: 'Complete Verification'
    },
    {
      id: 3,
      type: 'system',
      title: 'Profile Update Successful',
      message: 'Your profile information has been successfully updated.',
      timestamp: '2024-01-14T16:45:00Z',
      read: true,
      priority: 'low',
      category: 'Account'
    },
    {
      id: 4,
      type: 'job_update',
      title: 'Document Ready for Signing',
      message: 'Documents for XYZ Real Estate closing are now ready for your signature.',
      timestamp: '2024-01-14T14:20:00Z',
      read: false,
      priority: 'high',
      category: 'Signing',
      actionUrl: '/signing-jobs',
      actionText: 'Sign Documents',
      jobId: 124
    },
    {
      id: 5,
      type: 'alert',
      title: 'Signing Session Completed',
      message: 'You have successfully completed the signing session for DEF Title Company.',
      timestamp: '2024-01-13T11:30:00Z',
      read: true,
      priority: 'medium',
      category: 'Completion',
      actionUrl: '/my-documents',
      actionText: 'View Documents'
    },
    {
      id: 6,
      type: 'message',
      title: 'Message from Notary',
      message: 'The notary has left a message regarding your upcoming appointment.',
      timestamp: '2024-01-13T08:15:00Z',
      read: false,
      priority: 'medium',
      category: 'Communication',
      fromUser: 'John Smith (Notary)'
    }
  ];

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || notification.type === filterType;
    const matchesRead = filterRead === 'all' || 
                       (filterRead === 'read' && notification.read) ||
                       (filterRead === 'unread' && !notification.read);
    
    return matchesSearch && matchesType && matchesRead;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (notificationId: number) => {
    // API call to mark as read
    console.log('Marking notification as read:', notificationId);
  };

  const handleMarkAllAsRead = async () => {
    // API call to mark all as read
    console.log('Marking all notifications as read');
  };

  const handleDeleteSelected = async () => {
    // API call to delete selected notifications
    console.log('Deleting notifications:', selectedNotifications);
    setSelectedNotifications([]);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'job_update': return <FileText className="w-4 h-4" />;
      case 'reminder': return <Clock className="w-4 h-4" />;
      case 'alert': return <AlertCircle className="w-4 h-4" />;
      case 'system': return <Settings className="w-4 h-4" />;
      case 'message': return <Mail className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {unreadCount} new
                </Badge>
              )}
            </h1>
            <p className="text-gray-600 mt-1">Stay updated with job alerts, system updates, and important messages</p>
          </div>
          
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllAsRead} variant="outline" size="sm">
                <Check className="w-4 h-4 mr-2" />
                Mark All Read
              </Button>
            )}
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-xl font-semibold">{notifications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Unread</p>
                  <p className="text-xl font-semibold">{unreadCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">High Priority</p>
                  <p className="text-xl font-semibold">
                    {notifications.filter(n => n.priority === 'high').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Job Updates</p>
                  <p className="text-xl font-semibold">
                    {notifications.filter(n => n.type === 'job_update').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="job_update">Job Updates</SelectItem>
                  <SelectItem value="reminder">Reminders</SelectItem>
                  <SelectItem value="alert">Alerts</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="message">Messages</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filterRead} onValueChange={setFilterRead}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>

              {selectedNotifications.length > 0 && (
                <Button 
                  onClick={handleDeleteSelected} 
                  variant="destructive" 
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete ({selectedNotifications.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading notifications...
            </div>
          ) : filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
                <p className="text-gray-600">
                  {searchTerm || filterType !== 'all' || filterRead !== 'all' 
                    ? 'Try adjusting your filters or search terms.'
                    : 'You\'re all caught up! New notifications will appear here.'
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card 
                key={notification.id} 
                className={`transition-all hover:shadow-md ${
                  !notification.read ? 'border-blue-200 bg-blue-50/30' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedNotifications.includes(notification.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedNotifications([...selectedNotifications, notification.id]);
                        } else {
                          setSelectedNotifications(selectedNotifications.filter(id => id !== notification.id));
                        }
                      }}
                    />
                    
                    <div className={`p-2 rounded-lg ${getPriorityColor(notification.priority)}`}>
                      {getTypeIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {notification.category}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(notification.timestamp)}
                          </span>
                          {!notification.read && (
                            <Button
                              onClick={() => handleMarkAsRead(notification.id)}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                            >
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-3">
                        {notification.message}
                      </p>
                      
                      {notification.fromUser && (
                        <p className="text-xs text-gray-500 mb-2">
                          From: {notification.fromUser}
                        </p>
                      )}
                      
                      {notification.actionUrl && notification.actionText && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.location.href = notification.actionUrl!}
                        >
                          {notification.actionText}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
} 