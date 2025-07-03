import { useState, useEffect, useCallback, useRef } from 'react';

interface UseWebSocketReturn {
  ws: WebSocket | null;
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  connect: (url: string) => Promise<void>;
  disconnect: () => void;
  send: (data: any) => void;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  const connect = useCallback(async (url: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      // Create WebSocket URL with authentication token
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = localStorage.getItem('token');
      const separator = url.includes('?') ? '&' : '?';
      const wsUrl = `${protocol}//${window.location.host}${url}${separator}token=${token}`;
      
      console.log('Attempting to connect to WebSocket:', wsUrl);

      const websocket = new WebSocket(wsUrl);
      wsRef.current = websocket;

      websocket.onopen = () => {
        console.log('WebSocket connected');
        setWs(websocket);
        setConnected(true);
        setConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      websocket.onclose = (event) => {
        console.log('WebSocket disconnected', event);
        setWs(null);
        setConnected(false);
        setConnecting(false);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect(url);
          }, RECONNECT_DELAY);
        }
      };

      websocket.onerror = (event) => {
        console.error('WebSocket error', event);
        setError(new Error('WebSocket connection failed'));
        setConnecting(false);
      };

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to connect'));
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
      setWs(null);
      setConnected(false);
    }
  }, []);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ws,
    connected,
    connecting,
    error,
    connect,
    disconnect,
    send
  };
}; 