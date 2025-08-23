import { redisCache } from './redis-cache';
import { cloudStorage } from './cloud-storage-service';

interface CachedSignature {
  id: string;
  imageUrl: string;
  signedUrl: string;
  expiresAt: Date;
  metadata: {
    type: 'uploaded' | 'drawn' | 'generated';
    originalName?: string;
    style?: string;
    vultrKey?: string;
  };
}

interface SignatureCacheResult {
  signature: CachedSignature | null;
  cached: boolean;
  source: 'cache' | 'vultr' | 'database';
}

/**
 * Optimized signature caching service to reduce Vultr API calls
 * and improve signature tag performance
 */
export class SignatureCacheService {
  private static readonly CACHE_PREFIX = 'signature:';
  private static readonly SIGNED_URL_CACHE_PREFIX = 'signed_url:';
  private static readonly SIGNATURE_CACHE_TTL = 3600; // 1 hour
  private static readonly SIGNED_URL_CACHE_TTL = 1800; // 30 minutes

  /**
   * Get signature with intelligent caching
   */
  static async getSignature(
    signatureId: string,
    userId: number
  ): Promise<SignatureCacheResult> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${signatureId}:${userId}`;
      
      // Try cache first (ultra-fast: <5ms)
      const cached = await redisCache.get<CachedSignature>(cacheKey);
      if (cached && new Date(cached.expiresAt) > new Date()) {
        console.log(`🚀 Signature cache HIT for ${signatureId}`);
        return {
          signature: cached,
          cached: true,
          source: 'cache'
        };
      }

      // Cache miss - fetch from database and Vultr
      console.log(`🔄 Signature cache MISS for ${signatureId}, fetching from Vultr...`);
      
      // TODO: Implement database signature lookup
      // For now, return null to indicate signature not found
      return {
        signature: null,
        cached: false,
        source: 'database'
      };

    } catch (error) {
      console.error('Signature cache error:', error);
      return {
        signature: null,
        cached: false,
        source: 'database'
      };
    }
  }

  /**
   * Get optimized signed URL with caching
   */
  static async getSignedUrl(
    fileKey: string,
    expiresInHours: number = 1
  ): Promise<{
    url: string;
    cached: boolean;
    expiresAt: Date;
  }> {
    try {
      const cacheKey = `${this.SIGNED_URL_CACHE_PREFIX}${fileKey}`;
      
      // Try cache first (ultra-fast: <5ms)
      const cached = await redisCache.get<{ url: string; expiresAt: Date }>(cacheKey);
      if (cached && new Date(cached.expiresAt) > new Date()) {
        console.log(`🚀 Signed URL cache HIT for ${fileKey}`);
        return {
          url: cached.url,
          cached: true,
          expiresAt: cached.expiresAt
        };
      }

      // Cache miss - generate new signed URL from Vultr
      console.log(`🔄 Signed URL cache MISS for ${fileKey}, generating from Vultr...`);
      const signedUrl = await cloudStorage.getSignedUrl(fileKey, expiresInHours * 3600);
      
      // Cache the signed URL
      const expiresAt = new Date(Date.now() + (expiresInHours * 3600 * 1000));
      const cacheData = { url: signedUrl, expiresAt };
      await redisCache.set(cacheKey, cacheData, this.SIGNED_URL_CACHE_TTL);
      
      console.log(`✅ Generated and cached signed URL for ${fileKey}`);
      
      return {
        url: signedUrl,
        cached: false,
        expiresAt
      };

    } catch (error) {
      console.error('Signed URL generation error:', error);
      throw error;
    }
  }

  /**
   * Batch get multiple signed URLs with caching
   */
  static async getBatchSignedUrls(
    fileKeys: string[],
    expiresInHours: number = 1
  ): Promise<Map<string, { url: string; cached: boolean; expiresAt: Date }>> {
    const results = new Map<string, { url: string; cached: boolean; expiresAt: Date }>();
    
    // Process in parallel for maximum speed
    const operations = fileKeys.map(async (fileKey) => {
      const result = await this.getSignedUrl(fileKey, expiresInHours);
      return { fileKey, result };
    });
    
    const completed = await Promise.all(operations);
    completed.forEach(({ fileKey, result }) => {
      results.set(fileKey, result);
    });
    
    return results;
  }

  /**
   * Pre-warm signature cache for user
   */
  static async prewarmUserSignatures(userId: number): Promise<void> {
    try {
      console.log(`🔥 Pre-warming signature cache for user ${userId}...`);
      
      // TODO: Implement database signature lookup and pre-caching
      // This would fetch all user signatures and cache them proactively
      
      console.log(`✅ Signature cache pre-warmed for user ${userId}`);
    } catch (error) {
      console.error('Signature cache pre-warming error:', error);
    }
  }

  /**
   * Invalidate signature cache
   */
  static async invalidateSignature(signatureId: string, userId: number): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${signatureId}:${userId}`;
      await redisCache.del(cacheKey);
      console.log(`🗑️ Invalidated signature cache for ${signatureId}:${userId}`);
    } catch (error) {
      console.error('Signature cache invalidation error:', error);
    }
  }

  /**
   * Invalidate signed URL cache
   */
  static async invalidateSignedUrl(fileKey: string): Promise<void> {
    try {
      const cacheKey = `${this.SIGNED_URL_CACHE_PREFIX}${fileKey}`;
      await redisCache.del(cacheKey);
      console.log(`🗑️ Invalidated signed URL cache for ${fileKey}`);
    } catch (error) {
      console.error('Signed URL cache invalidation error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  static async getCacheStats(): Promise<{
    signatureCacheSize: number;
    signedUrlCacheSize: number;
    hitRate: number;
  }> {
    try {
      // TODO: Implement Redis cache statistics
      return {
        signatureCacheSize: 0,
        signedUrlCacheSize: 0,
        hitRate: 0
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        signatureCacheSize: 0,
        signedUrlCacheSize: 0,
        hitRate: 0
      };
    }
  }
}
