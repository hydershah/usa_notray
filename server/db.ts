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

// PostgreSQL connection pool with optimized production configuration
export const pool = new Pool({ 
  connectionString: DATABASE_URL,
  // Production-optimized connection pool settings
  max: process.env.NODE_ENV === 'production' ? 15 : 10, // Reduced max connections for production
  min: process.env.NODE_ENV === 'production' ? 2 : 1,   // Conservative minimum for production
  idleTimeoutMillis: 30000, // 30 seconds - shorter for production efficiency
  connectionTimeoutMillis: 15000, // 15 seconds - reasonable timeout
  // Enable connection reuse and health checks
  allowExitOnIdle: true, // Allow process to exit when idle in production
  keepAlive: true,
  keepAliveInitialDelayMillis: 5000, // 5 seconds - standard delay
  // Reasonable timeouts for production
  statement_timeout: 30000, // 30 seconds - balanced timeout
  query_timeout: 30000, // 30 seconds - balanced timeout
  // 🔒 SECURITY: Proper SSL configuration
  ssl: getSSLConfig(),
  // 🔧 FIX: Ensure all pool connections use correct schema
  options: '-c search_path=public'
});

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
