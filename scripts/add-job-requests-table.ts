import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function addJobRequestsTable() {
  console.log('🚀 Adding job_requests table...');
  
  try {
    // Create job_requests table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS job_requests (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        document_type TEXT NOT NULL,
        urgency TEXT NOT NULL DEFAULT 'normal',
        preferred_date TEXT,
        preferred_time TEXT,
        location TEXT,
        requestor_id INTEGER NOT NULL REFERENCES users(id),
        requestor_email TEXT NOT NULL,
        requestor_phone TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT DEFAULT 'normal',
        reviewed_by INTEGER REFERENCES users(id),
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        assigned_notary_id INTEGER REFERENCES users(id),
        assigned_at TIMESTAMP,
        assignment_notes TEXT,
        converted_to_job_id INTEGER REFERENCES jobs(id),
        converted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        metadata JSONB
      );
    `);

    console.log('✅ Table created, adding constraints...');

    // Add constraints with better error handling
    try {
      await db.execute(sql`
        ALTER TABLE job_requests ADD CONSTRAINT check_urgency 
        CHECK (urgency IN ('low', 'normal', 'high', 'urgent'));
      `);
      console.log('✅ Urgency constraint added');
    } catch (error: any) {
      if (error.code === '42710') { // duplicate_object
        console.log('ℹ️ Urgency constraint already exists');
      } else {
        throw error;
      }
    }

    try {
      await db.execute(sql`
        ALTER TABLE job_requests ADD CONSTRAINT check_status 
        CHECK (status IN ('pending', 'approved', 'rejected', 'assigned', 'completed', 'cancelled'));
      `);
      console.log('✅ Status constraint added');
    } catch (error: any) {
      if (error.code === '42710') { // duplicate_object
        console.log('ℹ️ Status constraint already exists');
      } else {
        throw error;
      }
    }

    try {
      await db.execute(sql`
        ALTER TABLE job_requests ADD CONSTRAINT check_priority 
        CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
      `);
      console.log('✅ Priority constraint added');
    } catch (error: any) {
      if (error.code === '42710') { // duplicate_object
        console.log('ℹ️ Priority constraint already exists');
      } else {
        throw error;
      }
    }

    // Add indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_job_requests_requestor ON job_requests(requestor_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_job_requests_priority ON job_requests(priority);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_job_requests_created_at ON job_requests(created_at);
    `);

    console.log('✅ job_requests table created successfully!');
  } catch (error) {
    console.error('❌ Error creating job_requests table:', error);
    throw error;
  }
}

// Run the migration
addJobRequestsTable()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }); 