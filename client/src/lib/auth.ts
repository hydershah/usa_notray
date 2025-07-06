import { apiRequest } from './queryClient';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  privileges: string[];
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string;
  lastLoginIP?: string;
  apiKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Global flag to prevent multiple logout attempts
let isLoggingOut = false;

/**
 * Secure fetch wrapper that handles authentication and auto-logout on 401
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('token');
  
  if (!token) {
    console.warn('No authentication token found for request to:', url);
    if (!isLoggingOut) {
      await authApi.logout();
      window.location.href = '/login?reason=no-token';
    }
    throw new Error('No authentication token');
  }

  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 responses by auto-logging out
  if (response.status === 401) {
    console.warn('🚨 401 Unauthorized response from:', url);
    if (!isLoggingOut) {
      isLoggingOut = true;
      try {
        await authApi.logout();
        window.location.href = '/login?reason=expired';
      } catch (error) {
        console.error('Error during auto-logout:', error);
      } finally {
        isLoggingOut = false;
      }
    }
    throw new Error('Authentication required');
  }

  return response;
}

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiRequest('POST', '/api/auth/login', credentials);
    const data = await response.json();
    
    // Store token in localStorage
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return data;
  },

  logout: async () => {
    console.log('authApi.logout called');
    try {
      // Call server logout endpoint
      console.log('Calling server logout endpoint');
      await apiRequest('POST', '/api/auth/logout');
      console.log('Server logout endpoint called successfully');
    } catch (error) {
      console.warn('Server logout failed:', error);
      // Continue with local logout even if server call fails
    } finally {
      // Always clear local storage
      console.log('Clearing localStorage');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      console.log('localStorage cleared');
    }
  },

  getStoredUser: (): User | null => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getStoredToken: (): string | null => {
    return localStorage.getItem('token');
  },

  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  }
};
