import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

export interface CircuitBreakerConfig {
  failureThreshold: number;       // Number of failures before opening circuit
  resetTimeout: number;           // Time to wait before trying again (ms)
  monitoringWindow: number;       // Time window for failure counting (ms)
  responseTimeThreshold?: number; // Max response time before considering failure
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;              // Base delay between retries (ms)
  maxDelay: number;               // Maximum delay between retries (ms)
  backoffFactor: number;          // Exponential backoff multiplier
  retryableErrors: string[];      // Error types that should trigger retry
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back
}

interface FailureRecord {
  timestamp: number;
  error: string;
  duration: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failures: FailureRecord[] = [];
  private lastFailTime: number = 0;
  private successCount: number = 0;
  private testRequestActive: boolean = false;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  private cleanOldFailures(): void {
    const cutoff = Date.now() - this.config.monitoringWindow;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  private getFailureRate(): number {
    this.cleanOldFailures();
    return this.failures.length;
  }

  private shouldTripCircuit(): boolean {
    return this.getFailureRate() >= this.config.failureThreshold;
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailTime >= this.config.resetTimeout;
  }

  public async execute<T>(
    operation: () => Promise<T>,
    operationName: string = 'unknown'
  ): Promise<T> {
    // Check circuit state
    switch (this.state) {
      case CircuitBreakerState.OPEN:
        if (this.shouldAttemptReset()) {
          this.state = CircuitBreakerState.HALF_OPEN;
          console.log(`🔄 Circuit breaker ${this.name} transitioning to HALF_OPEN`);
        } else {
          throw new Error(`Circuit breaker ${this.name} is OPEN - failing fast`);
        }
        break;

      case CircuitBreakerState.HALF_OPEN:
        if (this.testRequestActive) {
          throw new Error(`Circuit breaker ${this.name} is HALF_OPEN - test request in progress`);
        }
        this.testRequestActive = true;
        break;
    }

    const startTime = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      // Check if response was too slow
      if (this.config.responseTimeThreshold && duration > this.config.responseTimeThreshold) {
        throw new Error(`Operation ${operationName} exceeded timeout threshold: ${duration}ms`);
      }

      // Success - update circuit state
      this.onSuccess(duration, operationName);
      return result;

    } catch (error) {
      const duration = performance.now() - startTime;
      this.onFailure(error as Error, duration, operationName);
      throw error;
    } finally {
      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.testRequestActive = false;
      }
    }
  }

  private onSuccess(duration: number, operationName: string): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      // After successful test, close the circuit
      this.state = CircuitBreakerState.CLOSED;
      this.failures = [];
      console.log(`✅ Circuit breaker ${this.name} CLOSED - service recovered`);
    }

    // Log successful operation
    console.log(`✅ ${this.name}:${operationName} succeeded in ${Math.round(duration)}ms`);
  }

  private onFailure(error: Error, duration: number, operationName: string): void {
    const failure: FailureRecord = {
      timestamp: Date.now(),
      error: error.message,
      duration
    };

    this.failures.push(failure);
    this.lastFailTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Test failed, go back to open
      this.state = CircuitBreakerState.OPEN;
      console.log(`❌ Circuit breaker ${this.name} back to OPEN - test failed`);
    } else if (this.shouldTripCircuit()) {
      // Trip the circuit
      this.state = CircuitBreakerState.OPEN;
      console.log(`🚨 Circuit breaker ${this.name} OPENED - failure threshold reached (${this.failures.length}/${this.config.failureThreshold})`);
    }

    console.error(`❌ ${this.name}:${operationName} failed in ${Math.round(duration)}ms:`, error.message);
  }

  public getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.getFailureRate(),
      failureThreshold: this.config.failureThreshold,
      lastFailTime: this.lastFailTime,
      successCount: this.successCount
    };
  }
}

export class RetryHandler {
  constructor(private config: RetryConfig) {}

  private shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.config.maxRetries) {
      return false;
    }

    // Check if error is retryable
    const isRetryableError = this.config.retryableErrors.some(errorType => 
      error.message.toLowerCase().includes(errorType.toLowerCase()) ||
      error.name.toLowerCase().includes(errorType.toLowerCase())
    );

    return isRetryableError;
  }

  private calculateDelay(attempt: number): number {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt);
    return Math.min(delay, this.config.maxDelay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async execute<T>(
    operation: () => Promise<T>,
    operationName: string = 'unknown'
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delayMs = this.calculateDelay(attempt - 1);
          console.log(`🔄 Retry ${attempt}/${this.config.maxRetries} for ${operationName} in ${delayMs}ms`);
          await this.delay(delayMs);
        }

        return await operation();

      } catch (error) {
        lastError = error as Error;
        
        if (!this.shouldRetry(lastError, attempt)) {
          console.error(`❌ ${operationName} failed after ${attempt} attempts:`, lastError.message);
          throw lastError;
        }

        console.warn(`⚠️ ${operationName} attempt ${attempt + 1} failed:`, lastError.message);
      }
    }

    throw lastError!;
  }
}

