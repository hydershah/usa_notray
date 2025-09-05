import { useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";

interface RouteAnalyticsEvent {
  type: '404_error' | 'route_access' | 'route_redirect';
  path: string;
  timestamp: string;
  userRole?: string;
  userId?: string;
  userAgent: string;
  referrer: string;
  metadata?: Record<string, any>;
}

export function useRouteAnalytics() {
  const { user } = useAuth();

  const trackEvent = useCallback((event: Omit<RouteAnalyticsEvent, 'timestamp' | 'userAgent' | 'referrer'>) => {
    const analyticsEvent: RouteAnalyticsEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      userRole: user?.role,
      userId: user?.id?.toString(),
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Route Analytics:', analyticsEvent);
    }

    // In production, you would send this to your analytics service
    // Example:
    // analytics.track(event.type, analyticsEvent);
    
    // Or send to your backend
    // fetch('/api/analytics/route-events', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(analyticsEvent)
    // }).catch(console.error);
  }, [user]);

  const track404 = useCallback((path: string, metadata?: Record<string, any>) => {
    trackEvent({
      type: '404_error',
      path,
      metadata: {
        ...metadata,
        possibleTypo: path.includes('//') || path.includes('..'),
        hasTrailingSlash: path.endsWith('/') && path !== '/',
        hasQueryParams: path.includes('?'),
        pathSegments: path.split('/').filter(Boolean),
      }
    });
  }, [trackEvent]);

  const trackRouteAccess = useCallback((path: string, metadata?: Record<string, any>) => {
    trackEvent({
      type: 'route_access',
      path,
      metadata
    });
  }, [trackEvent]);

  const trackRouteRedirect = useCallback((fromPath: string, toPath: string, reason: string) => {
    trackEvent({
      type: 'route_redirect',
      path: fromPath,
      metadata: {
        redirectTo: toPath,
        reason
      }
    });
  }, [trackEvent]);

  return {
    track404,
    trackRouteAccess,
    trackRouteRedirect,
    trackEvent
  };
}

// Route suggestions based on common patterns
export function getRouteSuggestions(currentPath: string, userRole?: string): Array<{ path: string; label: string; score: number; reason: string }> {
  const suggestions: Array<{ path: string; label: string; score: number; reason: string }> = [];
  const pathLower = currentPath.toLowerCase();

  // Common typos and their corrections
  const typoCorrections: Record<string, { path: string; label: string; reason: string }> = {
    '/dashbaord': { path: '/dashboard', label: 'Dashboard', reason: 'Typo correction' },
    '/dashbord': { path: '/dashboard', label: 'Dashboard', reason: 'Typo correction' },
    '/admim': { path: '/admin-dashboard', label: 'Admin Dashboard', reason: 'Typo correction' },
    '/admin': { path: '/admin-dashboard', label: 'Admin Dashboard', reason: 'Path completion' },
    '/job': { path: '/jobs', label: 'Jobs', reason: 'Path completion' },
    '/user': { path: '/user-management', label: 'User Management', reason: 'Path completion' },
    '/users': { path: '/user-management', label: 'User Management', reason: 'Path completion' },
    '/profile': { path: '/profile', label: 'Profile', reason: 'Exact match' },
    '/calendar': { path: '/calendar', label: 'Calendar', reason: 'Exact match' },
    '/settings': { path: '/email-settings', label: 'Email Settings', reason: 'Settings category' },
    '/notifications': { path: '/notifications', label: 'Notifications', reason: 'Exact match' },
    '/payment': { path: '/payments', label: 'Payments', reason: 'Path completion' },
  };

  // Check for exact typo corrections
  if (typoCorrections[pathLower]) {
    const correction = typoCorrections[pathLower];
    suggestions.push({
      path: correction.path,
      label: correction.label,
      score: 100,
      reason: correction.reason
    });
  }

  // Check for partial matches
  const partialMatches: Array<{ path: string; label: string; keywords: string[] }> = [
    { path: '/dashboard', label: 'Dashboard', keywords: ['dash', 'board', 'home', 'main'] },
    { path: '/admin-dashboard', label: 'Admin Dashboard', keywords: ['admin', 'manage', 'control'] },
    { path: '/jobs', label: 'Jobs', keywords: ['job', 'work', 'notary', 'signing'] },
    { path: '/create-job', label: 'Create Job', keywords: ['create', 'new', 'add', 'job'] },
    { path: '/calendar', label: 'Calendar', keywords: ['calendar', 'schedule', 'appointment', 'time'] },
    { path: '/user-management', label: 'User Management', keywords: ['user', 'manage', 'people', 'account'] },
    { path: '/title-companies', label: 'Title Companies', keywords: ['title', 'company', 'companies'] },
    { path: '/payments', label: 'Payments', keywords: ['payment', 'pay', 'money', 'billing'] },
    { path: '/profile', label: 'Profile', keywords: ['profile', 'account', 'personal', 'info'] },
    { path: '/notifications', label: 'Notifications', keywords: ['notification', 'alert', 'message'] },
  ];

  partialMatches.forEach(match => {
    const pathSegments = pathLower.split('/').filter(Boolean);
    const matchScore = match.keywords.reduce((score, keyword) => {
      if (pathSegments.some(segment => segment.includes(keyword) || keyword.includes(segment))) {
        return score + 50;
      }
      if (pathLower.includes(keyword)) {
        return score + 25;
      }
      return score;
    }, 0);

    if (matchScore > 0) {
      suggestions.push({
        path: match.path,
        label: match.label,
        score: matchScore,
        reason: `Contains relevant keywords`
      });
    }
  });

  // Role-based suggestions
  if (userRole) {
    const roleSuggestions: Record<string, Array<{ path: string; label: string }>> = {
      admin: [
        { path: '/admin-dashboard', label: 'Admin Dashboard' },
        { path: '/user-management', label: 'User Management' },
      ],
      notary: [
        { path: '/admin-dashboard', label: 'Admin Dashboard' },
        { path: '/jobs', label: 'Jobs' },
        { path: '/calendar', label: 'Calendar' },
      ],
      signer: [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/job-request', label: 'Request Job' },
        { path: '/my-job-requests', label: 'My Job Requests' },
      ],
      client: [
        { path: '/admin-dashboard', label: 'Admin Dashboard' },
        { path: '/create-job', label: 'Create Job' },
        { path: '/jobs', label: 'Jobs' },
      ],
    };

    const roleBasedSuggestions = roleSuggestions[userRole] || [];
    roleBasedSuggestions.forEach(suggestion => {
      if (!suggestions.find(s => s.path === suggestion.path)) {
        suggestions.push({
          path: suggestion.path,
          label: suggestion.label,
          score: 30,
          reason: `Recommended for ${userRole}s`
        });
      }
    });
  }

  // Sort by score (highest first) and return top suggestions
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// Hook to track route changes
export function useRouteChangeTracking() {
  const { trackRouteAccess } = useRouteAnalytics();

  useEffect(() => {
    const currentPath = window.location.pathname;
    trackRouteAccess(currentPath);
  }, [trackRouteAccess]);

  useEffect(() => {
    const handleRouteChange = () => {
      const currentPath = window.location.pathname;
      trackRouteAccess(currentPath);
    };

    // Listen for browser navigation events
    window.addEventListener('popstate', handleRouteChange);
    
    // For SPA navigation, you might need to listen to your router's events
    // This depends on your routing library

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [trackRouteAccess]);
}
