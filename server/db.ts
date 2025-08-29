import dotenv from 'dotenv';
dotenv.config();

// Set NODE_TLS_REJECT_UNAUTHORIZED early for Railway PostgreSQL compatibility
if (process.env.DATABASE_URL?.includes('rlwy.net') || process.env.DATABASE_URL?.includes('railway')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('🔧 SSL certificate validation disabled for Railway database');
}

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Database configuration - Updated for local PostgreSQL
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/usa_notray_local';

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to configure your database?");
}

console.log('🔗 Database connection details:', {
  url: DATABASE_URL ? 'configured' : 'missing',
  isLocal: DATABASE_URL.includes('localhost')
});

// SSL configuration for different database environments
const getSSLConfig = () => {
  // For local development with local postgres
  if (DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')) {
    return false; // No SSL for local postgres
  }
  
  // For Railway - they use self-signed certificates, so we need to allow them
  if (DATABASE_URL.includes('railway.app') || DATABASE_URL.includes('rlwy.net')) {
    console.log('🚂 Configuring SSL for Railway PostgreSQL (allowing self-signed certificates)');
    return {
      rejectUnauthorized: false, // Railway uses self-signed certificates
      checkServerIdentity: () => undefined // Skip hostname verification for Railway
    };
  }
  
  // Check for NODE_TLS_REJECT_UNAUTHORIZED environment variable (Railway deployment fix)
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    console.log('⚠️ SSL certificate validation disabled via NODE_TLS_REJECT_UNAUTHORIZED');
    return {
      rejectUnauthorized: false,
      checkServerIdentity: () => undefined
    };
  }
  
  // For cloud providers in production
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

// Pool configuration optimized for Railway PostgreSQL performance
const getPoolConfig = () => {
  const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
  const isRailway = DATABASE_URL.includes('railway.app') || DATABASE_URL.includes('rlwy.net');
  const sslConfig = getSSLConfig();
  
  console.log('🔧 Database Pool Configuration:', {
    isLocal,
    isRailway,
    ssl: sslConfig,
    nodeEnv: process.env.NODE_ENV,
    tlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED
  });
  
  // Railway-optimized configuration
  if (isRailway) {
    return {
      connectionString: DATABASE_URL,
      ssl: sslConfig,
      // Optimized for Railway's connection limits and performance
      max: 15,                                  // Railway has connection limits
      min: 2,                                   // Keep fewer idle connections
      idleTimeoutMillis: 120000,               // 2 minutes - shorter for Railway
      connectionTimeoutMillis: 10000,          // 10 seconds - faster timeout
      statement_timeout: 30000,                // 30 second query timeout
      query_timeout: 30000,                    // 30 second query timeout
      keepAlive: true,                         // Keep connections alive
      keepAliveInitialDelayMillis: 10000,      // 10 seconds before first keepalive
      application_name: 'usa_notary_api_railway'
    };
  }
  
  // Local development configuration
  if (isLocal) {
    return {
      connectionString: DATABASE_URL,
      ssl: sslConfig,
      max: 20,                                 // More connections for local dev
      min: 5,
      idleTimeoutMillis: 300000,              // 5 minutes
      connectionTimeoutMillis: 5000,          // 5 seconds for local
      application_name: 'usa_notary_api_local'
    };
  }
  
  // Production configuration for other providers
  return {
    connectionString: DATABASE_URL,
    ssl: sslConfig,
    max: 100,
    min: 20,
    idleTimeoutMillis: 1800000,              // 30 minutes
    connectionTimeoutMillis: 30000,
    application_name: 'usa_notary_api_production'
  };
};

export const pool = new Pool(getPoolConfig());

// Database connection monitoring
let initialConnectionLogged = false;

pool.on('connect', async (client) => {
  try {
    // Ensure each connection uses the correct schema
    await client.query('SET search_path TO public');
    
    if (!initialConnectionLogged) {
      console.log(`✅ Database connected successfully. Pool size: ${pool.totalCount}`);
      initialConnectionLogged = true;
    }
  } catch (error) {
    console.error('❌ Failed to initialize database connection:', error);
  }
});

pool.on('error', (err, client) => {
  console.error('❌ Database pool error:', err);
});

// Log pool stats occasionally for debugging (development only)
if (process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    console.log(`📊 DB Pool Stats: Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
  }, 5 * 60 * 1000);
}

export const db = drizzle({ client: pool, schema });
