import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  Home,
  Briefcase, 
  Plus, 
  Users, 
  Building, 
  User,
  Calendar,
  Settings,
  Shield,
  FileText,
  DollarSign,
  Mail,
  ChevronRight,
  ChevronDown,
  Activity,
  Star,
  Download,
  UserCheck,
  PenTool,
  CheckCircle,
  Award,
  Building2
} from 'lucide-react';
import { useState } from 'react';

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  roles: string[];
  badge?: number;
  description?: string;
  subsections?: MenuItem[];
}

// Simplified, clean navigation menu
const menuItems: MenuItem[] = [
  // Primary actions
  {
    id: 'create-job',
    label: 'create job',
    icon: Plus,
    path: '/create-job',
    roles: ['admin', 'title_company', 'notary'],
    description: 'Start a new notarization'
  },

  // Workflows
  {
    id: 'jobs',
    label: 'My Jobs',
    icon: Briefcase,
    path: '/jobs',
    roles: ['admin', 'title_company', 'notary', 'client'],
    description: 'Active & completed jobs'
  },
  {
    id: 'signing-jobs',
    label: 'Dashboard',
    icon: Home,
    path: '/dashboard',
    roles: ['signer', 'witness'],
    description: 'Your signing assignments'
  },
  {
    id: 'job-requests',
    label: 'Job Requests',
    icon: FileText,
    path: '/job-request',
    roles: ['signer', 'client'],
    description: 'Request notarization services'
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    path: '/calendar',
    roles: ['admin', 'notary'],
    description: 'Schedule & appointments'
  },

  // Personal
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: '/admin-dashboard',
    roles: ['admin', 'title_company', 'notary', 'client'],
    description: 'Your main workspace'
  },
  {
    id: 'profile',
    label: 'My Profile',
    icon: User,
    path: '/profile',
    roles: ['admin', 'title_company', 'notary', 'client', 'signer', 'witness'],
    description: 'Profile, signatures & stamps'
  },
  {
    id: 'id-verification',
    label: 'ID Verification',
    icon: UserCheck,
    path: '/id-verification',
    roles: ['signer', 'witness', 'client'],
    description: 'Identity verification and KYC'
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: DollarSign,
    path: '/payments',
    roles: ['admin', 'title_company', 'notary'],
    description: 'Billing & financials'
  },

  // Admin (Simplified)
  {
    id: 'admin',
    label: 'Admin',
    icon: Settings,
    path: '/admin',
    roles: ['admin', 'title_company'],
    description: 'Administration and settings',
    subsections: [
      // Core Management
      {
        id: 'admin-overview',
        label: 'Overview',
        icon: Activity,
        path: '/dashboard',
        roles: ['admin'],
        description: 'System overview and statistics'
      },
      {
        id: 'approvals-hub',
        label: 'Approvals',
        icon: Activity,
        path: '/admin/approvals-hub',
        roles: ['admin'],
        description: 'Centralized approvals dashboard'
      },
      {
        id: 'user-management',
        label: 'Users',
        icon: Users,
        path: '/admin/users',
        roles: ['admin'],
        description: 'Manage user accounts'
      },
      {
        id: 'notary-management',
        label: 'Notaries',
        icon: Award,
        path: '/admin/notaries',
        roles: ['admin'],
        description: 'Notary management and assignments'
      },
      {
        id: 'title-companies',
        label: 'Title Companies',
        icon: Building2,
        path: '/admin/companies',
        roles: ['admin'],
        description: 'Title company management'
      },
      {
        id: 'admin-job-requests',
        label: 'Job Requests',
        icon: FileText,
        path: '/admin/job-requests',
        roles: ['admin'],
        description: 'Review signer job requests'
      },
      {
        id: 'verification',
        label: 'KYC/KBA',
        icon: Shield,
        path: '/admin/verification',
        roles: ['admin'],
        description: 'Identity verification management'
      },
      {
        id: 'banned-users',
        label: 'Banned Users',
        icon: Shield,
        path: '/admin/banned-users',
        roles: ['admin'],
        description: 'View and unlock temporarily banned users'
      },
      {
        id: 'system-logs',
        label: 'System Logs',
        icon: Activity,
        path: '/admin/logs',
        roles: ['admin'],
        description: 'System audit logs'
      },
      {
        id: 'closing-types',
        label: 'Closing Types',
        icon: FileText,
        path: '/closing-types',
        roles: ['admin'],
        description: 'Configure closing types'
      },
      {
        id: 'email-settings',
        label: 'Email Settings',
        icon: Mail,
        path: '/email-settings',
        roles: ['admin'],
        description: 'Email configuration'
      }
    ]
  }
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const filteredMenuItems = menuItems.filter(item => {
    const userRole = user?.role || '';
    const isAdmin = user?.isAdmin || user?.role === 'admin';
    const isNotary = user?.isNotary || user?.role === 'notary';
    
    // Only show create job for subscriber notaries or admins/title companies
    if (item.id === 'create-job') {
      return isAdmin || 
             userRole === 'title_company' || 
             (isNotary && user?.notaryType === 'subscriber');
    }

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

  const renderMenuItem = (item: MenuItem, level = 0) => {
    const Icon = item.icon;
    const isActive = location === item.path;
    const hasSubsections = item.subsections && item.subsections.length > 0;
    const isExpanded = expandedSections.includes(item.id);
    
    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (hasSubsections) {
              toggleSection(item.id);
            } else {
              setLocation(item.path);
            }
          }}
          className={cn(
            "group flex items-center justify-between w-full p-3 text-sm font-medium rounded-xl transition-all duration-300 hover:shadow-md",
            level > 0 && "ml-6 border-l-2 border-gray-200 pl-4",
            isActive && !hasSubsections
              ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm border border-blue-200/50"
              : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900",
            hasSubsections && isExpanded && "bg-gray-50"
          )}
          title={item.description}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-all duration-300",
              isActive && !hasSubsections
                ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md transform scale-110" 
                : "bg-gray-100 text-gray-500 group-hover:bg-white group-hover:text-gray-700 group-hover:shadow-sm",
              level > 0 && "p-1.5"
            )}>
              <Icon className={cn("h-4 w-4", level > 0 && "h-3 w-3")} />
            </div>
            <div className="text-left flex-1">
              <span className="block font-medium text-sm">{item.label}</span>
              {item.description && level === 0 && (
                <span className="text-xs text-gray-500 block mt-1 leading-relaxed">{item.description}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {item.badge && (
              <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                {item.badge}
              </span>
            )}
            {hasSubsections ? (
              <ChevronDown className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                isExpanded && "rotate-180"
              )} />
            ) : isActive && (
              <ChevronRight className="h-4 w-4 text-blue-600 animate-pulse" />
            )}
          </div>
        </button>
        
        {/* Subsections */}
        {hasSubsections && isExpanded && (
          <div className="mt-2 space-y-1">
            {item.subsections!.filter(sub => {
              const userRole = user?.role || '';
              const isAdmin = user?.isAdmin || user?.role === 'admin';
              return sub.roles.some(requiredRole => {
                switch (requiredRole) {
                  case 'admin':
                    return isAdmin;
                  default:
                    return userRole === requiredRole;
                }
              });
            }).map(subItem => renderMenuItem(subItem, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="w-80 bg-white/95 backdrop-blur-sm h-screen sticky top-0 border-r border-gray-200/50 overflow-y-auto shadow-lg">
      <div className="h-full flex flex-col p-6 space-y-8">
        {/* Flat navigation list (no section headers) */}
        <div className="flex-1 space-y-2">
          {filteredMenuItems.map(item => renderMenuItem(item))}
        </div>
        
        {/* Footer */}
        <div className="mt-auto">
          <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-gray-600">System Online</span>
              </div>
              <p className="text-xs text-gray-500 font-medium">© 2024 Digital Notarization</p>
              <p className="text-xs text-gray-400">Professional Platform</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
