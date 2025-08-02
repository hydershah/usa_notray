/**
 * API utility for making authenticated requests
 * Matches the existing pattern used throughout the application
 */

interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  retries?: number;
  retryDelay?: number;
}

/**
 * Enhanced error handling for API requests
 */
function handleApiError(response: Response, url: string): never {
  let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
  
  switch (response.status) {
    case 401:
      errorMessage = 'Authentication required. Please log in again.';
      // Auto-redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?reason=expired';
      break;
    case 403:
      errorMessage = 'Access denied. You do not have permission to perform this action.';
      break;
    case 404:
      errorMessage = 'The requested resource was not found.';
      break;
    case 503:
      errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
      break;
    case 500:
      errorMessage = 'Internal server error. Please try again later.';
      break;
    default:
      if (response.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (response.status >= 400) {
        errorMessage = 'Request error. Please check your input and try again.';
      }
  }
  
  console.error(`API Error (${response.status}): ${url} - ${errorMessage}`);
  throw new Error(errorMessage);
}

/**
 * Make an authenticated API request with retry logic
 */
export async function apiRequest(method: string, url: string, data?: any, options: ApiRequestOptions = {}): Promise<Response> {
  const { retries = 3, retryDelay = 1000 } = options;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const token = localStorage.getItem('token');
      
      const requestOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      };

      if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
        // If data is FormData, don't set Content-Type header (let browser set it with boundary)
        if (data instanceof FormData) {
          requestOptions.body = data;
        } else {
          // For JSON data, set Content-Type header
          requestOptions.headers = {
            ...requestOptions.headers,
            'Content-Type': 'application/json'
          };
          requestOptions.body = JSON.stringify(data);
        }
      }

      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        // For 503 errors, retry if we haven't exhausted retries
        if (response.status === 503 && attempt < retries) {
          console.warn(`Server temporarily unavailable (attempt ${attempt}/${retries}), retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        
        handleApiError(response, url);
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Handle network errors (like connection refused) - retry if we haven't exhausted retries
      if (error instanceof TypeError && error.message.includes('fetch') && attempt < retries) {
        console.warn(`Network error (attempt ${attempt}/${retries}), retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }
      
      // For other errors, don't retry
      break;
    }
  }
  
  // If we get here, all retries failed
  if (lastError) {
    throw lastError;
  }
  
  throw new Error('Request failed after all retry attempts');
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