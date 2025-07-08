#!/usr/bin/env node

// Test Redis cache functionality for document URLs
import Redis from 'ioredis';

async function testRedisCache() {
  console.log('🧪 Testing Redis cache functionality...\n');
  
  const redis = new Redis(process.env.REDIS_URL || process.env.REDIS_PUBLIC_URL || 'redis://localhost:6379', {
    lazyConnect: true
  });

  try {
    // Test basic connectivity
    await redis.connect();
    console.log('✅ Redis connection successful');
    
    // Test cache set/get
    const testKey = 'test:document:url';
    const testData = {
      fileKey: 'development/document/2025/07/notarizations/job-24/test.pdf',
      signedUrl: 'https://test.vultrobjects.com/test.pdf',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      cached: false
    };
    
    console.log('📝 Setting test cache data...');
    await redis.setex(testKey, 3600, JSON.stringify(testData));
    
    console.log('📖 Retrieving test cache data...');
    const cached = await redis.get(testKey);
    const parsed = JSON.parse(cached);
    
    console.log('✅ Cache test successful:', {
      key: testKey,
      cached: !!cached,
      data: parsed
    });
    
    // Test cache performance
    console.log('\n⚡ Testing cache performance...');
    const iterations = 100;
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      await redis.get(testKey);
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;
    
    console.log(`✅ Cache performance: ${avgTime.toFixed(2)}ms average per operation`);
    console.log(`📊 Total time for ${iterations} operations: ${endTime - startTime}ms`);
    
    // Clean up
    await redis.del(testKey);
    console.log('🧹 Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Redis test failed:', error.message);
  } finally {
    await redis.quit();
    console.log('🔌 Redis connection closed');
  }
}

testRedisCache(); 