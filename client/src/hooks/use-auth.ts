import { useState, useEffect } from 'react';
import { authApi, type User } from '@/lib/auth';
import { queryClient } from '@/lib/queryClient';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  const logout = async () => {
    console.log('useAuth logout called');
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
      // Clear query cache to prevent stale data issues
      console.log('Clearing query cache');
      queryClient.clear();
      console.log('Logout state cleanup completed');
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout
  };
}
