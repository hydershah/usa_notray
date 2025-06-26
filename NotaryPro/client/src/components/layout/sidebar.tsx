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
  User
} from 'lucide-react';

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    path: '/dashboard',
    roles: ['admin', 'title_company', 'notary', 'client']
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: Briefcase,
    path: '/jobs',
    roles: ['admin', 'title_company', 'notary', 'client']
  },
  {
    id: 'profile',
    label: 'Profile & Signatures',
    icon: User,
    path: '/profile',
    roles: ['admin', 'title_company', 'notary', 'client']
  },
  {
    id: 'create-job',
    label: 'Create Job',
    icon: Plus,
    path: '/create-job',
    roles: ['admin', 'title_company']
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: DollarSign,
    path: '/payments',
    roles: ['admin', 'title_company', 'notary']
  },
  {
    id: 'notary-management',
    label: 'Notary Management',
    icon: Users,
    path: '/notary-management',
    roles: ['admin']
  },
  {
    id: 'title-companies',
    label: 'Title Companies',
    icon: Building,
    path: '/title-companies',
    roles: ['admin']
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: UserCog,
    path: '/user-management',
    roles: ['admin']
  },
  {
    id: 'closing-types',
    label: 'Closing Types',
    icon: Settings,
    path: '/closing-types',
    roles: ['admin']
  },
  {
    id: 'logs',
    label: 'Notarization Logs',
    icon: FileText,
    path: '/logs',
    roles: ['admin', 'notary']
  }
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role || '')
  );

  return (
    <nav className="w-64 bg-white shadow-sm h-screen sticky top-0 border-r border-gray-200">
      <div className="p-4">
        <ul className="space-y-2">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => setLocation(item.path)}
                  className={cn(
                    "flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <Icon className="mr-3 h-4 w-4" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
