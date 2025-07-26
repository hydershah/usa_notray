import { Request, Response, NextFunction } from 'express';

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

interface RequestDeduplicationOptions {
  keyGenerator: (req: Request) => string;
  timeout?: number; // milliseconds
  enabled?: boolean;
}

class RequestDeduplicationService {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Generic request deduplication middleware
   */
  createMiddleware(options: RequestDeduplicationOptions) {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!options.enabled) {
        return next();
      }

      const key = options.keyGenerator(req);
      const timeout = options.timeout || this.DEFAULT_TIMEOUT;
      
      // Check if there's already a pending request for this key
      const existing = this.pendingRequests.get(key);
      
      if (existing) {
        // Check if the existing request has timed out
        if (Date.now() - existing.timestamp > timeout) {
          this.pendingRequests.delete(key);
          console.log(`🕐 Request deduplication timeout for key: ${key}`);
        } else {
          // Return the existing promise result
          existing.promise
            .then((result) => {
              if (result.statusCode) {
                res.status(result.statusCode).json(result.data);
              } else {
                res.json(result);
              }
            })
            .catch((error) => {
              console.error('Deduplicated request error:', error);
              res.status(500).json({ 
                message: 'Request processing failed',
                error: 'deduplication_error'
              });
            });
          
          console.log(`🔄 Request deduplicated for key: ${key}`);
          return;
        }
      }

      // Create a promise to track this request
      const requestPromise = new Promise((resolve, reject) => {
        // Store original res.json and res.status methods
        const originalJson = res.json.bind(res);
        const originalStatus = res.status.bind(res);
        let statusCode = 200;
        let responseData: any;

        // Override res.status to capture status code
        res.status = (code: number) => {
          statusCode = code;
          return originalStatus(code);
        };

        // Override res.json to capture response data
        res.json = (data: any) => {
          responseData = data;
          resolve({ statusCode, data });
          return originalJson(data);
        };

        // Handle errors
        const originalNext = next;
        const wrappedNext = (error?: any) => {
          if (error) {
            reject(error);
          } else {
            originalNext();
          }
        };

        // Call the actual handler
        try {
          wrappedNext();
        } catch (error) {
          reject(error);
        }
      });

      // Store the pending request
      this.pendingRequests.set(key, {
        promise: requestPromise,
        timestamp: Date.now()
      });

      // Clean up after completion
      requestPromise.finally(() => {
        this.pendingRequests.delete(key);
      });
    };
  }

  /**
   * Middleware specifically for tag auto-fill operations
   */
  tagAutoFillDeduplication() {
    return this.createMiddleware({
      keyGenerator: (req: any) => `tag_fill_${req.params.sessionId}_${req.params.tagId}_${req.user?.id || 'unknown'}`,
      timeout: 15000, // 15 seconds timeout for auto-fill operations
      enabled: true
    });
  }

  /**
   * Middleware for tag update operations
   */
  tagUpdateDeduplication() {
    return this.createMiddleware({
      keyGenerator: (req: any) => `tag_update_${req.params.sessionId}_${req.params.tagId}_${req.user?.id || 'unknown'}`,
      timeout: 10000, // 10 seconds timeout for updates
      enabled: true
    });
  }

  /**
   * Middleware for tag position updates (most frequent)
   */
  tagPositionDeduplication() {
    return this.createMiddleware({
      keyGenerator: (req: any) => `tag_position_${req.params.sessionId}_${req.params.tagId}_${req.user?.id || 'unknown'}`,
      timeout: 5000, // 5 seconds timeout for position updates
      enabled: true
    });
  }

  /**
   * Middleware for text tag content updates
   */
  textTagContentDeduplication() {
    return this.createMiddleware({
      keyGenerator: (req: any) => `text_tag_content_${req.params.sessionId}_${req.params.tagId}_${req.user?.id || 'unknown'}`,
      timeout: 5000, // 5 seconds timeout for content updates
      enabled: true
    });
  }

  /**
   * Get current pending requests count (for monitoring)
   */
  getPendingRequestsCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Clear expired requests (cleanup)
   */
  clearExpiredRequests(maxAge: number = 60000): number {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, request] of Array.from(this.pendingRequests.entries())) {
      if (now - request.timestamp > maxAge) {
        this.pendingRequests.delete(key);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      console.log(`🧹 Cleared ${cleared} expired pending requests`);
    }
    
    return cleared;
  }
}

// Export singleton instance
export const requestDeduplicationService = new RequestDeduplicationService();

// Export commonly used middleware functions
export const tagAutoFillDeduplication = requestDeduplicationService.tagAutoFillDeduplication();
export const tagUpdateDeduplication = requestDeduplicationService.tagUpdateDeduplication();
export const tagPositionDeduplication = requestDeduplicationService.tagPositionDeduplication();
export const textTagContentDeduplication = requestDeduplicationService.textTagContentDeduplication();

// Cleanup job - run every 5 minutes
setInterval(() => {
  requestDeduplicationService.clearExpiredRequests();
}, 5 * 60 * 1000); 