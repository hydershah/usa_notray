/**
 * WebSocket Configuration for Tag Synchronization
 * Controls behavior to prevent bouncing and improve performance
 */

export interface WebSocketConfig {
  // Enable/disable WebSocket sync (useful for debugging)
  enabled: boolean;
  
  // Deduplication settings
  deduplicationWindow: number; // milliseconds
  coordinateTolerance: number; // pixels
  
  // Throttling settings
  maxMessagesPerSecond: number;
  
  // Debug settings
  logDroppedMessages: boolean;
  logDuplicateMessages: boolean;
}

export const defaultWebSocketConfig: WebSocketConfig = {
  enabled: true,
  deduplicationWindow: 2000, // 2 seconds
  coordinateTolerance: 2, // 2 pixels
  maxMessagesPerSecond: 10,
  logDroppedMessages: process.env.NODE_ENV === 'development',
  logDuplicateMessages: process.env.NODE_ENV === 'development'
};

// Environment-specific overrides
export const getWebSocketConfig = (): WebSocketConfig => {
  const config = { ...defaultWebSocketConfig };
  
  // Production optimizations
  if (process.env.NODE_ENV === 'production') {
    config.logDroppedMessages = false;
    config.logDuplicateMessages = false;
    config.deduplicationWindow = 1500; // Slightly shorter in production
  }
  
  // Development debugging
  if (process.env.NODE_ENV === 'development') {
    config.logDroppedMessages = true;
    config.logDuplicateMessages = true;
  }
  
  return config;
};
