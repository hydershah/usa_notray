import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { performanceMonitor } from './middleware/performance-monitor';
import { healthCheck } from './health-check';
import { redisCache } from './services/redis-cache';
import { 
  errorHandler, 
  notFoundHandler, 
  requestIdMiddleware, 
  performanceTracker, 
  asyncHandler 
} from './middleware/error-handler';
import { 
  preventSqlInjection, 
  rateLimiters 
} from './middleware/validation';
import { gracefulDegradation } from './middleware/circuit-breaker';

const app = express();

// Security and request processing middleware
app.use(requestIdMiddleware);
app.use(performanceTracker);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Security middleware
app.use(preventSqlInjection);
app.use(rateLimiters.general);

// Graceful degradation for service failures
app.use(gracefulDegradation());

// Add performance monitoring middleware
app.use(performanceMonitor.middleware());

// Add enhanced health check endpoint
app.get('/health', asyncHandler(async (req: Request, res: Response) => {
  await healthCheck(req, res);
}));

// Initialize Redis cache on startup
console.log('🔄 Initializing Redis cache...');
redisCache.healthCheck()
  .then(result => {
    if (result.healthy) {
      console.log(`✅ Redis cache initialized successfully (${result.latency?.toFixed(2)}ms latency)`);
    } else {
      console.warn('⚠️ Redis cache not available:', result.error);
    }
  })
  .catch(error => {
    console.error('❌ Redis cache initialization failed:', error);
  });

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // 404 handler for unmatched routes
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 3000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 3000;
  
  // Add error handling and retry logic for port conflicts
  const startServer = (retryCount = 0) => {
    const maxRetries = 3;
    
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`serving on port ${port}`);
      console.log('✅ Enhanced error handling active');
      console.log('✅ Circuit breakers monitoring services');
      console.log('✅ SQL injection protection enabled');
      console.log('✅ Rate limiting configured');
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE' && retryCount < maxRetries) {
        console.log(`Port ${port} is busy, retrying in 2 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          server.close();
          startServer(retryCount + 1);
        }, 2000);
      } else {
        console.error('Server startup error:', error);
        process.exit(1);
      }
    });
  };

  // Add graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('🚨 UNCAUGHT EXCEPTION:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
    process.exit(1);
  });

  startServer();
})();
