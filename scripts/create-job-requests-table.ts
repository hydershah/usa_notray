import { db } from '../server/db';
import { sql } from 'drizzle-orm';

async function createJobRequestsTable() {
  try {
    console.log('🚀 Creating job_requests table...');
    
    // Create the table
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
    
    console.log('✅ Table created successfully!');
    
    // Verify the table was created
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'job_requests'
      );
    `);
    
    console.log('Table exists:', tableExists[0]?.exists);
    
  } catch (error) {
    console.error('❌ Error creating table:', error);
    throw error;
  }
}

createJobRequestsTable()
  .then(() => {
    console.log('🎉 Table creation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Table creation failed:', error);
    process.exit(1);
  }); 