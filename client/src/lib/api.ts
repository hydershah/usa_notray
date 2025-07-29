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
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };

  if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
    // If data is FormData, don't set Content-Type header (let browser set it with boundary)
    if (data instanceof FormData) {
      options.body = data;
    } else {
      // For JSON data, set Content-Type header
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json'
      };
      options.body = JSON.stringify(data);
    }
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

export default apiRequest; 