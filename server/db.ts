import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createClient } from '@supabase/supabase-js';
import * as schema from "@shared/schema";

// Hardcoded Supabase credentials (use environment variables in production)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres.ueoqbwsigpowzbdlqezz:Xymax@123@aws-0-us-east-2.pooler.supabase.com:6543/postgres';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ueoqbwsigpowzbdlqezz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlb3Fid3NpZ3Bvd3piZGxxZXp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUxNDkxMDYsImV4cCI6MjA1MDcyNTEwNn0.C3BslgmPxUVJ7getJAkPCHPlZTMAdaGUENaUahlbKQk';

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_ANON_KEY must be set for Supabase connection",
  );
}

// Supabase client for frontend operations
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// PostgreSQL connection pool with optimized Supabase configuration
export const pool = new Pool({ 
  connectionString: DATABASE_URL,
  // Optimized connection pool settings for Supabase
  max: 25, // Increased from 15 to handle more concurrent requests
  min: 5,  // Increased from 2 to maintain warm connections
  idleTimeoutMillis: 60000, // Increased from 30000 (1 minute) - keep connections alive longer
  connectionTimeoutMillis: 30000, // Increased from 15000 (30 seconds) - allow more time for Supabase connections
  acquireTimeoutMillis: 20000, // Increased from 10000 (20 seconds) - allow more time to acquire connections
  // Enable connection reuse and health checks
  allowExitOnIdle: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Increased from 5000 - better for network latency
  // Increased timeouts for better Supabase compatibility
  statement_timeout: 60000, // Increased from 30000 (1 minute) - allow complex queries
  query_timeout: 60000, // Increased from 30000 (1 minute) - allow complex queries
  // Add SSL configuration for Supabase
  ssl: {
    rejectUnauthorized: false
  }
});

// Pool event handlers for monitoring and debugging
pool.on('connect', (client) => {
  console.log(`Database connection established. Total connections: ${pool.totalCount}`);
});

pool.on('acquire', (client) => {
  console.log(`Connection acquired from pool. Active: ${pool.totalCount - pool.idleCount}`);
});

pool.on('error', (err, client) => {
  console.error('Database pool error:', err);
});

export const db = drizzle({ client: pool, schema });