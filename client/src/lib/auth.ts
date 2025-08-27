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
  phoneNumber?: string;
  address?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
  lastLoginAt?: string;
  lastLoginIP?: string;
  apiKey?: string;
  createdAt?: string;
  updatedAt?: string;
  // Verification fields
  isVerified?: boolean;
  isVerificationBypassed?: boolean;
  notaryVerificationBypassed?: boolean;
  verificationStatus?: string;
  needsVerification?: boolean;
  accountSetupComplete?: boolean;
  // EVS verification fields
  evsVerifiedAt?: string;
  evsTransactionId?: string;
  evsVerificationConfidence?: number;
  verificationImageFrontUrl?: string;
  verificationImageBackUrl?: string;
  verificationImageSelfieUrl?: string;
  // KBA verification fields
  kbaVerified?: boolean;
  kbaVerificationDate?: string;
  kbaScore?: number;
  // Company fields for title company users
  companyId?: number;
  companyName?: string;
  // Notary fields
  notaryType?: string;
  isAdmin?: boolean;
  isNotary?: boolean;
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
    
    // Validate and store token in localStorage
    if (data.token && data.token !== 'undefined') {
      localStorage.setItem('token', data.token);
    } else {
      console.error('Invalid token received from login response');
    }
    
    // Validate and store user data
    if (data.user && typeof data.user === 'object') {
      localStorage.setItem('user', JSON.stringify(data.user));
    } else {
      console.error('Invalid user data received from login response');
    }
    
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
    try {
      const user = localStorage.getItem('user');
      
      // Handle cases where localStorage contains invalid data
      if (!user || user === 'undefined' || user === 'null' || user.trim() === '') {
        return null;
      }
      
      return JSON.parse(user);
    } catch (error) {
      console.warn('Failed to parse user data from localStorage:', error);
      // Clear invalid data
      localStorage.removeItem('user');
      return null;
    }
  },

  getStoredToken: (): string | null => {
    const token = localStorage.getItem('token');
    
    // Handle cases where localStorage contains invalid token data
    if (!token || token === 'undefined' || token === 'null' || token.trim() === '') {
      return null;
    }
    
    return token;
  },

  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    return !!(token && user);
  },

  getCurrentUser: async (): Promise<User> => {
    // Bypass any intermediary caching by appending a timestamp
    const response = await apiRequest('GET', `/api/auth/me?t=${Date.now()}`);
    const userData = await response.json();
    return userData;
  },

  setStoredUser: (user: User): void => {
    if (user && typeof user === 'object') {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      console.error('Invalid user data provided to setStoredUser');
      localStorage.removeItem('user');
    }
  }
};
