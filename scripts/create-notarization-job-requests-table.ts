import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function createNotarizationJobRequestsTable() {
  try {
    console.log('🚀 Creating notarization_job_requests table...');
    
    // Create the table with the correct structure for notarization requests
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notarization_job_requests (
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
    
    console.log('✅ Table created successfully!');
    
    // Add constraints
    try {
      await db.execute(sql`
        ALTER TABLE notarization_job_requests ADD CONSTRAINT check_urgency 
        CHECK (urgency IN ('low', 'normal', 'high', 'urgent'));
      `);
      console.log('✅ Urgency constraint added');
    } catch (error: any) {
      if (error.code === '42710') {
        console.log('ℹ️ Urgency constraint already exists');
      } else {
        throw error;
      }
    }

    try {
      await db.execute(sql`
        ALTER TABLE notarization_job_requests ADD CONSTRAINT check_status 
        CHECK (status IN ('pending', 'approved', 'rejected', 'assigned', 'completed', 'cancelled'));
      `);
      console.log('✅ Status constraint added');
    } catch (error: any) {
      if (error.code === '42710') {
        console.log('ℹ️ Status constraint already exists');
      } else {
        throw error;
      }
    }

    try {
      await db.execute(sql`
        ALTER TABLE notarization_job_requests ADD CONSTRAINT check_priority 
        CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
      `);
      console.log('✅ Priority constraint added');
    } catch (error: any) {
      if (error.code === '42710') {
        console.log('ℹ️ Priority constraint already exists');
      } else {
        throw error;
      }
    }

    // Add indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_notarization_job_requests_status ON notarization_job_requests(status);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_notarization_job_requests_requestor ON notarization_job_requests(requestor_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_notarization_job_requests_priority ON notarization_job_requests(priority);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_notarization_job_requests_created_at ON notarization_job_requests(created_at);
    `);

    console.log('✅ Indexes created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

createNotarizationJobRequestsTable()
  .then(() => {
    console.log('🎉 Table creation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Table creation failed:', error);
    process.exit(1);
  }); 