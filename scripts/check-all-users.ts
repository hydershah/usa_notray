import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  privileges: string[] | null;
  created_at: Date | null;
  notary_verification_bypassed_job_id: number | null;
}

async function checkAllUsers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Query to get all users
    const query = `
      SELECT 
        id,
        username,
        email,
        role,
        privileges,
        created_at,
        notary_verification_bypassed_job_id
      FROM users
      ORDER BY id ASC
    `;

    const result = await client.query(query);
    const users = result.rows as User[];

    console.log(`\n📊 Found ${users.length} users in the database\n`);

    if (users.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    // Display users in a formatted table
    console.log('='.repeat(100));
    console.log('ALL USERS IN DATABASE');
    console.log('='.repeat(100));

    users.forEach((user, index) => {
      console.log(`\n${index + 1}. USER ID: ${user.id}`);
      console.log('-'.repeat(40));
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Privileges: ${user.privileges ? user.privileges.join(', ') : 'None'}`);
      console.log(`   Created At: ${user.created_at}`);
      console.log(`   Notary Verification Bypassed Job ID: ${user.notary_verification_bypassed_job_id || 'None'}`);
      console.log('-'.repeat(40));
    });

    // Summary statistics
    console.log('\n📈 USER STATISTICS:');
    console.log('='.repeat(50));
    
    const roleCounts = users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`   ${role.toUpperCase()}: ${count}`);
    });
    
    const usersWithBypassedJob = users.filter(user => user.notary_verification_bypassed_job_id).length;
    console.log(`\n   Users with bypassed job verification: ${usersWithBypassedJob}`);
    
    const activeUsers = users.filter(user => user.created_at).length;
    console.log(`   Total active users: ${activeUsers}`);

    // Check for any users that might have been affected by job deletion
    const usersWithJobReferences = users.filter(user => user.notary_verification_bypassed_job_id);
    if (usersWithJobReferences.length > 0) {
      console.log('\n⚠️  USERS WITH JOB REFERENCES:');
      console.log('='.repeat(50));
      usersWithJobReferences.forEach(user => {
        console.log(`   User ${user.username} (ID: ${user.id}) - Job ID: ${user.notary_verification_bypassed_job_id}`);
      });
    } else {
      console.log('\n✅ All users have been properly cleaned of job references');
    }

  } catch (error) {
    console.error('❌ Error checking users:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

// Run the script
checkAllUsers(); 