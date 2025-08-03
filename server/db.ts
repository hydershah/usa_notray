import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createClient } from '@supabase/supabase-js';
import * as schema from "@shared/schema";

// 🔒 SECURITY: Use environment variables with Supabase fallbacks for development
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ueoqbwsigpowzbdlqezz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlb3Fid3NpZ3Bvd3piZGxxZXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzOTIxMjAsImV4cCI6MjA2Nzk2ODEyMH0.dYKe8YAR3hHHGhJnQfDTNJJVtKD2rABNGPZQ3cqwYME';

console.log('🔗 Database connection details:', {
  url: DATABASE_URL ? 'configured' : 'missing',
  supabaseUrl: SUPABASE_URL ? 'configured' : 'missing',
  supabaseKey: SUPABASE_ANON_KEY ? 'configured' : 'missing'
});

// Supabase client for frontend operations
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// 🔒 SECURITY: Improved SSL configuration for Supabase
const getSSLConfig = () => {
  // For local development with local postgres
  if (process.env.NODE_ENV === 'development' && !DATABASE_URL.includes('supabase.co') && !DATABASE_URL.includes('supabase.com')) {
    return false; // No SSL for local postgres
  }
  
  // For Supabase (development and production) - covers both supabase.co and pooler.supabase.com
  if (DATABASE_URL.includes('supabase.co') || DATABASE_URL.includes('supabase.com')) {
    return {
      rejectUnauthorized: false, // Supabase uses pooler which may have cert chain issues
    };
  }
  
  // For other cloud providers in production
  if (DATABASE_URL.includes('amazonaws.com') || DATABASE_URL.includes('azure.com')) {
    return {
      rejectUnauthorized: true, // ✅ SECURE: Validate SSL certificates
      ca: process.env.DB_SSL_CA, // Optional: Custom CA certificate
    };
  }
  
  // For other production environments
  return {
    rejectUnauthorized: true
  };
};

// Enhanced pool configuration for better performance and stability
const getPoolConfig = () => {
  const baseConfig = {
    connectionString: DATABASE_URL,
    ssl: getSSLConfig(),
    // Connection pool settings for optimal performance
    max: 100,                   // Maximum pool size for enterprise
    min: 20,                    // Minimum pool size for faster response
    idleTimeoutMillis: 1800000, // Keep connections alive for 30 minutes
    connectionTimeoutMillis: 60000, // Connection timeout
    // Query timeouts for better performance
    query_timeout: 300000,      // 5 minute query timeout
    statement_timeout: 300000,  // 5 minute statement timeout
    // Keep alive settings for Supabase
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000, // 10s aggressive keep-alive
    // Application name for monitoring
    application_name: 'usa_notary_api'
  };

  // 💰 ENTERPRISE TIER CONFIGURATION - $3000/month BEAST MODE! 💰
  // 🚀 UNLIMITED POWER: No limits, maximum aggression for Enterprise customer
  // 💪 TARGET: Handle 10,000+ concurrent users with zero bottlenecks
  // 🔥 SUPABASE ENTERPRISE: Custom limits, we're going ALL OUT!
  if (DATABASE_URL.includes('supabase.co') || DATABASE_URL.includes('supabase.com')) {
    return {
      ...baseConfig,
      max: 1000,                // 💥 ENTERPRISE BEAST: 1000 concurrent connections (MAXIMUM!)
      min: 100,                 // 💥 ALWAYS READY: 100 connections always hot and ready
      idleTimeoutMillis: 3600000, // 💥 60 MINUTES: Keep connections alive for maximum reuse
      connectionTimeoutMillis: 120000, // 💥 2 MINUTES: Very patient connection establishment
      query_timeout: 600000,   // 💥 10 MINUTES: Handle any query, no matter how complex
      statement_timeout: 600000, // 💥 10 MINUTES: Maximum patience for statements
      
      // 💰 ENTERPRISE PERFORMANCE FEATURES
      keepAlive: true,
      keepAliveInitialDelayMillis: 5000, // 5s ultra-aggressive keep-alive
      
      // 🚀 ULTRA-AGGRESSIVE CONNECTION MANAGEMENT
      acquireTimeoutMillis: 120000,  // 2 minutes to acquire (maximum patience for high load)
      createTimeoutMillis: 60000,   // 1 minute to create (fast creation)
      destroyTimeoutMillis: 30000,  // 30s to destroy (quick cleanup)
      reapIntervalMillis: 10000,    // Check every 10s (ultra-aggressive reaping)
      createRetryIntervalMillis: 100, // Retry every 100ms (super fast)
      
      // 💪 ENTERPRISE-GRADE TCP OPTIMIZATIONS
      application_name: 'usa_notary_enterprise_beast_3k_monthly',
      tcp_keepalives_idle: 60,      // TCP keep-alive (1 minute - ultra aggressive)
      tcp_keepalives_interval: 10,  // TCP ping every 10s (ultra aggressive)
      tcp_keepalives_count: 15,     // 15 failed pings before disconnect (maximum resilience)
      
      // 🔥 MAXIMUM PERFORMANCE TUNING
      ssl: {
        rejectUnauthorized: false,
        keepAlive: true,
        keepAliveInitialDelay: 5000  // 5s ultra-aggressive
      },
      
      // 💥 CONNECTION POOL BEAST MODE
      allowExitOnIdle: false,        // Never let pool idle (always ready)
      log: (message, level) => {    // Enterprise monitoring
        if (level === 'error') {
          console.error(`🚨 ENTERPRISE DB ERROR: ${message}`);
        } else if (level === 'warn') {
          console.warn(`⚠️ ENTERPRISE DB WARNING: ${message}`);
        }
      },
      
      // 🎯 ENTERPRISE SCALING PARAMETERS
      Promise: Promise,             // Native Promise for performance
      parseInputDatesAsUTC: true,   // UTC consistency
      max_prepared_statements: 200, // Maximum prepared statement cache
      statement_cache_size: 2000,   // Maximum statement cache
    };
  }

  return baseConfig;
};