// Pre-configured circuit breakers for common services
export const circuitBreakers = {
  database: new CircuitBreaker('DATABASE', {
    failureThreshold: 5,
    resetTimeout: 30000,        // 30 seconds
    monitoringWindow: 60000,    // 1 minute
    responseTimeThreshold: 5000 // 5 seconds
  }),

  redis: new CircuitBreaker('REDIS', {
    failureThreshold: 3,
    resetTimeout: 15000,        // 15 seconds
    monitoringWindow: 30000,    // 30 seconds
    responseTimeThreshold: 1000 // 1 second
  }),

  evs: new CircuitBreaker('EVS_API', {
    failureThreshold: 3,
    resetTimeout: 60000,        // 1 minute
    monitoringWindow: 300000,   // 5 minutes
    responseTimeThreshold: 10000 // 10 seconds
  }),

  email: new CircuitBreaker('EMAIL_SERVICE', {
    failureThreshold: 5,
    resetTimeout: 60000,        // 1 minute
    monitoringWindow: 300000,   // 5 minutes
    responseTimeThreshold: 5000 // 5 seconds
  }),

  vultr: new CircuitBreaker('VULTR_STORAGE', {
    failureThreshold: 3,
    resetTimeout: 30000,        // 30 seconds
    monitoringWindow: 120000,   // 2 minutes
    responseTimeThreshold: 15000 // 15 seconds
  }),

  // Also provide uppercase property names for consistency
  DATABASE: new CircuitBreaker('DATABASE', {
    failureThreshold: 5,
    resetTimeout: 30000,        // 30 seconds
    monitoringWindow: 60000,    // 1 minute
    responseTimeThreshold: 5000 // 5 seconds
  }),

  REDIS: new CircuitBreaker('REDIS', {
    failureThreshold: 3,
    resetTimeout: 15000,        // 15 seconds
    monitoringWindow: 30000,    // 30 seconds
    responseTimeThreshold: 1000 // 1 second
  }),

  EVS_API: new CircuitBreaker('EVS_API', {
    failureThreshold: 3,
    resetTimeout: 60000,        // 1 minute
    monitoringWindow: 300000,   // 5 minutes
    responseTimeThreshold: 10000 // 10 seconds
  }),

  EMAIL_SERVICE: new CircuitBreaker('EMAIL_SERVICE', {
    failureThreshold: 5,
    resetTimeout: 60000,        // 1 minute
    monitoringWindow: 300000,   // 5 minutes
    responseTimeThreshold: 5000 // 5 seconds
  }),

  VULTR_STORAGE: new CircuitBreaker('VULTR_STORAGE', {
    failureThreshold: 3,
    resetTimeout: 30000,        // 30 seconds
    monitoringWindow: 120000,   // 2 minutes
    responseTimeThreshold: 15000 // 15 seconds
  })
};

// Pre-configured retry handlers
export const retryHandlers = {
  database: new RetryHandler({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    backoffFactor: 2,
    retryableErrors: ['connection', 'timeout', 'network', 'temporary']
  }),

  redis: new RetryHandler({
    maxRetries: 2,
    baseDelay: 500,
    maxDelay: 2000,
    backoffFactor: 2,
    retryableErrors: ['connection', 'timeout', 'redis']
  }),

  externalApi: new RetryHandler({
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 10000,
    backoffFactor: 2,
    retryableErrors: ['timeout', 'network', '502', '503', '504', 'econnreset', 'enotfound']
  })
};

/**
 * Middleware to wrap database operations with circuit breaker and retry
 */
export function withDatabaseProtection<T>(
  operation: () => Promise<T>,
  operationName: string = 'db_operation'
): Promise<T> {
  return circuitBreakers.database.execute(
    () => retryHandlers.database.execute(operation, operationName),
    operationName
  );
}

/**
 * Middleware to wrap Redis operations with circuit breaker and retry
 */
export function withRedisProtection<T>(
  operation: () => Promise<T>,
  operationName: string = 'redis_operation'
): Promise<T> {
  return circuitBreakers.redis.execute(
    () => retryHandlers.redis.execute(operation, operationName),
    operationName
  );
}

/**
 * Middleware to wrap external API calls with circuit breaker and retry
 */
export function withExternalApiProtection<T>(
  operation: () => Promise<T>,
  serviceName: string,
  operationName: string = 'api_call'
): Promise<T> {
  const circuitBreaker = circuitBreakers[serviceName as keyof typeof circuitBreakers] || circuitBreakers.evs;
  
  return circuitBreaker.execute(
    () => retryHandlers.externalApi.execute(operation, operationName),
    operationName
  );
}

/**
 * Health check for all circuit breakers
 */
export function getCircuitBreakerStatus() {
  return Object.keys(circuitBreakers).map(name => 
    circuitBreakers[name as keyof typeof circuitBreakers].getStatus()
  );
}

/**
 * Express middleware for graceful degradation
 */
export function gracefulDegradation(
  fallbackHandler?: (req: Request, res: Response) => void
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Check if we're in degraded mode
      const dbStatus = circuitBreakers.database.getStatus();
      const redisStatus = circuitBreakers.redis.getStatus();
      
      if (dbStatus.state === CircuitBreakerState.OPEN) {
        if (fallbackHandler) {
          return fallbackHandler(req, res);
        } else {
          return originalJson.call(this, {
            success: false,
            error: {
              message: 'Service temporarily unavailable',
              code: 'SERVICE_DEGRADED',
              statusCode: 503
            },
            degradedMode: true
          });
        }
      }

      // Add service status headers
      res.setHeader('X-Service-Status', dbStatus.state);
      res.setHeader('X-Cache-Status', redisStatus.state);
      
      return originalJson.call(this, data);
    };
    
    next();
  };
} 