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
  Search,
  Star,
  Clock,
  AlertCircle,
  CheckCircle,
  Award,
  Zap,
  BarChart3,
  Bell,
  HelpCircle,
  Download,
  Clipboard,
  UserCheck,
  PenTool
} from 'lucide-react';
import { useState } from 'react';

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  roles: string[];
  badge?: number;
  section?: string;
  description?: string;
  subsections?: MenuItem[];
}

// Much more streamlined and intuitive menu structure
const menuItems: MenuItem[] = [
  // Core Work Area
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: Home,
    path: '/dashboard',
    roles: ['admin', 'title_company', 'notary', 'client', 'signer', 'witness'],
    section: 'work',
    description: 'Your main workspace'
  },
  {
    id: 'jobs',
    label: 'My Jobs',
    icon: Briefcase,
    path: '/jobs',
    roles: ['admin', 'title_company', 'notary', 'client'],
    section: 'work',
    description: 'Active & completed jobs'
  },
  {
    id: 'signing-jobs',
    label: 'My Signing Jobs',
    icon: PenTool,
    path: '/signing-jobs',
    roles: ['signer', 'witness'],
    section: 'work',
    description: 'Your signing assignments'
  },
  {
    id: 'job-requests',
    label: 'Job Requests',
    icon: FileText,
    path: '/job-request',
    roles: ['signer', 'client'],
    section: 'work',
    description: 'Request notarization services'
  },
  {
    id: 'create-job',
    label: 'New Job',
    icon: Plus,
    path: '/create-job',
    roles: ['admin', 'title_company', 'notary'],
    section: 'work',
    description: 'Start a new notarization'
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    path: '/calendar',
    roles: ['admin', 'notary'],
    section: 'work',
    description: 'Schedule & appointments'
  },
  
  // Personal & Account
  {
    id: 'profile',
    label: 'My Profile',
    icon: User,
    path: '/profile',
    roles: ['admin', 'title_company', 'notary', 'client', 'signer', 'witness'],
    section: 'personal',
    description: 'Profile, signatures & stamps'
  },
  {
    id: 'my-documents',
    label: 'My Documents',
    icon: Download,
    path: '/my-documents',
    roles: ['signer', 'witness', 'client', 'notary'],
    section: 'personal',
    description: 'Your signed documents and downloads'
  },
  {
    id: 'id-verification',
    label: 'ID Verification',
    icon: UserCheck,
    path: '/id-verification',
    roles: ['signer', 'witness', 'client'],
    section: 'personal',
    description: 'Identity verification and KYC'
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: DollarSign,
    path: '/payments',
    roles: ['admin', 'title_company', 'notary'],
    section: 'personal',
    description: 'Billing & financials'
  },
  {
    id: 'my-logs',
    label: 'My Records',
    icon: FileText,
    path: '/my-logs',
    roles: ['admin', 'title_company', 'notary', 'client', 'signer', 'witness'],
    section: 'personal',
    description: 'Your notarization history'
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    path: '/notifications',
    roles: ['signer', 'witness', 'client', 'notary', 'admin'],
    section: 'personal',
    description: 'Job updates and alerts'
  },
  

  
  // Management (Admin/Title Company)
  {
    id: 'management',
    label: 'Management',
    icon: Settings,
    path: '/management',
    roles: ['admin', 'title_company'],
    section: 'management',
    description: 'System management',
    subsections: [
      {
        id: 'admin-overview',
        label: 'Overview',
        icon: BarChart3,
        path: '/dashboard',
        roles: ['admin'],
        description: 'System overview and statistics'
      },
      {
        id: 'approvals',
        label: 'Approvals',
        icon: CheckCircle,
        path: '/admin/approvals',
        roles: ['admin'],
        description: 'User and company approvals'
      },
      {
        id: 'job-requests',
        label: 'Job Requests',
        icon: FileText,
        path: '/admin/job-requests',
        roles: ['admin'],
        description: 'Review and approve signer job requests'
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
        label: 'Companies',
        icon: Building,
        path: '/admin/companies',
        roles: ['admin'],
        description: 'Title company management'
      },
      {
        id: 'title-company-assignments',
        label: 'Company Assignments',
        icon: Star,
        path: '/title-company-assignments',
        roles: ['admin'],
        description: 'Manage preferred notaries'
      },
      {
        id: 'system-logs',
        label: 'System Logs',
        icon: Activity,
        path: '/admin/logs',
        roles: ['admin'],
        description: 'System audit logs'
      }
    ]
  },
  
  // System Configuration (Admin only)
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    path: '/system',
    roles: ['admin'],
    section: 'system',
    description: 'System configuration',
    subsections: [
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
      },
      {
        id: 'email-templates',
        label: 'Email Templates',
        icon: Mail,
        path: '/email-templates',
        roles: ['admin'],
        description: 'Email templates'
      }
    ]
  }
];

const sectionTitles: Record<string, { title: string; icon: any; color: string }> = {
  work: { 
    title: 'Work', 
    icon: Briefcase, 
    color: 'from-blue-500 to-blue-600' 
  },
  personal: { 
    title: 'Personal', 
    icon: User, 
    color: 'from-green-500 to-green-600' 
  },
  support: {
    title: 'Support',
    icon: HelpCircle,
    color: 'from-amber-500 to-orange-500'
  },
  management: { 
    title: 'Management', 
    icon: Shield, 
    color: 'from-purple-500 to-purple-600' 
  },
  system: { 
    title: 'System', 
    icon: Settings, 
    color: 'from-orange-500 to-red-500' 
  }
};

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
    const section = item.section || 'work';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

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
              ? "bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 shadow-sm border border-blue-200/50"
              : "text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:text-gray-900",
            hasSubsections && isExpanded && "bg-gray-50"
          )}
          title={item.description}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg transition-all duration-300",
              isActive && !hasSubsections
                ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md transform scale-110" 
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
              <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
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
            {item.subsections!.map(subItem => renderMenuItem(subItem, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="w-80 bg-white/95 backdrop-blur-sm h-screen sticky top-0 border-r border-gray-200/50 overflow-y-auto shadow-lg">
      <div className="h-full flex flex-col p-6 space-y-8">
        {/* Enhanced User Info Card */}
        <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white font-semibold text-lg">
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ')}</span>
                {user?.isAdmin && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                    Admin
                  </span>
                )}
                {user?.isNotary && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    Notary
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-blue-700">0</div>
            <div className="text-xs text-blue-600">Active Jobs</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-green-700">0</div>
            <div className="text-xs text-green-600">Completed</div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 space-y-6">
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
                
                <div className="space-y-2">
                  {items.map(item => renderMenuItem(item))}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Enhanced Footer */}
        <div className="mt-auto">
          <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-gray-600">System Online</span>
              </div>
              <p className="text-xs text-gray-500 font-medium">© 2024 Sharp Note</p>
              <p className="text-xs text-gray-400">Digital Notarization Platform</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
