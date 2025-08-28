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

// Pool configuration optimized for local PostgreSQL development
const getPoolConfig = () => {
  const isLocal = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
  const sslConfig = getSSLConfig();
  
  console.log('🔧 Database Pool Configuration:', {
    isLocal,
    ssl: sslConfig,
    nodeEnv: process.env.NODE_ENV,
    tlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED
  });
  
  return {
    connectionString: DATABASE_URL,
    ssl: sslConfig,
    // Connection pool settings optimized for local development
    max: isLocal ? 20 : 100,                    // Fewer connections for local dev
    min: isLocal ? 5 : 20,                      // Minimum pool size
    idleTimeoutMillis: isLocal ? 300000 : 1800000, // 5 minutes local, 30 minutes production
    connectionTimeoutMillis: 30000,             // 30 second connection timeout
    // Application name for monitoring
    application_name: isLocal ? 'usa_notary_api_local' : 'usa_notary_api_production'
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
