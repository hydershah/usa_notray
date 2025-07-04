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

// PostgreSQL connection pool with maximum Supabase configuration
export const pool = new Pool({ 
  connectionString: DATABASE_URL,
  // Maximum connection pool settings for Supabase
  max: 50, // Maximum connections for Supabase (can handle high load)
  min: 10, // Higher minimum to maintain warm connections
  idleTimeoutMillis: 300000, // Keep connections for 5 minutes (300 seconds)
  connectionTimeoutMillis: 60000, // Extended timeout for new connections (60 seconds)
  acquireTimeoutMillis: 30000, // Extended timeout for acquiring from pool (30 seconds)
  // Enable connection reuse and health checks
  allowExitOnIdle: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Extended statement timeout for complex queries
  statement_timeout: 300000, // Extended to 5 minutes for complex operations
  query_timeout: 300000, // Extended to 5 minutes for complex operations
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