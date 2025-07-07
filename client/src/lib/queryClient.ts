import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Global flag to prevent multiple logout attempts
let isLoggingOut = false;

async function handleUnauthorized() {
  if (isLoggingOut) {
    return; // Prevent multiple simultaneous logout attempts
  }
  
  isLoggingOut = true;
  console.log('🚨 401 Unauthorized - Auto-logging out user');
  
  try {
    // Clear localStorage immediately
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Force redirect to login page
    window.location.href = '/login?reason=expired';
  } catch (error) {
    console.error('Error during auto-logout:', error);
  } finally {
    isLoggingOut = false;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle 401 Unauthorized responses
    if (res.status === 401) {
      await handleUnauthorized();
      const error = new Error('Authentication required');
      error.name = 'UnauthorizedError';
      throw error;
    }
    
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem('token');
    
    // For authenticated endpoints, don't make request if no token
    const url = queryKey[0] as string;
    const isAuthenticatedEndpoint = url.includes('/api/auth/me') || 
                                   url.includes('/api/users') ||
                                   url.includes('/api/admin') ||
                                   url.includes('/api/jobs') ||
                                   url.includes('/api/companies') ||
                                   url.includes('/api/notary');
    
    if (isAuthenticatedEndpoint && !token) {
      // Return null for authenticated endpoints when no token is available
      // This prevents unnecessary 401 requests
      return null;
    }
    
    const headers: Record<string, string> = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        await handleUnauthorized();
        return null;
      } else {
        await handleUnauthorized();
        const error = new Error('Authentication required');
        error.name = 'UnauthorizedError';
        throw error;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
