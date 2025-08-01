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
  return localStorage.getItem('token');
}

/**
 * Get current user data
 */
export function getCurrentUser(): any | null {
  const userData = localStorage.getItem('user');
  return userData ? JSON.parse(userData) : null;
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