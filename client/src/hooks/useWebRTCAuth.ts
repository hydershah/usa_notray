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
    try {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      
      if (!token) {
        setConfig({
          token: null,
          isAuthenticated: false,
          error: 'No authentication token found'
        });
        return;
      }

      // Validate token format (basic check)
      const parts = token.split('.');
      if (parts.length !== 3) {
        setConfig({
          token: null,
          isAuthenticated: false,
          error: 'Invalid token format'
        });
        return;
      }

      // Check if token is expired
      try {
        const payload = JSON.parse(atob(parts[1]));
        const now = Date.now() / 1000;
        
        if (payload.exp && payload.exp < now) {
          setConfig({
            token: null,
            isAuthenticated: false,
            error: 'Token has expired'
          });
          return;
        }
      } catch (error) {
        console.warn('Could not parse token payload:', error);
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
  }, []);

  return config;
}; 