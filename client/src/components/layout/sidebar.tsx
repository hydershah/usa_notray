import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  BarChart3, 
  Briefcase, 
  Plus, 
  Users, 
  Building, 
  UserCog, 
  FileText,
  DollarSign,
  Settings,
  User,
  Mail,
  ChevronRight,
  Home,
  Calendar,
  Sparkles,
  Shield,
  Activity
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  roles: string[];
  badge?: number;
  section?: string;
  description?: string;
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: '/dashboard',
    roles: ['admin', 'title_company', 'notary', 'client'],
    section: 'main',
    description: 'Overview and analytics'
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: Briefcase,
    path: '/jobs',
    roles: ['admin', 'title_company', 'notary', 'client'],
    section: 'main',
    description: 'Manage notarization orders'
  },
  {
    id: 'create-job',
    label: 'Create Job',
    icon: Plus,
    path: '/create-job',
    roles: ['admin', 'title_company', 'notary'],
    section: 'main',
    description: 'Start new notarization'
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    path: '/calendar',
    roles: ['admin', 'notary'],
    section: 'main',
    description: 'Schedule appointments'
  },
  {
    id: 'profile',
    label: 'Profile & Signatures',
    icon: User,
    path: '/profile',
    roles: ['admin', 'title_company', 'notary', 'client'],
    section: 'account',
    description: 'Manage your account'
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: DollarSign,
    path: '/payments',
    roles: ['admin', 'title_company', 'notary'],
    section: 'account',
    description: 'Financial management'
  },
  {
    id: 'notary-management',
    label: 'Notary Management',
    icon: Shield,
    path: '/notary-management',
    roles: ['admin'],
    section: 'admin',
    description: 'Manage notary assignments'
  },
  {
    id: 'title-companies',
    label: 'Title Companies',
    icon: Building,
    path: '/title-companies',
    roles: ['admin'],
    section: 'admin',
    description: 'Company registrations'
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: UserCog,
    path: '/user-management',
    roles: ['admin'],
    section: 'admin',
    description: 'User accounts & roles'
  },
  {
    id: 'closing-types',
    label: 'Closing Types',
    icon: Settings,
    path: '/closing-types',
    roles: ['admin'],
    section: 'admin',
    description: 'Configure closing types'
  },
  {
    id: 'email-settings',
    label: 'Email Settings',
    icon: Mail,
    path: '/email-settings',
    roles: ['admin'],
    section: 'admin',
    description: 'Email configuration'
  },
  {
    id: 'email-templates',
    label: 'Email Templates',
    icon: Mail,
    path: '/email-templates',
    roles: ['admin'],
    section: 'admin',
    description: 'Template management'
  },
  {
    id: 'logs',
    label: 'Notarization Logs',
    icon: FileText,
    path: '/logs',
    roles: ['admin', 'notary'],
    section: 'records',
    description: 'Audit logs & records'
  }
];

const sectionTitles: Record<string, { title: string; icon: any; color: string }> = {
  main: { 
    title: 'Main', 
    icon: Activity, 
    color: 'from-blue-500 to-blue-600' 
  },
  account: { 
    title: 'Account', 
    icon: User, 
    color: 'from-green-500 to-green-600' 
  },
  admin: { 
    title: 'Administration', 
    icon: Shield, 
    color: 'from-purple-500 to-purple-600' 
  },
  records: { 
    title: 'Records', 
    icon: FileText, 
    color: 'from-amber-500 to-orange-500' 
  }
};

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const filteredMenuItems = menuItems.filter(item => {
    const userRole = user?.role || '';
    const isAdmin = user?.isAdmin || user?.role === 'admin';
    const isNotary = user?.isNotary || user?.role === 'notary';
    
    // Special handling for create job - only show for subscriber notaries or admins/title companies
    if (item.id === 'create-job') {
      return isAdmin || 
             userRole === 'title_company' || 
             (isNotary && user?.notaryType === 'subscriber');
    }
    
    // Check if user has the required role/privileges for this menu item
    return item.roles.some(requiredRole => {
      switch (requiredRole) {
        case 'admin':
          return isAdmin;
        case 'notary':
          return isNotary;
        default:
          return userRole === requiredRole;
      }
    });
  });

  // Group items by section
  const groupedItems = filteredMenuItems.reduce((acc, item) => {
    const section = item.section || 'main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <nav className="w-80 bg-white/95 backdrop-blur-sm h-screen sticky top-0 border-r border-gray-200/50 overflow-y-auto shadow-lg">
      <div className="h-full flex flex-col p-6 space-y-8">
        {/* User Info Card */}
        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-semibold text-sm">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.username}</p>
              <div className="flex items-center gap-1">
                <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</p>
                {user?.role === 'admin' && (
                  <Sparkles className="h-3 w-3 text-amber-500" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 space-y-8">
          {Object.entries(groupedItems).map(([section, items]) => {
            const sectionInfo = sectionTitles[section];
            const SectionIcon = sectionInfo.icon;
            
            return (
              <div key={section} className="space-y-3">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className={`p-1.5 bg-gradient-to-br ${sectionInfo.color} rounded-lg shadow-md`}>
                    <SectionIcon className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                    {sectionInfo.title}
                  </h3>
                </div>
                
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => setLocation(item.path)}
                          className={cn(
                            "group flex items-center justify-between w-full p-3 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-md",
                            isActive
                              ? "bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 shadow-sm border border-blue-200/50"
                              : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900"
                          )}
                          title={item.description}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-lg transition-all duration-300",
                              isActive 
                                ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md transform scale-110" 
                                : "bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-gray-700 group-hover:shadow-sm"
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="text-left flex-1">
                              <span className="block font-medium text-sm">{item.label}</span>
                              {item.description && (
                                <span className="text-xs text-gray-500 block mt-1 leading-relaxed">{item.description}</span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {item.badge && (
                              <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                                {item.badge}
                              </span>
                            )}
                            {isActive && (
                              <ChevronRight className="h-4 w-4 text-blue-600 animate-pulse" />
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        
        {/* Enhanced Footer */}
        <div className="mt-auto">
          <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-3 shadow-sm">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-gray-600">System Status</span>
              </div>
              <p className="text-xs text-gray-500">© 2024 USA Notary</p>
              <p className="text-xs text-gray-400">All systems operational</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
