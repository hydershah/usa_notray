import Redis from 'ioredis';
import { createHash } from 'crypto';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Whether to compress large values
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

export class CacheService {
  private redis: Redis;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };
  private keyPrefix: string;
  private isConnected: boolean = false;

  constructor() {
    this.keyPrefix = process.env.CACHE_KEY_PREFIX || 'usa_notary:';
    
    // Initialize Redis client
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
      // Connection pooling
      keepAlive: 30000,
      // Timeouts
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    this.setupEventHandlers();
    this.connect();
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      console.log('Redis connected');
      this.isConnected = true;
    });

    this.redis.on('ready', () => {
      console.log('Redis ready');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('Redis error:', error);
      this.stats.errors++;
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.log('Redis connection closed');
      this.isConnected = false;
    });

    this.redis.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });
  }

  private async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  private generateKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private generateHashKey(data: any): string {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 16);
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache get');
      return null;
    }

    try {
      const cacheKey = this.generateKey(key);
      const value = await this.redis.get(cacheKey);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value);
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache set');
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      const serializedValue = JSON.stringify(value);
      const ttl = options.ttl || 3600; // Default 1 hour

      await this.redis.setex(cacheKey, ttl, serializedValue);
      this.stats.sets++;
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      const result = await this.redis.del(cacheKey);
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const searchPattern = this.generateKey(pattern);
      const keys = await this.redis.keys(searchPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.redis.del(...keys);
      this.stats.deletes += keys.length;
      return result;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      const result = await this.redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Increment a numeric value in cache
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const cacheKey = this.generateKey(key);
      return await this.redis.incrby(cacheKey, amount);
    } catch (error) {
      console.error('Cache increment error:', error);
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * Set expiration for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(key);
      const result = await this.redis.expire(cacheKey, seconds);
      return result === 1;
    } catch (error) {
      console.error('Cache expire error:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { isConnected: boolean } {
    return {
      ...this.stats,
      isConnected: this.isConnected,
    };
  }

  /**
   * Clear all cache statistics
   */
  clearStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      console.error('Error closing Redis connection:', error);
    }
  }

  /**
   * Flush all cache data (use with caution)
   */
  async flushAll(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.redis.flushdb();
      console.log('Cache flushed');
    } catch (error) {
      console.error('Cache flush error:', error);
      this.stats.errors++;
    }
  }

  /**
   * Get cache info
   */
  async getInfo(): Promise<Record<string, string>> {
    if (!this.isConnected) {
      return {};
    }

    try {
      const info = await this.redis.info();
      const infoObj: Record<string, string> = {};
      
      info.split('\r\n').forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          infoObj[key] = value;
        }
      });

      return infoObj;
    } catch (error) {
      console.error('Cache info error:', error);
      return {};
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Helper functions for common caching patterns
export class CacheHelpers {
  /**
   * Cache a database query result
   */
  static async cacheQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    // Try to get from cache first
    const cached = await cacheService.get<T>(queryKey);
    if (cached !== null) {
      return cached;
    }

    // Execute query and cache result
    const result = await queryFn();
    await cacheService.set(queryKey, result, { ttl });
    return result;
  }

  /**
   * Cache user data with automatic invalidation
   */
  static async cacheUser(userId: number, userData: any, ttl: number = 1800): Promise<void> {
    await cacheService.set(`user:${userId}`, userData, { ttl });
  }

  /**
   * Invalidate user cache
   */
  static async invalidateUser(userId: number): Promise<void> {
    await cacheService.deletePattern(`user:${userId}*`);
  }

  /**
   * Cache job data
   */
  static async cacheJob(jobId: number, jobData: any, ttl: number = 3600): Promise<void> {
    await cacheService.set(`job:${jobId}`, jobData, { ttl });
  }

  /**
   * Cache company data
   */
  static async cacheCompany(companyId: number, companyData: any, ttl: number = 3600): Promise<void> {
    await cacheService.set(`company:${companyId}`, companyData, { ttl });
  }

  /**
   * Cache notary availability
   */
  static async cacheNotaryAvailability(notaryId: number, availabilityData: any, ttl: number = 900): Promise<void> {
    await cacheService.set(`notary:availability:${notaryId}`, availabilityData, { ttl });
  }

  /**
   * Cache system settings
   */
  static async cacheSystemSettings(settings: any, ttl: number = 7200): Promise<void> {
    await cacheService.set('system:settings', settings, { ttl });
  }

  /**
   * Generate cache key for complex queries
   */
  static generateQueryKey(tableName: string, conditions: Record<string, any>): string {
    const conditionsStr = Object.entries(conditions)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
    
    const hash = createHash('md5').update(conditionsStr).digest('hex').substring(0, 8);
    return `query:${tableName}:${hash}`;
  }
}

// Export cache helpers for easy use
export { CacheHelpers as cache }; 