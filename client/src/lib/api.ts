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
async function handleApiError(response: Response, url: string): Promise<never> {
  let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
  let errorObject: any = { message: errorMessage };

  // Try to extract error details from response body
  try {
    const responseText = await response.text();
    if (responseText) {
      const responseData = JSON.parse(responseText);
      if (responseData.message) {
        errorMessage = responseData.message;
      }
      // Preserve the full error object for components to access
      errorObject = {
        ...responseData,
        message: errorMessage,
        status: response.status
      };
    }
  } catch (parseError) {
    // If JSON parsing fails, fall back to status-based messages
    console.warn('Failed to parse error response:', parseError);
  }
  
  // Handle specific status codes with fallback messages
  switch (response.status) {
    case 401:
      if (!errorObject.message || errorObject.message.includes('API request failed')) {
        errorMessage = 'Authentication required. Please log in again.';
        errorObject.message = errorMessage;
      }
      // Auto-redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?reason=expired';
      break;
    case 403:
      if (!errorObject.message || errorObject.message.includes('API request failed')) {
        errorMessage = 'Access denied. You do not have permission to perform this action.';
        errorObject.message = errorMessage;
      }
      break;
    case 404:
      if (!errorObject.message || errorObject.message.includes('API request failed')) {
        errorMessage = 'The requested resource was not found.';
        errorObject.message = errorMessage;
      }
      break;
    case 409:
      // 409 Conflict - let the backend message through (like email already exists)
      if (!errorObject.message || errorObject.message.includes('API request failed')) {
        errorMessage = 'Conflict with existing data. Please check your input.';
        errorObject.message = errorMessage;
      }
      break;
    case 503:
      if (!errorObject.message || errorObject.message.includes('API request failed')) {
        errorMessage = 'Service temporarily unavailable. Please try again in a few moments.';
        errorObject.message = errorMessage;
      }
      break;
    case 500:
      if (!errorObject.message || errorObject.message.includes('API request failed')) {
        errorMessage = 'Internal server error. Please try again later.';
        errorObject.message = errorMessage;
      }
      break;
    default:
      if (response.status >= 500) {
        if (!errorObject.message || errorObject.message.includes('API request failed')) {
          errorMessage = 'Server error. Please try again later.';
          errorObject.message = errorMessage;
        }
      } else if (response.status >= 400) {
        if (!errorObject.message || errorObject.message.includes('API request failed')) {
          errorMessage = 'Request error. Please check your input and try again.';
          errorObject.message = errorMessage;
        }
      }
  }
  
  console.error(`API Error (${response.status}): ${url} - ${errorMessage}`);
  
  // Create an error object that preserves the backend response details
  const error = new Error(errorMessage);
  // Attach the full response data to the error for components to access
  (error as any).response = errorObject;
  (error as any).status = response.status;
  (error as any).error = errorObject.error; // Preserve error codes like EMAIL_ALREADY_EXISTS
  (error as any).details = errorObject.details; // Preserve additional details
  
  throw error;
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
        
        await handleApiError(response, url);
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