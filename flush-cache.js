import { redisCache } from './server/services/redis-cache.js';
import { CacheManager } from './server/services/cache-manager.js';

async function flushAllCache() {
  console.log('🧹 Starting cache flush operation...');
  
  try {
    // 1. Flush Redis cache
    console.log('🔄 Flushing Redis cache...');
    const redisResult = await redisCache.flushAll();
    if (redisResult) {
      console.log('✅ Redis cache flushed successfully');
    } else {
      console.log('⚠️  Redis cache flush failed or disabled');
    }

    // 2. Clear all cache patterns via CacheManager
    console.log('🔄 Clearing all cache patterns...');
    await CacheManager.invalidateAllCaches();
    console.log('✅ Cache patterns cleared successfully');

    // 3. Clear specific cache patterns for good measure
    console.log('🔄 Clearing additional cache patterns...');
    const patterns = [
      'admin:*',
      'user:*', 
      'job:*',
      'session:*',
      'api:*',
      'editor:*',
      'company:*',
      'notary:*'
    ];

    let totalCleared = 0;
    for (const pattern of patterns) {
      try {
        const deleted = await redisCache.delPattern(pattern);
        totalCleared += deleted;
        if (deleted > 0) {
          console.log(`   ${pattern} → ${deleted} keys deleted`);
        }
      } catch (error) {
        console.warn(`   Failed to clear ${pattern}:`, error.message);
      }
    }

    console.log('');
    console.log('🎉 Cache flush completed successfully!');
    console.log(`📊 Total keys cleared: ${totalCleared}`);
    console.log('');
    console.log('You may want to restart your application to ensure all in-memory caches are cleared.');

  } catch (error) {
    console.error('❌ Cache flush failed:', error);
    process.exit(1);
  }
}

// Run the flush operation
if (import.meta.url === `file://${process.argv[1]}`) {
  flushAllCache()
    .then(() => {
      console.log('✅ Cache flush operation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cache flush operation failed:', error);
      process.exit(1);
    });
}

export { flushAllCache }; 