import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useRouteAnalytics } from "@/hooks/use-route-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle, Home, ArrowLeft } from "lucide-react";

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  requireAuth?: boolean;
  fallbackPath?: string;
  showAlternatives?: boolean;
}

export function RouteGuard({ 
  children, 
  allowedRoles = [], 
  requireAuth = true,
  fallbackPath,
  showAlternatives = true
}: RouteGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { trackRouteRedirect } = useRouteAnalytics();
  const currentPath = window.location.pathname;

  // Show loading state while auth is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    const loginPath = `/login?redirect=${encodeURIComponent(currentPath)}`;
    trackRouteRedirect(currentPath, loginPath, 'Authentication required');
    setLocation(loginPath);
    return null;
  }

  // Check role-based access
  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    const handleGoHome = () => {
      const homePath = user.role === 'signer' || user.role === 'witness' ? '/dashboard' : '/admin-dashboard';
      trackRouteRedirect(currentPath, homePath, 'Insufficient permissions - redirected to home');
      setLocation(homePath);
    };

    const handleGoBack = () => {
      window.history.back();
    };

    const handleGoToFallback = () => {
      if (fallbackPath) {
        trackRouteRedirect(currentPath, fallbackPath, 'Insufficient permissions - redirected to fallback');
        setLocation(fallbackPath);
      }
    };

    // Get role-appropriate alternatives
    const getRoleAlternatives = () => {
      const alternatives: Array<{ path: string; label: string; description: string }> = [];

      switch (user.role) {
        case 'admin':
          alternatives.push(
            { path: '/admin-dashboard', label: 'Admin Dashboard', description: 'Administrative overview' },
            { path: '/user-management', label: 'User Management', description: 'Manage system users' },
            { path: '/title-companies', label: 'Title Companies', description: 'Manage title companies' }
          );
          break;
        case 'notary':
          alternatives.push(
            { path: '/admin-dashboard', label: 'Dashboard', description: 'Your notary dashboard' },
            { path: '/jobs', label: 'Jobs', description: 'View assigned jobs' },
            { path: '/calendar', label: 'Calendar', description: 'Manage your schedule' }
          );
          break;
        case 'client':
          alternatives.push(
            { path: '/admin-dashboard', label: 'Dashboard', description: 'Your client dashboard' },
            { path: '/create-job', label: 'Create Job', description: 'Request notarization' },
            { path: '/jobs', label: 'Jobs', description: 'View your jobs' }
          );
          break;
        case 'signer':
        case 'witness':
          alternatives.push(
            { path: '/dashboard', label: 'Dashboard', description: 'Your personal dashboard' },
            { path: '/job-request', label: 'Request Job', description: 'Request notarization' },
            { path: '/my-job-requests', label: 'My Requests', description: 'View your requests' }
          );
          break;
        default:
          alternatives.push(
            { path: '/dashboard', label: 'Dashboard', description: 'Main dashboard' }
          );
      }

      return alternatives.slice(0, 3);
    };

    const alternatives = getRoleAlternatives();

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="h-12 w-12 text-amber-500" />
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900">Access Restricted</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  This page requires {allowedRoles.join(' or ')} privileges
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You don't have permission to access this page. Your current role is <strong>{user.role}</strong>, 
                but this page requires <strong>{allowedRoles.join(' or ')}</strong> privileges.
              </AlertDescription>
            </Alert>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleGoHome} className="gap-2">
                <Home className="h-4 w-4" />
                Go to Dashboard
              </Button>
              <Button variant="outline" onClick={handleGoBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
              {fallbackPath && (
                <Button variant="outline" onClick={handleGoToFallback} className="gap-2">
                  Go to Alternative
                </Button>
              )}
            </div>

            {/* Role-appropriate alternatives */}
            {showAlternatives && alternatives.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900">
                  Pages you can access:
                </h3>
                <div className="grid gap-2">
                  {alternatives.map((alternative, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(alternative.path)}
                      className="justify-start h-auto p-3 text-left"
                    >
                      <div>
                        <div className="font-medium">{alternative.label}</div>
                        <div className="text-xs text-gray-500">{alternative.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Developer info in development */}
            {process.env.NODE_ENV === 'development' && (
              <Alert className="border-dashed border-orange-200 bg-orange-50">
                <AlertDescription className="text-orange-800">
                  <div className="text-sm">
                    <p className="font-medium mb-2">Developer Info:</p>
                    <ul className="space-y-1 text-xs">
                      <li>• Current path: <code className="bg-orange-100 px-1 rounded">{currentPath}</code></li>
                      <li>• User role: <code className="bg-orange-100 px-1 rounded">{user.role}</code></li>
                      <li>• Required roles: <code className="bg-orange-100 px-1 rounded">{allowedRoles.join(', ')}</code></li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // If all checks pass, render the protected content
  return <>{children}</>;
}

// Helper component for common route protection patterns
export function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={['admin']}>
      {children}
    </RouteGuard>
  );
}

export function NotaryRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={['admin', 'notary']}>
      {children}
    </RouteGuard>
  );
}

export function ClientRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={['admin', 'client', 'title_company']}>
      {children}
    </RouteGuard>
  );
}

export function SignerRoute({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard allowedRoles={['signer', 'witness']}>
      {children}
    </RouteGuard>
  );
}
