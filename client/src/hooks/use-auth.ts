import { useState, useEffect, useRef } from 'react';
import { authApi, type User } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';
import { useQuery, type UseQueryOptions, type QueryKey } from '@tanstack/react-query';

/**
 * Hook for making authenticated queries that only run when user is authenticated
 */
export function useAuthenticatedQuery<T>(
  queryKey: QueryKey,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  const { isAuthenticated } = useAuth();
  
  return useQuery<T>({
    queryKey,
    enabled: isAuthenticated && (options?.enabled !== false),
    ...options,
  });
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Use ref to track current user state to avoid dependency loops
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  useEffect(() => {
    const storedUser = authApi.getStoredUser();
    const authenticated = authApi.isAuthenticated();
    
    if (storedUser && authenticated) {
      setUser(storedUser);
      setIsAuthenticated(true);
    } else {
      setUser(null);
      setIsAuthenticated(false);
    }
    setIsLoading(false);
  }, []);

  // Check localStorage periodically to handle same-tab updates
  useEffect(() => {
    const checkAuthState = () => {
      const storedUser = authApi.getStoredUser();
      const authenticated = authApi.isAuthenticated();
      const currentUser = userRef.current;
      
      if (storedUser && authenticated && !currentUser) {
        console.log('Auth state sync - updating user from localStorage');
        setUser(storedUser);
        setIsAuthenticated(true);
      } else if ((!storedUser || !authenticated) && currentUser) {
        console.log('Auth state sync - clearing user state');
        setUser(null);
        setIsAuthenticated(false);
      }
    };
    
    // Check when page becomes visible (handles tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuthState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Periodic check as fallback (every 30 seconds instead of 5 to reduce frequency)
    const interval = setInterval(checkAuthState, 30000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []); // Remove user dependency to prevent loops

  // Listen for localStorage changes (including from other tabs/logout)
  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = authApi.getStoredUser();
      const authenticated = authApi.isAuthenticated();
      const currentUser = userRef.current;
      
      if (!storedUser || !authenticated) {
        console.log('Storage change detected - user logged out');
        setUser(null);
        setIsAuthenticated(false);
      } else if (!currentUser && storedUser) {
        // Handle case where localStorage has user but state doesn't
        console.log('Storage change detected - user logged in');
        setUser(storedUser);
        setIsAuthenticated(true);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []); // Remove user dependency to prevent loops

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      setUser(response.user);
      setIsAuthenticated(true);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const logout = async (onLogoutComplete?: () => void) => {
    console.log('useAuth logout called');
    setIsLoggingOut(true);
    try {
      await authApi.logout();
      console.log('authApi.logout completed');
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with local cleanup even if server logout fails
    } finally {
      // Always clear local state
      console.log('Clearing local auth state');
      setUser(null);
      setIsAuthenticated(false);
      setIsLoggingOut(false);
      // Clear query cache to prevent stale data issues
      console.log('Clearing query cache');
      queryClient.clear();
      console.log('Logout state cleanup completed');
      
      // Call the callback if provided
      if (onLogoutComplete) {
        onLogoutComplete();
      }
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    isLoggingOut,
    login,
    logout
  };
}
