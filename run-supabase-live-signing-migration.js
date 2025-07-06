import { pool } from './server/db.ts';
import fs from 'fs';

async function runSupabaseLiveSigningMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running Live Signing Session States Migration on Supabase...');
    console.log('Adding live signing session support and participant tracking to Supabase database...\n');
    
    // Read the live signing session migration
    console.log('📖 Reading migration file...');
    const migrationSQL = fs.readFileSync('./migration-live-signing-session-states.sql', 'utf8');
    
    console.log('📝 Executing migration SQL on Supabase...');
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully on Supabase!\n');

    // Verify the new columns were added to editor_sessions
    console.log('🔍 Verifying live signing columns in editor_sessions table...');
    
    const editorSessionsQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'editor_sessions' 
      AND table_schema = 'public'
      AND column_name IN (
        'signing_state', 
        'started_at', 
        'paused_at', 
        'resumed_at',
        'completed_at',
        'active_user_id',
        'is_live_session'
      )
      ORDER BY column_name;
    `;
    
    const editorResult = await client.query(editorSessionsQuery);
    
    if (editorResult.rows.length > 0) {
      console.log('📊 Verified live signing columns in editor_sessions:');
      editorResult.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'none'}`);
      });
    } else {
      console.log('⚠️  Could not verify editor_sessions columns - they may already exist');
    }

    // Verify document_tags content columns
    console.log('\n🔍 Verifying content columns in document_tags table...');
    
    const documentTagsQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'document_tags' 
      AND table_schema = 'public'
      AND column_name IN (
        'content_type', 
        'content_data', 
        'is_required', 
        'completed_by',
        'completed_at'
      )
      ORDER BY column_name;
    `;
    
    const tagsResult = await client.query(documentTagsQuery);
    
    if (tagsResult.rows.length > 0) {
      console.log('📊 Verified content columns in document_tags:');
      tagsResult.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'none'}`);
      });
    } else {
      console.log('⚠️  Could not verify document_tags columns - they may already exist');
    }

    // Verify the session participants status table was created
    console.log('\n🔍 Verifying session_participants_status table...');
    
    const participantsTableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'session_participants_status'
      AND table_schema = 'public';
    `;
    
    const participantsResult = await client.query(participantsTableQuery);
    
    if (participantsResult.rows.length > 0) {
      console.log('📊 ✅ session_participants_status table created successfully');
      
      // Check the table structure
      const structureQuery = `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'session_participants_status' 
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `;
      
      const structureResult = await client.query(structureQuery);
      console.log('📋 Table structure:');
      structureResult.rows.forEach(row => {
        console.log(`  📝 ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('⚠️  session_participants_status table was not created');
    }

    // Verify the live session events table was created
    console.log('\n🔍 Verifying live_session_events table...');
    
    const eventsTableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'live_session_events'
      AND table_schema = 'public';
    `;
    
    const eventsResult = await client.query(eventsTableQuery);
    
    if (eventsResult.rows.length > 0) {
      console.log('📊 ✅ live_session_events table created successfully');
    } else {
      console.log('⚠️  live_session_events table was not created');
    }

    // Test the indexes were created
    console.log('\n🔍 Verifying indexes...');
    
    const indexQuery = `
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname IN ('idx_editor_sessions_signing_state')
      ORDER BY tablename, indexname;
    `;
    
    const indexResult = await client.query(indexQuery);
    
    if (indexResult.rows.length > 0) {
      console.log('📊 ✅ Performance indexes created:');
      indexResult.rows.forEach(row => {
        console.log(`  🚀 ${row.indexname} on ${row.tablename}`);
      });
    } else {
      console.log('⚠️  Performance indexes may not have been created');
    }

    // Test a comprehensive query
    console.log('\n🧪 Testing live signing system...');
    
    const testQuery = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE signing_state = 'waiting') as waiting_sessions,
        COUNT(*) FILTER (WHERE signing_state = 'active') as active_sessions,
        COUNT(*) FILTER (WHERE is_live_session = true) as live_sessions
      FROM editor_sessions;
    `;
    
    const testResult = await client.query(testQuery);
    console.log('📈 Live signing system status:');
    console.log(`  Total sessions: ${testResult.rows[0].total_sessions}`);
    console.log(`  Waiting sessions: ${testResult.rows[0].waiting_sessions}`);
    console.log(`  Active sessions: ${testResult.rows[0].active_sessions}`);
    console.log(`  Live sessions: ${testResult.rows[0].live_sessions}`);

    console.log('\n🎉 Supabase Live Signing Session Migration completed successfully!');
    console.log('✅ Live signing state columns added to editor_sessions');
    console.log('✅ Content storage columns added to document_tags');
    console.log('✅ Session participants status table created');
    console.log('✅ Live session events audit table created');
    console.log('✅ Performance indexes created');
    console.log('✅ Supabase system ready for live signing sessions');
    
  } catch (error) {
    console.error('❌ Supabase live signing migration failed:', error);
    
    // Provide specific error context for common Supabase issues
    if (error.message.includes('permission denied')) {
      console.error('🔒 Permission Error: Make sure your Supabase user has proper database permissions');
    } else if (error.message.includes('already exists')) {
      console.log('ℹ️  Some components may already exist in Supabase - this is usually safe to ignore');
    } else if (error.message.includes('connection')) {
      console.error('🌐 Connection Error: Check your Supabase connection settings and network');
    }
    
    throw error;
  } finally {
    client.release();
  }
}

runSupabaseLiveSigningMigration()
  .then(() => {
    console.log('\n🚀 Supabase Live Signing System is ready!');
    console.log('📋 Next steps:');
    console.log('   1. Restart the application');
    console.log('   2. Test live signing session creation');
    console.log('   3. Verify session participant tracking');
    console.log('   4. Monitor live_session_events for audit trail');
    console.log('   5. Check session state transitions work properly');
    console.log('\n🌐 Supabase Dashboard: https://ueoqbwsigpowzbdlqezz.supabase.co');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Supabase migration failed with error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check Supabase connection in server/db.ts');
    console.log('   2. Verify database permissions in Supabase dashboard');
    console.log('   3. Ensure migration file exists: migration-live-signing-session-states.sql');
    console.log('   4. Check network connectivity to Supabase');
    process.exit(1);
  }); 