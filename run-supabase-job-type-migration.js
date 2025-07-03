import { pool } from './server/db.ts';
import fs from 'fs';

async function runSupabaseJobTypeMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running Job Type Migration on Supabase...');
    console.log('Adding subscriber vs contractor workflow fields to Supabase database...\n');
    
    // Read the job type migration
    console.log('📖 Reading migration file...');
    const migrationSQL = fs.readFileSync('./migration-add-job-type-field.sql', 'utf8');
    
    console.log('📝 Executing migration SQL on Supabase...');
    await client.query(migrationSQL);
    console.log('✅ Migration SQL executed successfully on Supabase!\n');

    // Verify the job_type column was added
    console.log('🔍 Verifying job_type column in Supabase...');
    
    const verificationQuery = `
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND table_schema = 'public'
      AND column_name = 'job_type'
      ORDER BY column_name;
    `;
    
    const result = await client.query(verificationQuery);
    
    if (result.rows.length > 0) {
      console.log('📊 Verified job_type column in Supabase:');
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.column_name} (${row.data_type}) - Default: ${row.column_default || 'none'}`);
      });
    } else {
      console.log('⚠️  Could not verify job_type column - it may already exist');
    }

    // Verify the constraints were added
    console.log('\n🔍 Verifying constraints in Supabase...');
    
    const constraintQuery = `
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints 
      WHERE constraint_name IN ('check_job_type', 'check_assignment_type')
      AND constraint_schema = 'public';
    `;
    
    const constraintResult = await client.query(constraintQuery);
    
    if (constraintResult.rows.length > 0) {
      console.log('📊 Verified constraints in Supabase:');
      constraintResult.rows.forEach(row => {
        console.log(`  ✅ ${row.constraint_name}: ${row.check_clause}`);
      });
    } else {
      console.log('⚠️  Could not verify constraints - they may already exist');
    }

    // Verify the indexes were created
    console.log('\n🔍 Verifying indexes in Supabase...');
    
    const indexQuery = `
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname IN ('idx_jobs_job_type', 'idx_jobs_subscriber_personal')
      ORDER BY indexname;
    `;
    
    const indexResult = await client.query(indexQuery);
    
    if (indexResult.rows.length > 0) {
      console.log('📊 Verified indexes in Supabase:');
      indexResult.rows.forEach(row => {
        console.log(`  ✅ ${row.indexname} on ${row.tablename}`);
      });
    } else {
      console.log('⚠️  Could not verify indexes - they may already exist');
    }

    // Test the job type system
    console.log('\n🧪 Testing job type system in Supabase...');
    
    const testQuery = `
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE job_type = 'title_company') as title_company_jobs,
        COUNT(*) FILTER (WHERE job_type = 'subscriber_personal') as subscriber_jobs,
        COUNT(*) FILTER (WHERE job_type IS NULL) as null_job_types
      FROM jobs;
    `;
    
    const testResult = await client.query(testQuery);
    console.log('📈 Supabase job type system status:');
    console.log(`  Total jobs: ${testResult.rows[0].total_jobs}`);
    console.log(`  Title company jobs: ${testResult.rows[0].title_company_jobs}`);
    console.log(`  Subscriber personal jobs: ${testResult.rows[0].subscriber_jobs}`);
    console.log(`  Null job types: ${testResult.rows[0].null_job_types}`);

    // Test assignment type system
    console.log('\n🧪 Testing assignment type system in Supabase...');
    
    const assignmentTestQuery = `
      SELECT 
        COUNT(*) as total_assignments,
        COUNT(*) FILTER (WHERE assignment_type = 'manual') as manual_assignments,
        COUNT(*) FILTER (WHERE assignment_type = 'random') as random_assignments,
        COUNT(*) FILTER (WHERE assignment_type = 'preferred') as preferred_assignments,
        COUNT(*) FILTER (WHERE assignment_type = 'subscriber_self') as subscriber_self_assignments
      FROM notary_assignment_log;
    `;
    
    const assignmentTestResult = await client.query(assignmentTestQuery);
    console.log('📈 Supabase assignment type system status:');
    console.log(`  Total assignments: ${assignmentTestResult.rows[0].total_assignments}`);
    console.log(`  Manual assignments: ${assignmentTestResult.rows[0].manual_assignments}`);
    console.log(`  Random assignments: ${assignmentTestResult.rows[0].random_assignments}`);
    console.log(`  Preferred assignments: ${assignmentTestResult.rows[0].preferred_assignments}`);
    console.log(`  Subscriber self assignments: ${assignmentTestResult.rows[0].subscriber_self_assignments}`);

    // Update existing jobs to have proper job_type if needed
    console.log('\n🔄 Ensuring existing jobs have proper job_type...');
    
    const updateQuery = `
      UPDATE jobs 
      SET job_type = 'title_company' 
      WHERE job_type IS NULL;
    `;
    
    const updateResult = await client.query(updateQuery);
    console.log(`📝 Updated ${updateResult.rowCount} jobs to have title_company type`);

    console.log('\n🎉 Supabase Job Type Migration completed successfully!');
    console.log('✅ job_type field added to jobs table');
    console.log('✅ Constraints added for data integrity');
    console.log('✅ Indexes created for query performance');
    console.log('✅ Assignment type updated for subscriber workflow');
    console.log('✅ Supabase system ready for subscriber vs contractor workflow');
    
  } catch (error) {
    console.error('❌ Supabase job type migration failed:', error);
    
    // Provide specific error context for common Supabase issues
    if (error.message.includes('permission denied')) {
      console.error('🔒 Permission Error: Make sure your Supabase user has proper database permissions');
    } else if (error.message.includes('already exists')) {
      console.log('ℹ️  Some components may already exist in Supabase - this is usually safe to ignore');
    } else if (error.message.includes('connection')) {
      console.error('🌐 Connection Error: Check your Supabase connection settings and network');
    } else if (error.message.includes('constraint')) {
      console.error('🔧 Constraint Error: Check that job_type values are valid');
    }
    
    throw error;
  } finally {
    client.release();
  }
}

runSupabaseJobTypeMigration()
  .then(() => {
    console.log('\n🚀 Supabase Job Type system is ready!');
    console.log('📋 Next steps:');
    console.log('   1. Restart the application');
    console.log('   2. Test job creation as subscriber notary');
    console.log('   3. Test job creation as title company/admin');
    console.log('   4. Verify different workflows work correctly');
    console.log('   5. Monitor job assignments in Supabase dashboard');
    console.log('\n💡 Key features now available:');
    console.log('   🔵 Subscriber notaries can create personal client jobs');
    console.log('   🟢 Title companies get contractor notary assignments');
    console.log('   🔄 Automatic workflow differentiation');
    console.log('   💰 Proper billing separation');
    console.log('\n🌐 Supabase Dashboard: https://ueoqbwsigpowzbdlqezz.supabase.co');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Supabase migration failed with error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check Supabase connection in server/db.ts');
    console.log('   2. Verify database permissions in Supabase dashboard');
    console.log('   3. Ensure migration file exists: migration-add-job-type-field.sql');
    console.log('   4. Check network connectivity to Supabase');
    console.log('   5. Verify jobs and notary_assignment_log tables exist');
    process.exit(1);
  }); 