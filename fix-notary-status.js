const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { users } = require('./shared/schema');
const { eq } = require('drizzle-orm');

// Database connection
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
if (!connectionString) {
  console.error('❌ No database connection string found');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

async function fixNotaryStatus() {
  try {
    console.log('🔧 Fixing notary approval and profile status...');
    
    // Update the admin user to fix both issues
    const result = await db
      .update(users)
      .set({
        approvalStatus: 'approved',
        profileSubmitted: true,
        approvedAt: new Date(),
        lastProfileUpdate: new Date()
      })
      .where(eq(users.email, 'admin@usanotary.com'))
      .returning({ id: users.id, email: users.email });

    if (result.length > 0) {
      console.log('✅ Successfully updated notary status:');
      console.log(`   - User: ${result[0].email} (ID: ${result[0].id})`);
      console.log('   - Approval Status: approved');
      console.log('   - Profile Submitted: true');
      console.log('   - Approved At: now');
    } else {
      console.log('⚠️ No user found with email admin@usanotary.com');
    }

  } catch (error) {
    console.error('❌ Failed to update notary status:', error);
  } finally {
    await sql.end();
    console.log('🔚 Database connection closed');
  }
}

// Run the fix
fixNotaryStatus(); 