export const pool = new Pool(getPoolConfig());

// 💰 ENTERPRISE MONITORING for $3000/month Supabase investment
pool.on('connect', (client) => {
  const activeCount = pool.totalCount - pool.idleCount;
  console.log(`🚀 ENTERPRISE DB: New connection established | Active: ${activeCount}/${pool.options.max} | Total: ${pool.totalCount} | Idle: ${pool.idleCount}`);
  
  if (activeCount > pool.options.max * 0.8) {
    console.warn(`⚠️ ENTERPRISE ALERT: Pool usage at ${Math.round((activeCount/pool.options.max)*100)}% - Consider scaling up!`);
  }
});

pool.on('acquire', (client) => {
  const activeCount = pool.totalCount - pool.idleCount;
  if (activeCount > pool.options.max * 0.9) {
    console.warn(`🔥 ENTERPRISE HIGH LOAD: ${activeCount}/${pool.options.max} connections active (${Math.round((activeCount/pool.options.max)*100)}%)`);
  }
});

pool.on('error', (err, client) => {
  console.error(`🚨 ENTERPRISE DB POOL ERROR (Investment at risk!):`, err);
  console.error(`📊 Pool Stats: Total=${pool.totalCount}, Idle=${pool.idleCount}, Waiting=${pool.waitingCount}`);
});

pool.on('remove', (client) => {
  console.log(`♻️ ENTERPRISE DB: Connection removed | Remaining: ${pool.totalCount}`);
});

// 💪 ENTERPRISE HEALTH CHECK - Monitor your $3000/month investment
setInterval(() => {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    active: pool.totalCount - pool.idleCount,
    waiting: pool.waitingCount,
    utilization: Math.round(((pool.totalCount - pool.idleCount) / pool.options.max) * 100)
  };
  
  if (stats.utilization > 70) {
    console.log(`💰 ENTERPRISE METRICS: ${stats.utilization}% utilization | Active: ${stats.active}/${pool.options.max} | Worth every penny of $3000/month!`);
  }
}, 30000); // Report every 30 seconds

// Reduced logging - only log important events, not normal connection activity
let initialConnectionLogged = false;

pool.on('connect', async (client) => {
  try {
    // Ensure each connection uses the correct schema
    await client.query('SET search_path TO public');
    
    if (!initialConnectionLogged) {
      console.log(`✅ Database connected. Pool size: ${pool.totalCount}`);
      initialConnectionLogged = true;
    }
  } catch (error) {
    console.error('❌ Failed to initialize database connection:', error);
  }
});

// Remove the verbose 'acquire' logging that was causing noise
// pool.on('acquire', ...) - REMOVED to reduce log spam

pool.on('error', (err, client) => {
  console.error('❌ Database pool error:', err);
});

// Log pool stats occasionally for debugging (every 5 minutes)
if (process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    console.log(`📊 DB Pool Stats: Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
  }, 5 * 60 * 1000);
}

export const db = drizzle({ client: pool, schema });
