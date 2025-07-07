import { useEffect, useState } from 'react';

export interface WebRTCAuthConfig {
  token: string | null;
  isAuthenticated: boolean;
  error: string | null;
}

export const useWebRTCAuth = (): WebRTCAuthConfig => {
  const [config, setConfig] = useState<WebRTCAuthConfig>({
    token: null,
    isAuthenticated: false,
    error: null
  });

  useEffect(() => {
    const validateToken = () => {
      try {
        // Get token from localStorage
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.warn('WebRTC Auth: No authentication token found in localStorage');
          setConfig({
            token: null,
            isAuthenticated: false,
            error: 'No authentication token found. Please log in again.'
          });
          return;
        }

        // Validate token format (basic check)
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.error('WebRTC Auth: Invalid token format');
          setConfig({
            token: null,
            isAuthenticated: false,
            error: 'Invalid token format. Please log in again.'
          });
          return;
        }

        // Check if token is expired
        try {
          const payload = JSON.parse(atob(parts[1]));
          const now = Date.now() / 1000;
          
          if (payload.exp && payload.exp < now) {
            console.warn('WebRTC Auth: Token has expired');
            setConfig({
              token: null,
              isAuthenticated: false,
              error: 'Authentication token has expired. Please log in again.'
            });
            return;
          }

          // Validate required claims
          if (!payload.id && !payload.userId) {
            console.error('WebRTC Auth: Token missing user ID');
            setConfig({
              token: null,
              isAuthenticated: false,
              error: 'Invalid token: missing user identification'
            });
            return;
          }

          console.log('WebRTC Auth: Token validation successful', {
            userId: payload.id || payload.userId,
            email: payload.email,
            exp: new Date(payload.exp * 1000).toISOString()
          });

        } catch (error) {
          console.warn('WebRTC Auth: Could not parse token payload, but proceeding:', error);
          // Continue anyway, let the server validate
        }

        setConfig({
          token,
          isAuthenticated: true,
          error: null
        });

      } catch (error) {
        console.error('WebRTC auth error:', error);
        setConfig({
          token: null,
          isAuthenticated: false,
          error: error instanceof Error ? error.message : 'Authentication failed'
        });
      }
    };

    validateToken();

    // Listen for token changes (e.g., login/logout in other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        console.log('WebRTC Auth: Token changed in localStorage');
        validateToken();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return config;
}; 