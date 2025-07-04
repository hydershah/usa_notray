#!/bin/bash

# Emergency Fixes Script for USA Notary System
# Run this script to implement critical performance fixes

echo "🚨 STARTING EMERGENCY FIXES FOR USA NOTARY SYSTEM"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# 1. Deploy Database Indexes (CRITICAL)
echo ""
echo "📊 1. DEPLOYING DATABASE INDEXES..."
echo "-----------------------------------"

if [ ! -f "migration-add-critical-indexes.sql" ]; then
    echo "❌ Error: migration-add-critical-indexes.sql not found"
    echo "   Please ensure the migration file exists before running this script"
else
    if [ -z "$DATABASE_URL" ]; then
        echo "⚠️  DATABASE_URL not set. Please run:"
        echo "   export DATABASE_URL='your_database_url_here'"
        echo "   Then run: psql \$DATABASE_URL -f migration-add-critical-indexes.sql"
    else
        echo "Deploying indexes to database..."
        psql $DATABASE_URL -f migration-add-critical-indexes.sql
        if [ $? -eq 0 ]; then
            echo "✅ Database indexes deployed successfully"
        else
            echo "❌ Failed to deploy indexes. Check your DATABASE_URL"
        fi
    fi
fi

# 2. Install Critical Dependencies
echo ""
echo "📦 2. INSTALLING CRITICAL DEPENDENCIES..."
echo "----------------------------------------"

echo "Installing Redis and performance packages..."
npm install ioredis@^5.3.2 express-rate-limit@^7.1.5 compression@^1.7.4 helmet@^7.1.0

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# 3. Create Environment Variables Template
echo ""
echo "⚙️  3. CREATING ENVIRONMENT CONFIGURATION..."
echo "--------------------------------------------"

# Create .env.example with required variables
cat > .env.emergency << 'EOF'
# EMERGENCY PERFORMANCE FIXES
# Copy these to your .env file

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Performance Settings
NODE_ENV=production
REQUEST_TIMEOUT=30000
MAX_FILE_SIZE=25000000

# Monitoring
LOG_LEVEL=info
HEALTH_CHECK_INTERVAL=30000

# Database Connection Pool (already configured in code)
# MAX_POOL_SIZE=15
# MIN_POOL_SIZE=2
# POOL_IDLE_TIMEOUT=30000
EOF

echo "✅ Created .env.emergency with required variables"
echo "   Please copy these to your main .env file"

# 4. Create Basic Performance Monitoring
echo ""
echo "📈 4. CREATING PERFORMANCE MONITORING..."
echo "---------------------------------------"

# Create a simple performance monitoring middleware
cat > server/middleware/performance-monitor.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';

interface PerformanceMetrics {
  averageResponseTime: number;
  requestCount: number;
  errorCount: number;
  slowRequestCount: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    averageResponseTime: 0,
    requestCount: 0,
    errorCount: 0,
    slowRequestCount: 0
  };

  private responseTimes: number[] = [];

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.recordMetric(duration, res.statusCode);
        
        // Log slow requests (>1000ms)
        if (duration > 1000) {
          console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.path} - ${duration}ms`);
        }
        
        // Log all API requests with timing
        if (req.path.startsWith('/api/')) {
          console.log(`📊 API ${req.method} ${req.path}: ${duration}ms (${res.statusCode})`);
        }
      });
      
      next();
    };
  }

  private recordMetric(duration: number, statusCode: number) {
    this.metrics.requestCount++;
    
    if (statusCode >= 400) {
      this.metrics.errorCount++;
    }
    
    if (duration > 1000) {
      this.metrics.slowRequestCount++;
    }
    
    // Keep last 100 response times for average calculation
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
    
    // Calculate rolling average
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  logSummary() {
    console.log('📊 PERFORMANCE SUMMARY:');
    console.log(`   Average Response Time: ${this.metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`   Total Requests: ${this.metrics.requestCount}`);
    console.log(`   Error Count: ${this.metrics.errorCount}`);
    console.log(`   Slow Requests (>1s): ${this.metrics.slowRequestCount}`);
    console.log(`   Error Rate: ${((this.metrics.errorCount / this.metrics.requestCount) * 100).toFixed(2)}%`);
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Log summary every 5 minutes
setInterval(() => {
  performanceMonitor.logSummary();
}, 5 * 60 * 1000);
EOF

echo "✅ Created performance monitoring middleware"

# 5. Create Health Check Endpoint
echo ""
echo "🏥 5. CREATING HEALTH CHECK..."
echo "-----------------------------"

cat > server/health-check.ts << 'EOF'
import { Request, Response } from 'express';
import { pool } from './db';
import { performanceMonitor } from './middleware/performance-monitor';

export async function healthCheck(req: Request, res: Response) {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'unknown',
    performance: performanceMonitor.getMetrics(),
    version: process.env.npm_package_version || '1.0.0'
  };

  try {
    // Test database connection
    const client = await pool.connect();
    const dbStart = Date.now();
    await client.query('SELECT 1');
    const dbDuration = Date.now() - dbStart;
    client.release();
    
    health.database = dbDuration < 100 ? 'healthy' : 'slow';
    
    // Check if system is overloaded
    const metrics = performanceMonitor.getMetrics();
    if (metrics.averageResponseTime > 2000 || metrics.errorCount > 10) {
      health.status = 'degraded';
    }
    
  } catch (error) {
    health.status = 'unhealthy';
    health.database = 'error';
  }

  const responseTime = Date.now() - startTime;
  res.status(health.status === 'healthy' ? 200 : 503).json({
    ...health,
    responseTime: `${responseTime}ms`
  });
}
EOF

echo "✅ Created health check endpoint"

# 6. Instructions for next steps
echo ""
echo "🎯 EMERGENCY FIXES COMPLETED!"
echo "============================="
echo ""
echo "NEXT STEPS (DO IMMEDIATELY):"
echo ""
echo "1. 📝 Update your .env file:"
echo "   cat .env.emergency >> .env"
echo ""
echo "2. 🔄 Add performance monitoring to your main server file:"
echo "   Add this to server/index.ts or server/routes.ts:"
echo "   import { performanceMonitor } from './middleware/performance-monitor';"
echo "   app.use(performanceMonitor.middleware());"
echo ""
echo "3. 🏥 Add health check endpoint:"
echo "   Add this to server/routes.ts:"
echo "   import { healthCheck } from './health-check';"
echo "   app.get('/health', healthCheck);"
echo ""
echo "4. 🗄️  Set up Redis (choose one):"
echo "   Local: brew install redis && redis-server"
echo "   Cloud: Sign up for Redis Cloud or AWS ElastiCache"
echo ""
echo "5. 📊 Verify indexes were deployed:"
echo "   psql \$DATABASE_URL -c \"SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname = 'public';\""
echo ""
echo "6. 🔄 Restart your server:"
echo "   npm run dev (development)"
echo "   npm start (production)"
echo ""
echo "7. ✅ Test health endpoint:"
echo "   curl http://localhost:3000/health"
echo ""
echo "⚠️  MONITOR THESE METRICS:"
echo "   - Response times should be <1000ms"
echo "   - Database connections should stay <10"
echo "   - Error rate should be <1%"
echo ""
echo "🚨 IF YOU SEE ISSUES:"
echo "   - Response times >2000ms = Database problems"
echo "   - Memory growing continuously = Memory leak"
echo "   - Many 500 errors = Check error logs"
echo ""
echo "📞 Need help? Check the full audit report: SYSTEM_SCALABILITY_AUDIT_REPORT.md"
EOF 