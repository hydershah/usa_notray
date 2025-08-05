/**
 * Daily React Provider Component
 * Provides Daily.co context to all child components
 */

import React, { ReactNode, useEffect, useState, useMemo } from 'react';
import { DailyProvider } from '@daily-co/daily-react';
import { toast } from '@/hooks/use-toast';

interface NotaryVideoProviderProps {
  /** Meeting token from backend API */
  token?: string;
  /** Room URL as fallback */
  roomUrl?: string;
  children: ReactNode;
}

export const NotaryVideoProvider: React.FC<NotaryVideoProviderProps> = ({
  token,
  roomUrl,
  children
}) => {
  console.log('🔄 NotaryVideoProvider - Component render/recreate:', { 
    token: token?.substring(0, 20) + '...', 
    roomUrl,
    timestamp: new Date().toISOString()
  });
  
  const [isInitialized, setIsInitialized] = useState(false);

  // Memoize provider props to prevent unnecessary re-renders (before early return)
  const providerProps = useMemo(() => {
    console.log('🔄 NotaryVideoProvider - providerProps recalculated:', { token: token?.substring(0, 20) + '...', roomUrl });
    return token && token !== 'demo-token'
      ? { url: roomUrl, token }
      : { url: roomUrl };
  }, [token, roomUrl]);

  useEffect(() => {
    // Validate that we have either token or roomUrl
    if (!token && !roomUrl) {
      console.error('❌ NotaryVideoProvider requires either token or roomUrl');
      toast({
        title: "Video Setup Error",
        description: "Missing video session credentials",
        variant: "destructive"
      });
      return;
    }

    if (token) {
      console.log('✅ Daily React Provider initialized with secure token');
    } else {
      console.log('✅ Daily React Provider initialized with room URL');
    }

    setIsInitialized(true);
  }, [token, roomUrl]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Initializing video session...</p>
        </div>
      </div>
    );
  }

  return (
    <DailyProvider {...providerProps}>
      {children}
    </DailyProvider>
  );
};