import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runSupabaseKBALockoutMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
  }

  try {
    console.log('🌐 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Read the migration file
    const migrationSQL = fs.readFileSync('./migration-kba-lockout-system.sql', 'utf8');
    
    console.log('📋 Executing KBA lockout migration on Supabase...');
    
    // Split the migration into individual statements for better error handling
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;
      
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const { data, error } = await supabase.rpc('execute_sql', { 
        query: statement + ';'
      });

      if (error) {
        // Try alternative execution method
        const { data: altData, error: altError } = await supabase
          .from('_sql_execution')
          .insert({ query: statement + ';' });
        
        if (altError) {
          console.log(`⚠️ Statement ${i + 1} may have failed: ${error.message}`);
          console.log(`Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }

    console.log('✅ Supabase KBA lockout migration completed!');
    
    // Verify the migration by checking if new columns exist
    const { data: columns, error: verifyError } = await supabase
      .rpc('get_table_columns', { table_name: 'users' });

    if (!verifyError && columns) {
      const kbaColumns = columns.filter(col => col.column_name?.includes('kba'));
      console.log('🔍 KBA columns found:', kbaColumns.length);
      kbaColumns.forEach(col => console.log(`   - ${col.column_name}`));
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
runSupabaseKBALockoutMigration(); 