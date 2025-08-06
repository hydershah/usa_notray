import { Header } from './header';
import { Sidebar } from './sidebar';
import { NotificationBar } from './notification-bar';
import { useState } from 'react';
import { Menu, X, ChevronRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface MainLayoutProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
}

// Navigation breadcrumb mapping
const breadcrumbMap: Record<string, { label: string; parent?: string }> = {
  '/dashboard': { label: 'Dashboard' },
  '/jobs': { label: 'My Jobs' },
  '/create-job': { label: 'New Job' },
  '/calendar': { label: 'Calendar' },
  '/profile': { label: 'My Profile' },
  '/payments': { label: 'Payments' },
  '/my-logs': { label: 'My Records' },
  '/job-request': { label: 'Job Requests' },

  '/admin/approvals': { label: 'Approvals', parent: 'Management' },
  '/admin/approvals-hub': { label: 'Approvals Hub', parent: 'Management' },
  '/admin/verification': { label: 'KYC/KBA', parent: 'Management' },
  '/admin/users': { label: 'Users', parent: 'Management' },
  '/admin/notaries': { label: 'Notaries', parent: 'Management' },
  '/admin/companies': { label: 'Companies', parent: 'Management' },
  '/admin/job-requests': { label: 'Job Requests', parent: 'Management' },
  '/admin/logs': { label: 'System Logs', parent: 'Management' },
  '/user-management': { label: 'Users', parent: 'Management' },
  '/notary-management': { label: 'Notaries', parent: 'Management' },
  '/title-companies': { label: 'Companies', parent: 'Management' },
  '/title-company-assignments': { label: 'Company Assignments', parent: 'Management' },
  '/logs': { label: 'System Logs', parent: 'Management' },
  '/closing-types': { label: 'Closing Types', parent: 'System' },
  '/email-settings': { label: 'Email Settings', parent: 'System' },
  '/email-templates': { label: 'Email Templates', parent: 'System' },
};

export function MainLayout({ children, hideSidebar = false }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();

  const getBreadcrumbs = () => {
    const current = breadcrumbMap[location];
    if (!current) return [];
    
    const breadcrumbs = [];
    if (current.parent) {
      breadcrumbs.push({ label: current.parent, path: null });
    }
    breadcrumbs.push({ label: current.label, path: location });
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
      {!hideSidebar && <Header />}
      {!hideSidebar && <NotificationBar />}
      <div className={cn(
        "flex",
        hideSidebar ? "min-h-screen" : "min-h-[calc(100vh-8rem)]"
      )}>
        {/* Mobile sidebar backdrop */}
        {!hideSidebar && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden animate-in fade-in-0 duration-300" 
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Sidebar - hidden on mobile by default */}
        {!hideSidebar && (
          <div className={cn(
            "fixed lg:static inset-y-0 left-0 z-50 lg:z-0 transform transition-transform duration-300 ease-in-out lg:transform-none",
            sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}>
            <Sidebar />
          </div>
        )}
        
        {/* Main content */}
        <main className={cn(
          "relative flex flex-col",
          hideSidebar ? "flex-1 w-full" : "flex-1"
        )}>
          <div className="relative z-10 p-4 w-full h-full flex-1 flex flex-col">

            
            {/* Page content */}
            <div className="animate-in fade-in-50 slide-in-from-bottom-4 duration-700 flex-1">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
