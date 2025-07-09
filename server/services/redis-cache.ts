import Redis from 'ioredis';
import { performance } from 'perf_hooks';

export class RedisCache {
  private redis: Redis;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxRetries: number = 3;
  private disabled: boolean = false; // New flag to completely disable Redis

  constructor() {
    // Check if Redis should be disabled entirely
    if (process.env.DISABLE_REDIS === 'true') {
      console.log('⚠️ Redis explicitly disabled via DISABLE_REDIS environment variable');
      this.disabled = true;
      return;
    }

    // Detect deployment environment
    const isFlyIo = !!(process.env.FLY_APP_NAME || process.env.FLY_ALLOC_ID);
    const isRailway = !!process.env.RAILWAY_ENVIRONMENT;
    
    let redisUrl;
    
    if (isFlyIo) {
      // Fly.io Redis configuration
      redisUrl = process.env.REDIS_URL || 
                 process.env.UPSTASH_REDIS_REST_URL || 
                 process.env.REDIS_PRIVATE_URL ||
                 'redis://localhost:6379';
      console.log('🚁 Detected Fly.io environment for Redis configuration');
    } else if (isRailway) {
      // Railway Redis configuration (existing logic)
      redisUrl = process.env.REDIS_PUBLIC_URL || 
                 process.env.REDIS_URL || 
                 process.env.REDIS_PRIVATE_URL ||
                 'redis://localhost:6379';
      console.log('🚂 Detected Railway environment for Redis configuration');
    } else {
      // Other environments (local, AWS, etc.)
      redisUrl = process.env.REDIS_URL || 
                 process.env.REDIS_PUBLIC_URL || 
                 process.env.REDIS_PRIVATE_URL ||
                 process.env.REDISCLOUD_URL ||
                 'redis://localhost:6379';
      console.log('🌐 Using standard Redis configuration');
    }
    
    // Debug logging to see what Redis URL is being used
    console.log('🔍 Redis Connection Debug:', {
      REDIS_URL: process.env.REDIS_URL ? '[REDACTED]' : 'undefined',
      REDIS_PUBLIC_URL: process.env.REDIS_PUBLIC_URL ? '[REDACTED]' : 'undefined',
      REDIS_PRIVATE_URL: process.env.REDIS_PRIVATE_URL ? '[REDACTED]' : 'undefined',
      REDISCLOUD_URL: process.env.REDISCLOUD_URL ? '[REDACTED]' : 'undefined',
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL ? '[REDACTED]' : 'undefined',
      FLY_APP_NAME: process.env.FLY_APP_NAME || 'undefined',
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'undefined',
      environment: isFlyIo ? 'fly.io' : isRailway ? 'railway' : 'other',
      usingUrl: redisUrl.substring(0, 20) + '...' // Only show first 20 chars for security
    });
    
    // Redis connection options with environment-specific settings
    const redisOptions = {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: isFlyIo ? 1 : 3, // Fewer retries for Fly.io
      lazyConnect: true,
      connectTimeout: isFlyIo ? 5000 : 10000, // Shorter timeout for Fly.io
      commandTimeout: 5000,
      keepAlive: 30000,
      family: 4,
      maxLoadingTimeout: 1000,
      enableReadyCheck: !isFlyIo, // Disable ready check for Fly.io
      reconnectOnError: (err) => {
        console.log('Redis reconnection error:', err.message);
        
        // Don't retry for DNS resolution failures
        if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
          console.warn('⚠️ Redis hostname resolution failed - disabling Redis for this session');
          this.disabled = true;
          return false; // Don't reconnect
        }
        
        const shouldReconnect = err.message.includes('READONLY') || 
                               err.message.includes('ECONNRESET') ||
                               err.message.includes('ETIMEDOUT');
        
        if (!shouldReconnect) {
          this.disabled = true;
        }
        
        return shouldReconnect;
      },
      showFriendlyErrorStack: true
    };
    
