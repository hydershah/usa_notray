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

// PostgreSQL connection for Drizzle ORM (backend operations)
export const pool = new Pool({ connectionString: DATABASE_URL });
export const db = drizzle({ client: pool, schema });