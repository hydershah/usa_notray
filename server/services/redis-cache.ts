import Redis from 'ioredis';
import { performance } from 'perf_hooks';

export class RedisCache {
  private redis: Redis;
  private isConnected: boolean = false;
  private connectionAttempts: number = 0;
  private maxRetries: number = 3;

  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6379,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10000,
      commandTimeout: 5000,
      keepAlive: 30000,
      family: 4,
      maxLoadingTimeout: 1000,
      enableReadyCheck: true,
      reconnectOnError: (err) => {
        console.log('Redis reconnection error:', err.message);
        const targetError = 'READONLY';
        return err.message.includes(targetError) || err.message.includes('ECONNRESET') || err.message.includes('ENOTFOUND');
      },
      showFriendlyErrorStack: true
    });

    this.redis.on('connect', () => {
      this.isConnected = true;
      console.log('✅ Redis connected successfully');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      console.log('✅ Redis ready for operations');
    });

    this.redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
      this.isConnected = false;
      
      if (this.connectionAttempts < this.maxRetries) {
        this.connectionAttempts++;
        setTimeout(() => {
          console.log(`🔄 Redis reconnection attempt ${this.connectionAttempts}/${this.maxRetries}`);
          this.redis.connect().catch(reconnectErr => {
            console.error(`❌ Redis reconnection attempt ${this.connectionAttempts} failed:`, reconnectErr.message);
          });
        }, 1000 * this.connectionAttempts);
      }
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      console.log('🔌 Redis connection closed');
    });

    this.redis.on('reconnecting', () => {
      console.log('�� Redis reconnecting...');
    });

    this.redis.connect().catch(err => {
      console.error('❌ Failed to establish initial Redis connection:', err.message);
      this.isConnected = false;
    });
  }

  /**
   * Get cached value with automatic JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) return null;

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
    if (!this.isConnected) return false;

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
   * Delete cached value
   */
  async del(key: string): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      console.error('Redis DEL error:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async delPattern(pattern: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const startTime = performance.now();
      
      // Use SCAN to find keys matching pattern
      const keys = [];
      let cursor = '0';
      
      do {
        const reply = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = reply[0];
        keys.push(...reply[1]);
      } while (cursor !== '0');

      if (keys.length > 0) {
        const result = await this.redis.del(...keys);
        const duration = performance.now() - startTime;
        
        console.log(`🧹 Deleted ${result} keys matching pattern: ${pattern} (${duration.toFixed(2)}ms)`);
        return result;
      }
      
      return 0;
    } catch (error) {
      console.error('Redis DEL PATTERN error:', error);
      return 0;
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

    // Cache the result
    await this.set(key, result, ttlSeconds);
    
    console.log(`💾 Cached query: ${key} (${queryTime.toFixed(2)}ms)`);
    return result;
  }

  /**
   * Cache user session data
   */
  async cacheUserSession(userId: string, sessionData: any, ttlSeconds: number = 3600): Promise<void> {
    await this.set(`user:${userId}:session`, sessionData, ttlSeconds);
  }

  /**
   * Get user session from cache
   */
  async getUserSession(userId: string): Promise<any | null> {
    return await this.get(`user:${userId}:session`);
  }

  /**
   * Clear user session cache
   */
  async clearUserSession(userId: string): Promise<void> {
    await this.del(`user:${userId}:session`);
  }

  /**
   * Cache API response
   */
  async cacheApiResponse(endpoint: string, params: any, response: any, ttlSeconds: number = 300): Promise<void> {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    await this.set(key, response, ttlSeconds);
  }

  /**
   * Get cached API response
   */
  async getCachedApiResponse(endpoint: string, params: any): Promise<any | null> {
    const key = `api:${endpoint}:${JSON.stringify(params)}`;
    return await this.get(key);
  }

  /**
   * Invalidate cache for a specific entity
   */
  async invalidateEntity(entityType: string, entityId: string): Promise<void> {
    const patterns = [
      `${entityType}:${entityId}:*`,
      `api:*${entityType}*${entityId}*`,
      `query:${entityType}:*`
    ];

    for (const pattern of patterns) {
      await this.delPattern(pattern);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.isConnected) {
      return { connected: false, error: 'Redis not connected' };
    }

    try {
      const info = await this.redis.info('memory');
      const keyCount = await this.redis.dbsize();
      
      return {
        connected: true,
        keyCount,
        memory: info,
        connectionAttempts: this.connectionAttempts
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const startTime = performance.now();
      await this.redis.ping();
      const latency = performance.now() - startTime;
      
      return { healthy: true, latency };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
    this.isConnected = false;
  }
}

// Export singleton instance
export const redisCache = new RedisCache(); 