    // Add Fly.io specific options
    if (isFlyIo) {
      redisOptions.enableReadyCheck = false;
      redisOptions.maxRetriesPerRequest = 1;
      redisOptions.connectTimeout = 5000;
    }
    
    // Add Railway-specific connection options
    if (isRailway) {
      redisOptions.enableReadyCheck = false;
      redisOptions.maxRetriesPerRequest = 5;
      redisOptions.connectTimeout = 20000;
    }
    
    this.redis = new Redis(redisUrl, redisOptions);

    this.redis.on('connect', () => {
      this.isConnected = true;
      this.disabled = false;
      console.log('✅ Redis connected successfully');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      this.disabled = false;
      console.log('✅ Redis ready for operations');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
      this.isConnected = false;
      
      // Check for permanent failures that should disable Redis
      const permanentFailures = [
        'ENOTFOUND',          // DNS resolution failure
        'getaddrinfo',        // DNS lookup failure
        'ECONNREFUSED',       // Connection refused (service not running)
        'EHOSTUNREACH'        // Host unreachable
      ];
      
      const isPermanentFailure = permanentFailures.some(failure => 
        err.message.includes(failure)
      );
      
      if (isPermanentFailure) {
        console.warn('⚠️ Permanent Redis failure detected. Disabling Redis for this session.');
        console.warn('   This usually means Redis service is not configured or not running.');
        console.warn('   App will continue without Redis caching.');
        this.disabled = true;
        this.connectionAttempts = this.maxRetries; // Stop further attempts
        return; // Don't retry for permanent failures
      }
      
      // For temporary failures, implement limited retry
      if (this.connectionAttempts < this.maxRetries && !this.disabled) {
        this.connectionAttempts++;
        const retryDelay = Math.min(1000 * this.connectionAttempts, 10000); // Max 10 second delay
        
        console.log(`🔄 Redis reconnection attempt ${this.connectionAttempts}/${this.maxRetries} in ${retryDelay}ms`);
        
        setTimeout(() => {
          if (!this.disabled) {
            this.redis.connect().catch(reconnectErr => {
              console.error(`❌ Redis reconnection attempt ${this.connectionAttempts} failed:`, reconnectErr.message);
            });
          }
        }, retryDelay);
      } else {
        console.warn('⚠️ Redis max retries exceeded or disabled. App will continue without Redis caching.');
        this.disabled = true;
      }
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      console.log('🔌 Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      if (!this.disabled) {
        console.log('🔄 Redis reconnecting...');
      }
    });

