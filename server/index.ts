import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from 'http';
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
import { WebRTCSignalingService } from './services/video/WebRTCSignalingService.js';

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

// Add simple health check endpoint for Railway
app.get('/health', (req: Request, res: Response) => {
  // Simple, fast health check for Railway deployment
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Add detailed health check endpoint  
app.get('/api/health', asyncHandler(async (req: Request, res: Response) => {
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

  // Create HTTP server for Socket.IO
  const httpServer = createServer(app);
  
  // Fix EventEmitter memory leak by setting appropriate max listeners
  httpServer.setMaxListeners(20);

  // Initialize WebRTC signaling service
  const webRTCService = new WebRTCSignalingService(httpServer);
  console.log('✅ WebRTC signaling service initialized');

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, httpServer);
  } else {
    // In production, check if we should serve static files or run API-only
    const shouldServeStatic = process.env.SERVE_STATIC_FILES !== 'false';
    
    if (shouldServeStatic) {
      // Single-port production: serve static files and API
      console.log('🎯 Production mode: Serving static files + API from port 3000');
      serveStatic(app);
    } else {
      // Two-port production: API-only server
      console.log('🎯 Production mode: API-only server on port 3000');
      console.log('📡 Frontend should be served separately on port 3002');
      
      // Add CORS for production frontend
      app.use((req, res, next) => {
        const allowedOrigins = [
          'http://localhost:3002',
          'http://127.0.0.1:3002',
          'http://0.0.0.0:3002',
          process.env.CLIENT_URL
        ].filter(Boolean);
        
        const origin = req.headers.origin;
        if (origin && allowedOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        } else if (!origin) {
          // Allow requests from same host (like from Vite preview proxy)
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
        
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID, x-requested-with');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Expose-Headers', 'X-Request-ID, X-Response-Time');
        
        if (req.method === 'OPTIONS') {
          res.status(200).end();
          return;
        }
        
        next();
      });
    }
  }

  // 404 handler for unmatched routes (must be after Vite middleware)
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);

  // ALWAYS serve the app on port 3000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 3000;
  
  // Add error handling and retry logic for port conflicts
  const startServer = (retryCount = 0) => {
    const maxRetries = 2;
    
    httpServer.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      log(`serving on port ${port}`);
      console.log('✅ Enhanced error handling active');
      console.log('✅ Circuit breakers monitoring services');
      console.log('✅ SQL injection protection enabled');
      console.log('✅ Rate limiting configured');
      console.log('✅ WebRTC video conferencing ready');
    });

    httpServer.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE' && retryCount < maxRetries) {
        console.log(`Port ${port} is busy, retrying in 3 seconds... (attempt ${retryCount + 1}/${maxRetries})`);
        setTimeout(() => {
          httpServer.close();
          startServer(retryCount + 1);
        }, 3000);
      } else {
        console.error('Server startup error:', error);
        if (process.env.NODE_ENV === 'production') {
          console.log('⚠️ Production server failed to start. Please check port availability and try again.');
        }
        process.exit(1);
      }
    });
  };

  // Add graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  // Handle uncaught exceptions more gracefully in production
  process.on('uncaughtException', (error) => {
    console.error('🚨 UNCAUGHT EXCEPTION:', error);
    // In production, try to gracefully shutdown instead of immediate exit
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Attempting graceful shutdown...');
      httpServer.close(() => {
        console.log('Server closed after uncaught exception');
        process.exit(1);
      });
      // Force exit after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        console.log('⚠️ Forced exit after graceful shutdown timeout');
        process.exit(1);
      }, 10000);
    } else {
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION at:', promise, 'reason:', reason);
    // In production, don't exit on unhandled rejection, just log it
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Continuing execution despite unhandled rejection...');
    } else {
      process.exit(1);
    }
  });

  startServer();
})();
