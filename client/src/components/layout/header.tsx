import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import { 
  IdCard, 
  Bell, 
  ChevronDown, 
  User, 
  LogOut, 
  Settings,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Zap
} from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    console.log('Logout initiated');
    try {
      await logout();
      console.log('Logout completed successfully');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Force a hard redirect to login page to ensure clean navigation
      window.location.href = '/login';
    }
  };

  // Mock notifications - in real app, these would come from API
  const notifications = [
    {
      id: 1,
      type: 'pending',
      title: 'New job assignment',
      message: 'Job #123 has been assigned to you',
      time: '5 minutes ago',
      icon: Clock,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-200'
    },
    {
      id: 2,
      type: 'success',
      title: 'Job completed',
      message: 'Job #121 has been successfully completed',
      time: '1 hour ago',
      icon: CheckCircle,
      iconColor: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200'
    },
    {
      id: 3,
      type: 'alert',
      title: 'Document verification required',
      message: 'Please verify documents for Job #124',
      time: '2 hours ago',
      icon: AlertCircle,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50 border-red-200'
    }
  ];

  return (
    <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-200/50 sticky top-0 z-50">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="relative">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 via-purple-500 to-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                <IdCard className="h-5 w-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                USA Notary
              </h1>
              <p className="text-xs font-medium text-gray-500">Digital Notarization Platform</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* System Status Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-green-700">System Online</span>
            </div>

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative hover:bg-gray-100 hover:scale-105 transition-all duration-200 rounded-xl"
                >
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold animate-pulse shadow-lg">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-96 border-0 shadow-xl bg-white/95 backdrop-blur-sm">
                <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-gray-600" />
                    <span className="font-semibold text-gray-900">Notifications</span>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    {notifications.length} New
                  </Badge>
                </DropdownMenuLabel>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((notification) => {
                    const Icon = notification.icon;
                    return (
                      <DropdownMenuItem key={notification.id} className="p-4 cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        <div className="flex gap-4 w-full">
                          <div className={`p-2 rounded-lg ${notification.bgColor} flex-shrink-0`}>
                            <Icon className={`h-5 w-5 ${notification.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 mb-1">{notification.title}</p>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{notification.message}</p>
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <p className="text-xs text-gray-400">{notification.time}</p>
                            </div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </div>
                <div className="border-t border-gray-100 p-2">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-center text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium"
                  >
                    View all notifications
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="flex items-center space-x-3 hover:bg-gray-100 px-3 py-2 rounded-xl transition-all duration-200 hover:shadow-md"
                >
                  <Avatar className="h-9 w-9 border-2 border-gray-200 shadow-md">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold text-gray-700">{user?.username}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
                      {user?.role === 'admin' && (
                        <Sparkles className="h-3 w-3 text-amber-500" />
                      )}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500 transition-transform duration-200" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 border-0 shadow-xl bg-white/95 backdrop-blur-sm">
                <DropdownMenuLabel className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border-2 border-gray-200">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                        {user?.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{user?.username}</p>
                      <p className="text-xs text-gray-500">{user?.email || 'user@example.com'}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                          {user?.role?.replace('_', ' ')}
                        </Badge>
                        {user?.role === 'admin' && (
                          <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </DropdownMenuLabel>
                
                <div className="py-2">
                  <DropdownMenuItem 
                    onClick={() => setLocation('/profile')} 
                    className="cursor-pointer px-4 py-2.5 hover:bg-gray-50 transition-colors duration-200"
                  >
                    <User className="mr-3 h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Profile & Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer px-4 py-2.5 hover:bg-gray-50 transition-colors duration-200">
                    <Settings className="mr-3 h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Preferences</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer px-4 py-2.5 hover:bg-gray-50 transition-colors duration-200">
                    <HelpCircle className="mr-3 h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">Help & Support</span>
                  </DropdownMenuItem>
                </div>
                
                <DropdownMenuSeparator className="bg-gray-100" />
                
                <div className="py-2">
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="cursor-pointer px-4 py-2.5 text-red-600 hover:bg-red-50 hover:text-red-700 focus:text-red-600 transition-colors duration-200"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    <span className="text-sm font-medium">Logout</span>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
