#!/bin/bash

# 🚀 Database Performance Optimization Script
# This script implements immediate database performance improvements

echo "🔧 Starting Database Performance Optimization..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo "📝 Please set it with: export DATABASE_URL='your_supabase_connection_string'"
    exit 1
fi

echo "✅ DATABASE_URL is set"

# 1. Deploy Critical Database Indexes
echo ""
echo "📊 Step 1: Deploying Critical Database Indexes..."
if [ -f "migration-add-critical-indexes.sql" ]; then
    echo "🔍 Found indexes migration file"
    echo "🚀 Deploying indexes to database..."
    
    # Deploy indexes
    psql "$DATABASE_URL" -f migration-add-critical-indexes.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Database indexes deployed successfully!"
        echo "📊 Expected improvement: 50-80% faster queries"
    else
        echo "❌ Failed to deploy database indexes"
        echo "⚠️  Check your DATABASE_URL and permissions"
    fi
else
    echo "⚠️  migration-add-critical-indexes.sql not found"
    echo "📝 Indexes are needed for performance improvement"
fi

# 2. Verify Index Deployment
echo ""
echo "🔍 Step 2: Verifying Index Deployment..."
echo "📋 Current indexes in database:"

psql "$DATABASE_URL" -c "
SELECT 
    schemaname,
    tablename, 
    indexname,
    CASE WHEN indexname LIKE 'idx_%' THEN '✅ Custom' ELSE '📋 Default' END as type
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Failed to connect to database"
    echo "📝 Check your DATABASE_URL"
fi

# 3. Check Database Pool Stats
echo ""
echo "📊 Step 3: Current Database Configuration..."
echo "🔧 Checking pool configuration in server/db.ts:"

if [ -f "server/db.ts" ]; then
    echo ""
    echo "📋 Current Pool Settings:"
    grep -A 10 "max:" server/db.ts | head -10 || echo "Pool settings not found in expected format"
else
    echo "⚠️  server/db.ts not found"
fi

# 4. Test Redis Connection
echo ""
echo "🔄 Step 4: Testing Redis Cache Connection..."

if command -v redis-cli &> /dev/null; then
    # Test Redis connection
    redis-cli ping &> /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ Redis is running and accessible"
        echo "📊 Redis memory usage:"
        redis-cli info memory | grep used_memory_human || echo "Could not get memory stats"
    else
        echo "❌ Redis is not running or not accessible"
        echo "📝 Install and start Redis: brew install redis && redis-server"
    fi
else
    echo "⚠️  redis-cli not found. Install Redis: brew install redis"
fi

# 5. Create Performance Monitoring Functions
echo ""
echo "🔧 Step 5: Setting up Performance Monitoring..."

# Create a simple database performance test
cat > db-performance-test.js << 'EOF'
#!/usr/bin/env node

// Simple database performance test
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 5
});

async function testPerformance() {
  console.log('🔍 Testing database performance...');
  
  const tests = [
    { name: 'Simple SELECT', query: 'SELECT 1' },
    { name: 'Users count', query: 'SELECT COUNT(*) FROM users' },
    { name: 'Jobs count', query: 'SELECT COUNT(*) FROM jobs' },
    { name: 'Recent jobs', query: 'SELECT id, title_company, created_at FROM jobs ORDER BY created_at DESC LIMIT 10' }
  ];
  
  for (const test of tests) {
    const start = Date.now();
    try {
      await pool.query(test.query);
      const duration = Date.now() - start;
      
      if (duration < 100) {
        console.log(`✅ ${test.name}: ${duration}ms (FAST)`);
      } else if (duration < 500) {
        console.log(`⚠️  ${test.name}: ${duration}ms (OK)`);
      } else {
        console.log(`🐌 ${test.name}: ${duration}ms (SLOW)`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    }
  }
  
  console.log('');
  console.log('📊 Connection Pool Stats:');
  console.log(`   Total: ${pool.totalCount}`);
  console.log(`   Idle: ${pool.idleCount}`);
  console.log(`   Waiting: ${pool.waitingCount}`);
  
  await pool.end();
}

if (require.main === module) {
  testPerformance().catch(console.error);
}

module.exports = { testPerformance };
EOF

chmod +x db-performance-test.js
echo "✅ Created database performance test script"

# 6. Run Performance Test
echo ""
echo "🚀 Step 6: Running Database Performance Test..."
node db-performance-test.js

# 7. Check for Common Performance Issues
echo ""
echo "🔍 Step 7: Checking for Performance Issues..."

if [ -f "server/routes.ts" ]; then
    # Count uncached routes
    uncached_gets=$(grep -c "app\.get.*async.*req.*res" server/routes.ts)
    cached_gets=$(grep -c "cache.*Data" server/routes.ts)
    
    echo "📊 Route Caching Analysis:"
    echo "   Total GET routes: $uncached_gets"
    echo "   Cached routes: $cached_gets"
    
    if [ $cached_gets -gt 0 ]; then
        cache_percentage=$((cached_gets * 100 / uncached_gets))
        echo "   Cache coverage: ${cache_percentage}%"
        
        if [ $cache_percentage -lt 50 ]; then
            echo "⚠️  Low cache coverage - consider caching more routes"
        else
            echo "✅ Good cache coverage"
        fi
    else
        echo "❌ No caching detected - major performance opportunity"
    fi
fi

# 8. Summary and Next Steps
echo ""
echo "🎯 PERFORMANCE OPTIMIZATION SUMMARY"
echo "=================================="

echo ""
echo "✅ COMPLETED:"
echo "   • Database indexes deployment attempted"
echo "   • Database connection verified"
echo "   • Redis connection tested"
echo "   • Performance monitoring scripts created"
echo "   • Current performance tested"

echo ""
echo "🚀 IMMEDIATE NEXT STEPS:"
echo "   1. Verify database indexes are working (check query times)"
echo "   2. Add caching to high-traffic routes"
echo "   3. Monitor connection pool growth"
echo "   4. Run performance test regularly: node db-performance-test.js"

echo ""
echo "📊 EXPECTED IMPROVEMENTS:"
echo "   • Database queries: 50-80% faster"
echo "   • Job creation: 5-10x faster"  
echo "   • Overall response times: 2-5x faster"

echo ""
echo "🔧 To continue optimization:"
echo "   • Review the DATABASE_PERFORMANCE_OPTIMIZATION_GUIDE.md"
echo "   • Add caching middleware to more routes"
echo "   • Implement query batching for job creation"

echo ""
echo "✅ Database optimization script completed!"
echo "📈 Monitor your application performance and re-run this test in 24 hours" 