    // Initial connection attempt with better error handling
    this.redis.connect().catch(err => {
      console.error('❌ Failed to establish initial Redis connection:', err.message);
      this.isConnected = false;
      
      // Check for service discovery issues
      if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
        console.warn('⚠️ Redis service not available. This might be because:');
        console.warn('   1. Redis service is not configured in your deployment platform');
        console.warn('   2. Redis hostname/URL is incorrect');
        console.warn('   3. Redis service is not running or not accessible');
        console.warn('   App will continue without Redis caching.');
        this.disabled = true;
      }
    });
  }

  /**
   * Check if Redis is disabled or unavailable
   */
  private isDisabled(): boolean {
    return this.disabled || (!this.isConnected && this.connectionAttempts >= this.maxRetries);
  }

  /**
   * Get cached value with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    if (this.isDisabled()) return null;

    try {
      const startTime = performance.now();
      const value = await this.redis.get(key);
      const duration = performance.now() - startTime;
      
      if (duration > 10) {
        console.log(`🐌 Slow Redis GET: ${key} (${duration.toFixed(2)}ms)`);
      }

      if (value === null) return null;
      
      try {
        return JSON.parse(value);
      } catch {
        return value as T;
      }
    } catch (error) {
      console.error('Redis GET error:', error);
      return null;
    }
  }

  /**
   * Set cached value with automatic JSON stringification
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    if (this.isDisabled()) return false;

    try {
      const startTime = performance.now();
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      
      let result;
      if (ttlSeconds) {
        result = await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        result = await this.redis.set(key, serialized);
      }
      
      const duration = performance.now() - startTime;
      if (duration > 10) {
        console.log(`🐌 Slow Redis SET: ${key} (${duration.toFixed(2)}ms)`);
      }

      return result === 'OK';
    } catch (error) {
      console.error('Redis SET error:', error);
      return false;
    }
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<boolean> {
    if (this.isDisabled()) return false;

    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  /**
   * Delete keys matching a pattern
   */
  async delPattern(pattern: string): Promise<number> {
    if (this.isDisabled()) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;
      
      const result = await this.redis.del(...keys);
      return result;
    } catch (error) {
      console.error('Redis DEL pattern error:', error);
      return 0;
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    if (this.isDisabled()) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS error:', error);
      return false;
    }
  }

  /**
   * Get TTL of a key
   */
  async ttl(key: string): Promise<number> {
    if (this.isDisabled()) return -1;

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error('Redis TTL error:', error);
      return -1;
    }
  }

  /**
   * Cache a database query result
   */
  async cacheQuery<T>(
    key: string, 
    queryFn: () => Promise<T>, 
    ttlSeconds: number = 300
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      console.log(`📦 Cache HIT: ${key}`);
      return cached;
    }

    // Execute query and cache result
    console.log(`🔍 Cache MISS: ${key}`);
    const startTime = performance.now();
    const result = await queryFn();
    const queryTime = performance.now() - startTime;

    // Cache the result (don't await to avoid blocking)
    if (!this.isDisabled()) {
      this.set(key, result, ttlSeconds).catch(err => {
        console.error(`Failed to cache query result for ${key}:`, err);
      });
    }
    
    console.log(`💾 Query executed: ${key} (${queryTime.toFixed(2)}ms)`);
    return result;
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    if (this.isDisabled()) {
      return { 
        healthy: false, 
        error: 'Redis is disabled due to connection failures' 
      };
    }

    if (!this.isConnected) {
      return { 
        healthy: false, 
        error: 'Redis not connected' 
      };
    }

    try {
      const startTime = performance.now();
      await this.redis.ping();
      const latency = performance.now() - startTime;
      
      return { 
        healthy: true, 
        latency 
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get Redis info and statistics
   */
  async getInfo(): Promise<any> {
    if (this.isDisabled()) {
      return {
        connected: false,
        disabled: true,
        reason: 'Redis disabled due to connection failures'
      };
    }

    try {
      const info = await this.redis.info();
      const dbSize = await this.redis.dbsize();
      
      return {
        connected: this.isConnected,
        disabled: this.disabled,
        connectionAttempts: this.connectionAttempts,
        dbSize,
        info: this.parseRedisInfo(info)
      };
    } catch (error) {
      return {
        connected: false,
        disabled: this.disabled,
        error: error.message
      };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): any {
    const result: any = {};
    const sections = info.split('\r\n\r\n');
    
    for (const section of sections) {
      const lines = section.split('\r\n');
      const sectionName = lines[0].replace('# ', '').toLowerCase();
      
      if (sectionName && lines.length > 1) {
        result[sectionName] = {};
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (line && line.includes(':')) {
            const [key, value] = line.split(':');
            result[sectionName][key] = value;
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Flush all Redis data (use with caution)
   */
  async flushAll(): Promise<boolean> {
    if (this.isDisabled()) return false;

    try {
      await this.redis.flushall();
      console.log('🧹 Redis: All data flushed');
      return true;
    } catch (error) {
      console.error('Redis FLUSHALL error:', error);
      return false;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis && !this.disabled) {
      try {
        await this.redis.quit();
        console.log('🔌 Redis connection closed gracefully');
      } catch (error) {
        console.error('Error closing Redis connection:', error);
      }
    }
  }
}

// Export singleton instance
export const redisCache = new RedisCache(); 