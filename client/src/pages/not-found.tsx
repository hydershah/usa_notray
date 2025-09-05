import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Home, ArrowLeft, Search, FileText, Users, Calendar, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouteAnalytics, getRouteSuggestions } from "@/hooks/use-route-analytics";

interface RouteGroup {
  title: string;
  icon: React.ReactNode;
  routes: Array<{
    path: string;
    label: string;
    description?: string;
    roles?: string[];
  }>;
}

export default function NotFound() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { track404 } = useRouteAnalytics();
  const currentPath = window.location.pathname;

  // Log 404 for analytics
  useEffect(() => {
    track404(currentPath, {
      fromReferrer: document.referrer,
      hasTrailingSlash: currentPath.endsWith('/') && currentPath !== '/',
      pathLength: currentPath.length,
      segmentCount: currentPath.split('/').filter(Boolean).length,
    });
  }, [currentPath, track404]);

  // Define available routes based on user role
  const getAvailableRoutes = (): RouteGroup[] => {
    const baseRoutes: RouteGroup[] = [
      {
        title: "Dashboard & Overview",
        icon: <Home className="h-4 w-4" />,
        routes: [
          { path: "/dashboard", label: "Dashboard", description: "Your main dashboard" },
          { path: "/admin-dashboard", label: "Admin Dashboard", description: "Administrative overview", roles: ['admin', 'title_company', 'notary', 'client'] },
        ]
      },
      {
        title: "Jobs & Notarization",
        icon: <FileText className="h-4 w-4" />,
        routes: [
          { path: "/jobs", label: "Jobs", description: "View and manage jobs" },
          { path: "/create-job", label: "Create Job", description: "Create a new notarization job" },
          { path: "/job-request", label: "Request Job", description: "Request a notarization", roles: ['signer', 'client'] },
          { path: "/my-job-requests", label: "My Job Requests", description: "View your job requests", roles: ['signer', 'client'] },
        ]
      },
      {
        title: "Calendar & Scheduling",
        icon: <Calendar className="h-4 w-4" />,
        routes: [
          { path: "/calendar", label: "Calendar", description: "View your calendar and availability" },
        ]
      },
      {
        title: "User Management",
        icon: <Users className="h-4 w-4" />,
        routes: [
          { path: "/user-management", label: "User Management", description: "Manage users", roles: ['admin'] },
          { path: "/title-companies", label: "Title Companies", description: "Manage title companies" },
          { path: "/profile", label: "Profile", description: "Manage your profile" },
        ]
      },
      {
        title: "Settings & Configuration",
        icon: <Settings className="h-4 w-4" />,
        routes: [
          { path: "/closing-types", label: "Closing Types", description: "Manage closing types" },
          { path: "/payments", label: "Payments", description: "View payment information" },
          { path: "/email-settings", label: "Email Settings", description: "Configure email settings" },
          { path: "/notifications", label: "Notifications", description: "View your notifications" },
        ]
      }
    ];

    // Filter routes based on user role
    if (!user) return baseRoutes;

    return baseRoutes.map(group => ({
      ...group,
      routes: group.routes.filter(route => 
        !route.roles || route.roles.includes(user.role)
      )
    })).filter(group => group.routes.length > 0);
  };

  const availableRoutes = getAvailableRoutes();

  // Get intelligent route suggestions
  const suggestedRoutes = getRouteSuggestions(currentPath, user?.role)
    .slice(0, 3) // Limit to top 3 suggestions
    .map(suggestion => ({
      path: suggestion.path,
      label: suggestion.label,
      reason: suggestion.reason
    }));

  const handleGoHome = () => {
    if (user) {
      // Redirect based on user role
      if (user.role === 'signer' || user.role === 'witness') {
        setLocation('/dashboard');
      } else {
        setLocation('/admin-dashboard');
      }
    } else {
      setLocation('/login');
    }
  };

  const handleGoBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-4xl space-y-6">
        {/* Main Error Card */}
        <Card className="text-center">
          <CardHeader>
            <div className="flex items-center justify-center gap-3 mb-4">
              <AlertCircle className="h-12 w-12 text-red-500" />
              <div>
                <CardTitle className="text-3xl font-bold text-gray-900">404 - Page Not Found</CardTitle>
                <Badge variant="outline" className="mt-2 font-mono text-xs">
                  {currentPath}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-gray-600 space-y-2">
              <p className="text-lg">The page you're looking for doesn't exist.</p>
              <p className="text-sm">
                This could be due to a typo in the URL, an outdated link, or the page may have been moved or deleted.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={handleGoHome} className="gap-2">
                <Home className="h-4 w-4" />
                Go Home
              </Button>
              <Button variant="outline" onClick={handleGoBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Go Back
              </Button>
          </div>

            {/* Suggested Routes */}
            {suggestedRoutes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Did you mean one of these?
                </h3>
                <div className="grid gap-2">
                  {suggestedRoutes.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocation(suggestion.path)}
                      className="justify-between text-left h-auto p-3"
                    >
                      <div>
                        <div className="font-medium">{suggestion.label}</div>
                        <div className="text-xs text-gray-500">{suggestion.reason}</div>
                      </div>
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Routes */}
        {user && availableRoutes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-5 w-5" />
                Available Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {availableRoutes.map((group, groupIndex) => (
                  <div key={groupIndex} className="space-y-3">
                    <h4 className="font-medium text-gray-900 flex items-center gap-2">
                      {group.icon}
                      {group.title}
                    </h4>
                    <div className="grid gap-1">
                      {group.routes.map((route, routeIndex) => (
                        <Button
                          key={routeIndex}
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocation(route.path)}
                          className="justify-start h-auto p-2 text-left"
                        >
                          <div>
                            <div className="font-medium text-sm">{route.label}</div>
                            {route.description && (
                              <div className="text-xs text-gray-500">{route.description}</div>
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
