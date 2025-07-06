#!/usr/bin/env node

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runLiveSigningMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/notary_db'
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    
    console.log('📖 Reading migration file...');
    const migrationPath = path.join(__dirname, 'migration-live-signing-session-states.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Running live signing session migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Live signing session migration completed successfully!');
    console.log('');
    console.log('🎯 New Features Added:');
    console.log('   • Session state management (waiting, active, paused, completed)');
    console.log('   • Active user tracking for tag interaction control');
    console.log('   • Session participants status tracking'); 
    console.log('   • Live session events audit trail');
    console.log('   • Content storage for tag completion');
    console.log('');
    console.log('📡 API Endpoints Available:');
    console.log('   • POST /api/session/:sessionId/start-signing');
    console.log('   • GET /api/session/:sessionId/state');
    console.log('   • POST /api/session/:sessionId/set-active-user');
    console.log('   • POST /api/session/:sessionId/pause');
    console.log('   • POST /api/session/:sessionId/resume');
    console.log('');
    console.log('🎉 Ready to start live signing sessions!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the migration
runLiveSigningMigration().catch(console.error); 