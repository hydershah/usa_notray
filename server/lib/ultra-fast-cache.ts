/**
 * Ultra-Fast In-Memory Cache Service
 * Designed to get Railway database queries under 20ms
 */

interface CacheEntry<T = any> {
  data: T;
  expires: number;
  lastAccess: number;
  hitCount: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

class UltraFastCache {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0 };
  private maxSize = 1000; // Keep cache small for speed
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  /**
   * Get cached data - optimized for sub-millisecond access
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      console.log(`🔍 Cache MISS: ${key}`);
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      console.log(`⏰ Cache EXPIRED: ${key}`);
      return null;
    }

    // Update access stats
    entry.lastAccess = Date.now();
    entry.hitCount++;
    this.stats.hits++;

    console.log(`💾 Cache HIT: ${key} (${entry.hitCount} hits)`);
    return entry.data as T;
  }

  /**
   * Set cached data with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, {
      data,
      expires,
      lastAccess: Date.now(),
      hitCount: 0
    });

    console.log(`💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
  }

  /**
   * Smart cache invalidation for related keys
   */
  invalidate(pattern: string | string[]): number {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    let cleared = 0;

    for (const [key] of this.cache) {
      for (const p of patterns) {
        if (key.includes(p)) {
          this.cache.delete(key);
          cleared++;
          break;
        }
      }
    }

    if (cleared > 0) {
      console.log(`🎯 Smart invalidation: ${patterns.join(', ')} affecting ${cleared} keys`);
    }

    return cleared;
  }

  /**
   * Preload frequently accessed data
   */
  warmup(key: string, dataFetcher: () => Promise<any>, ttlSeconds: number = 300): void {
    // Only warmup if not already cached
    if (!this.cache.has(key)) {
      dataFetcher().then(data => {
        this.set(key, data, ttlSeconds);
        console.log(`🔥 Cache WARMED UP: ${key}`);
      }).catch(error => {
        console.log(`❌ Cache warmup failed for ${key}:`, error.message);
      });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
    console.log('🗑️  Cache cleared');
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: ${cleaned} expired entries removed`);
    }
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`⚡ Cache evicted: ${oldestKey}`);
    }
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Global cache instance
export const ultraCache = new UltraFastCache();

/**
 * Cache wrapper for database queries
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttlSeconds: number = 60
): Promise<T> {
  // Try cache first
  const cached = ultraCache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute query and cache result
  const start = Date.now();
  const result = await queryFn();
  const duration = Date.now() - start;

  ultraCache.set(key, result, ttlSeconds);
  console.log(`📊 DB Query cached: ${key} (${duration}ms)`);

  return result;
}

/**
 * Cache presets for common endpoints
 */
export const CachePresets = {
  // Static data - cache for 5 minutes
  STATIC: 300,
  
  // User data - cache for 2 minutes  
  USER_DATA: 120,
  
  // Session data - cache for 30 seconds
  SESSION_DATA: 30,
  
  // Real-time data - cache for 10 seconds
  REALTIME: 10,
  
  // Tag operations - cache for 15 seconds
  TAGS: 15
} as const;

export default ultraCache;
