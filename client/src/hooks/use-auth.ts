import { useState, useEffect } from 'react';
import { authApi, type User } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  // Listen for localStorage changes (including from other tabs/logout)
  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = authApi.getStoredUser();
      const authenticated = authApi.isAuthenticated();
      
      if (!storedUser || !authenticated) {
        console.log('Storage change detected - user logged out');
        setUser(null);
        setIsAuthenticated(false);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

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
