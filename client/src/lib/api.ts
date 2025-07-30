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