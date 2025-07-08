#!/usr/bin/env node

/**
 * Cache Management Utility
 * 
 * Usage:
 *   node cache-utils.js clear-all                    # Clear all caches
 *   node cache-utils.js clear-jobs                   # Clear job caches only
 *   node cache-utils.js clear-users                  # Clear user caches only
 *   node cache-utils.js clear-companies              # Clear company caches only
 *   node cache-utils.js clear-user 25                # Clear specific user cache
 *   node cache-utils.js show-keys                    # Show all cache keys
 *   node cache-utils.js show-keys "*jobs*"           # Show keys matching pattern
 */

const redis = require('redis');

async function main() {
  const command = process.argv[2];
  const param = process.argv[3];

  const client = redis.createClient({ 
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: { reconnectStrategy: retries => Math.min(retries * 50, 500) }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Redis');

    switch (command) {
      case 'clear-all':
        await clearAllCaches(client);
        break;
      
      case 'clear-jobs':
        await clearJobCaches(client);
        break;
      
      case 'clear-users':
        await clearUserCaches(client);
        break;
      
      case 'clear-companies':
        await clearCompanyCaches(client);
        break;
      
      case 'clear-user':
        if (!param) {
          console.error('❌ Usage: node cache-utils.js clear-user <userId>');
          process.exit(1);
        }
        await clearUserCache(client, param);
        break;
      
      case 'show-keys':
        await showKeys(client, param || '*');
        break;
      
      case 'stats':
        await showStats(client);
        break;
      
      default:
        console.log(`
Cache Management Utility

Available commands:
  clear-all                    Clear all caches
  clear-jobs                   Clear job caches only
  clear-users                  Clear user caches only  
  clear-companies              Clear company caches only
  clear-user <userId>          Clear specific user cache
  show-keys [pattern]          Show cache keys (default: all)
  stats                        Show cache statistics

Examples:
  node cache-utils.js clear-all
  node cache-utils.js clear-user 25
  node cache-utils.js show-keys "*jobs*"
        `);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.disconnect();
    console.log('🔌 Disconnected from Redis');
  }
}

async function clearAllCaches(client) {
  console.log('🧹 Clearing ALL caches...');
  const deleted = await delPattern(client, '*');
  console.log(`✅ Cleared ${deleted} total cache keys`);
}

async function clearJobCaches(client) {
  console.log('🧹 Clearing job caches...');
  const patterns = ['*jobs*', 'api:*jobs*', 'admin:*jobs*'];
  let total = 0;
  
  for (const pattern of patterns) {
    const deleted = await delPattern(client, pattern);
    console.log(`  ${pattern}: ${deleted} keys`);
    total += deleted;
  }
  
  console.log(`✅ Cleared ${total} job cache keys`);
}

async function clearUserCaches(client) {
  console.log('🧹 Clearing user caches...');
  const patterns = ['*users*', 'api:*users*', 'admin:*users*', 'user:*'];
  let total = 0;
  
  for (const pattern of patterns) {
    const deleted = await delPattern(client, pattern);
    console.log(`  ${pattern}: ${deleted} keys`);
    total += deleted;
  }
  
  console.log(`✅ Cleared ${total} user cache keys`);
}

async function clearCompanyCaches(client) {
  console.log('🧹 Clearing company caches...');
  const patterns = ['*companies*', 'api:*companies*', 'admin:*companies*', 'company:*'];
  let total = 0;
  
  for (const pattern of patterns) {
    const deleted = await delPattern(client, pattern);
    console.log(`  ${pattern}: ${deleted} keys`);
    total += deleted;
  }
  
  console.log(`✅ Cleared ${total} company cache keys`);
}

async function clearUserCache(client, userId) {
  console.log(`🧹 Clearing cache for user ${userId}...`);
  const deleted = await delPattern(client, `user:${userId}:*`);
  console.log(`✅ Cleared ${deleted} cache keys for user ${userId}`);
}

async function showKeys(client, pattern = '*') {
  console.log(`🔍 Cache keys matching pattern: ${pattern}`);
  const keys = await scanKeys(client, pattern);
  
  if (keys.length === 0) {
    console.log('  No keys found');
    return;
  }
  
  console.log(`  Found ${keys.length} keys:`);
  keys.slice(0, 50).forEach(key => console.log(`    ${key}`));
  
  if (keys.length > 50) {
    console.log(`    ... and ${keys.length - 50} more`);
  }
}

async function showStats(client) {
  console.log('📊 Cache Statistics:');
  
  const info = await client.info('memory');
  const keyCount = await client.dbSize();
  
  console.log(`  Total keys: ${keyCount}`);
  console.log(`  Memory usage: ${extractMemoryUsage(info)}`);
  
  // Show key patterns
  const patterns = ['*jobs*', '*users*', '*companies*', 'user:*', 'admin:*'];
  
  for (const pattern of patterns) {
    const keys = await scanKeys(client, pattern);
    if (keys.length > 0) {
      console.log(`  ${pattern}: ${keys.length} keys`);
    }
  }
}

async function delPattern(client, pattern) {
  const keys = await scanKeys(client, pattern);
  if (keys.length === 0) return 0;
  
  return await client.del(keys);
}

async function scanKeys(client, pattern) {
  const keys = [];
  let cursor = '0';
  
  do {
    const reply = await client.scan(cursor, {
      MATCH: pattern,
      COUNT: 100
    });
    cursor = reply.cursor;
    keys.push(...reply.keys);
  } while (cursor !== '0');
  
  return keys;
}

function extractMemoryUsage(info) {
  const match = info.match(/used_memory_human:([^\r\n]+)/);
  return match ? match[1] : 'unknown';
}

if (require.main === module) {
  main().catch(console.error);
} 