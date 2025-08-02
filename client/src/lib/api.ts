/**
 * API utility for making authenticated requests
 * Matches the existing pattern used throughout the application
 */

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest(method: string, url: string, data?: any): Promise<Response> {
  const token = localStorage.getItem('token');
  
  const options: RequestInit = {
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };

  if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  
  return response;
}

/**
 * Get current user token
 */
export function getAuthToken(): string | null {
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('🔐 No authentication token found. User may need to log in.');
  }
  return token;
}

/**
 * Debug authentication status
 */
export function debugAuthStatus() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  console.log('🔍 Authentication Debug:', {
    hasToken: !!token,
    tokenLength: token?.length || 0,
    hasUser: !!user,
    tokenPreview: token ? `${token.substring(0, 10)}...` : 'none',
    tokenValue: token,
    userValue: user,
    userLength: user?.length || 0,
    isValidUser: user && user !== 'undefined' && user !== 'null'
  });
  
  // Try to parse user data safely
  let userData = null;
  try {
    userData = user && user !== 'undefined' && user !== 'null' ? JSON.parse(user) : null;
  } catch (error) {
    console.error('User data is corrupted:', error);
  }
  
  return { hasToken: !!token, hasUser: !!user, userData };
}

/**
 * Clear corrupted localStorage data
 */
export function clearCorruptedAuth() {
  console.log('🧹 Clearing potentially corrupted authentication data...');
  
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (token === 'undefined' || token === 'null') {
    localStorage.removeItem('token');
    console.log('✅ Removed corrupted token');
  }
  
  if (user === 'undefined' || user === 'null') {
    localStorage.removeItem('user');
    console.log('✅ Removed corrupted user data');
  }
  
  // Try to parse user data and remove if invalid
  if (user && user !== 'undefined' && user !== 'null') {
    try {
      JSON.parse(user);
    } catch (error) {
      localStorage.removeItem('user');
      console.log('✅ Removed invalid JSON user data');
    }
  }
  
  console.log('🧹 Auth cleanup complete');
}

// Make debugging functions available globally in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).debugAuthStatus = debugAuthStatus;
  (window as any).clearCorruptedAuth = clearCorruptedAuth;
}

/**
 * Get current user data
 */
export function getCurrentUser(): any | null {
  try {
    const userData = localStorage.getItem('user');
    
    // Handle cases where localStorage contains invalid data
    if (!userData || userData === 'undefined' || userData === 'null' || userData.trim() === '') {
      return null;
    }
    
    return JSON.parse(userData);
  } catch (error) {
    console.warn('Failed to parse user data from localStorage:', error);
    // Clear invalid data
    localStorage.removeItem('user');
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

// Add this helper function to test and potentially clear expired auth tokens
export async function checkAuthAndRefresh(): Promise<boolean> {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found');
      return false;
    }

    // Test the token with a simple endpoint
    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      return true;
    }

    if (response.status === 401) {
      console.warn('Token expired or invalid');
      localStorage.removeItem('token');
      return false;
    }

    return false;
  } catch (error) {
    console.error('Auth check failed:', error);
    return false;
  }
}

export default apiRequest; 