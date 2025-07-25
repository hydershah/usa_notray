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
    max: 10,                    // Maximum pool size (was default 10)
    min: 2,                     // Minimum pool size for faster response
    idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Connection timeout
    // Query timeouts for better performance
    query_timeout: 25000,       // 25 second query timeout
    statement_timeout: 25000,   // 25 second statement timeout
    // Keep alive settings for Supabase
    keepAlive: true,
    keepAliveInitialDelayMillis: 5000,
    // Application name for monitoring
    application_name: 
    'usa_notary_api'
  };

  // Optimize for Supabase specifically
  if (DATABASE_URL.includes('supabase.co') || DATABASE_URL.includes('supabase.com')) {
    return {
      ...baseConfig,
      max: 10,                  // Increased max for better concurrency
      min: 3,                   // Increased min for faster response
      idleTimeoutMillis: 20000, // Shorter idle timeout for Supabase
      connectionTimeoutMillis: 5000, // Faster connection timeout
      query_timeout: 15000,     // Reduced query timeout for web responses
      statement_timeout: 15000, // Reduced statement timeout
    };
  }

  return baseConfig;
};

export const pool = new Pool(getPoolConfig());

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
