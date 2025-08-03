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
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-50">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50"></div>
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100/30 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-100/30 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: '2s' }}></div>
            <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-indigo-100/30 rounded-full mix-blend-multiply filter blur-xl animate-pulse" style={{ animationDelay: '4s' }}></div>
          </div>
          
          <div className="relative z-10 p-2 sm:p-4 lg:p-6 max-w-7xl mx-auto flex-1 flex flex-col w-full">
            {/* Top Bar with Mobile Menu + Breadcrumbs - Only show when sidebar is visible */}
            {!hideSidebar && (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  {/* Mobile menu button */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="lg:hidden border-gray-200 bg-white/80 backdrop-blur-sm hover:bg-white hover:shadow-md transition-all duration-200"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                  >
                    {sidebarOpen ? 
                      <X className="h-5 w-5" /> : 
                      <Menu className="h-5 w-5" />
                    }
                  </Button>
                  
                  {/* Breadcrumbs */}
                  {breadcrumbs.length > 0 && (
                    <nav className="flex items-center space-x-2 text-sm">
                      <Home className="h-4 w-4 text-gray-400" />
                      {breadcrumbs.map((breadcrumb, index) => (
                        <div key={index} className="flex items-center">
                          <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                          <span className={cn(
                            "font-medium",
                            index === breadcrumbs.length - 1 
                              ? "text-gray-900" 
                              : "text-gray-500"
                          )}>
                            {breadcrumb.label}
                          </span>
                        </div>
                      ))}
                    </nav>
                  )}
                </div>
              </div>
            )}
            
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
