import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Bug, ChevronDown, ChevronRight, Copy, Eye, EyeOff } from "lucide-react";

interface RouteInfo {
  path: string;
  timestamp: string;
  method: 'PUSH' | 'POP' | 'REPLACE';
  userRole?: string;
  authenticated: boolean;
}

export function RouteDebugger() {
  const [isVisible, setIsVisible] = useState(false);
  const [routeHistory, setRouteHistory] = useState<RouteInfo[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  useEffect(() => {
    const addRouteToHistory = (path: string, method: 'PUSH' | 'POP' | 'REPLACE' = 'PUSH') => {
      const routeInfo: RouteInfo = {
        path,
        timestamp: new Date().toLocaleTimeString(),
        method,
        userRole: user?.role,
        authenticated: isAuthenticated
      };

      setRouteHistory(prev => [routeInfo, ...prev.slice(0, 19)]); // Keep last 20 routes
    };

    // Track initial route
    addRouteToHistory(window.location.pathname, 'PUSH');

    // Track browser navigation
    const handlePopState = () => {
      addRouteToHistory(window.location.pathname, 'POP');
    };

    // Track programmatic navigation (this is a simplified approach)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      addRouteToHistory(window.location.pathname, 'PUSH');
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      addRouteToHistory(window.location.pathname, 'REPLACE');
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [user, isAuthenticated]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyRouteHistory = () => {
    const historyText = routeHistory
      .map(route => `${route.timestamp} [${route.method}] ${route.path} (${route.userRole || 'anonymous'})`)
      .join('\n');
    copyToClipboard(historyText);
  };

  const getCurrentRouteInfo = () => {
    const currentPath = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = window.location.hash;
    
    return {
      path: currentPath,
      search: searchParams.toString(),
      hash: hashParams,
      fullUrl: window.location.href,
      referrer: document.referrer
    };
  };

  const currentRoute = getCurrentRouteInfo();

  const getRouteMethodColor = (method: string) => {
    switch (method) {
      case 'PUSH': return 'bg-green-100 text-green-800';
      case 'POP': return 'bg-blue-100 text-blue-800';
      case 'REPLACE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsVisible(true)}
          className="gap-2 bg-white shadow-lg border-orange-200 hover:bg-orange-50"
        >
          <Bug className="h-4 w-4 text-orange-600" />
          Route Debugger
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 overflow-hidden">
      <Card className="border-orange-200 bg-white shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="h-4 w-4 text-orange-600" />
              Route Debugger
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsVisible(false)}
            >
              <EyeOff className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          {/* Current Route Info */}
          <div className="space-y-2">
            <h4 className="font-medium text-gray-900">Current Route</h4>
            <div className="bg-gray-50 p-2 rounded space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono">{currentRoute.path}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(currentRoute.path)}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {currentRoute.search && (
                <div className="text-gray-600">Query: {currentRoute.search}</div>
              )}
              {currentRoute.hash && (
                <div className="text-gray-600">Hash: {currentRoute.hash}</div>
              )}
              <div className="text-gray-600">
                User: {user?.role || 'anonymous'} ({isAuthenticated ? 'auth' : 'unauth'})
              </div>
            </div>
          </div>

          {/* Route History */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between p-0">
                <span className="font-medium text-gray-900">
                  Route History ({routeHistory.length})
                </span>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 mt-2 max-h-48 overflow-y-auto">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={copyRouteHistory}
                  className="h-6 gap-1"
                >
                  <Copy className="h-3 w-3" />
                  Copy All
                </Button>
              </div>
              {routeHistory.map((route, index) => (
                <div key={index} className="flex items-center gap-2 py-1">
                  <Badge variant="outline" className={`text-xs px-1 ${getRouteMethodColor(route.method)}`}>
                    {route.method}
                  </Badge>
                  <span className="text-gray-500 text-xs">{route.timestamp}</span>
                  <span className="font-mono flex-1 truncate">{route.path}</span>
                  <span className="text-gray-500 text-xs">
                    {route.userRole || 'anon'}
                  </span>
                </div>
              ))}
              {routeHistory.length === 0 && (
                <div className="text-gray-500 text-center py-2">No route history</div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRouteHistory([])}
              className="flex-1"
            >
              Clear History
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(JSON.stringify(currentRoute, null, 2))}
              className="flex-1"
            >
              Copy Info
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
