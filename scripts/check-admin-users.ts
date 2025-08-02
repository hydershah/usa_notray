import { db } from '../server/db';
import { users } from '../shared/schema';
import { eq, or, like, sql } from 'drizzle-orm';

async function checkAdminUsers() {
  console.log('🔍 Checking Admin Users...\n');

  try {
    // Check for users with admin role
    const adminRoleUsers = await db
      .select({ id: users.id, email: users.email, role: users.role, privileges: users.privileges })
      .from(users)
      .where(eq(users.role, 'admin'));

    console.log('Users with admin role:');
    adminRoleUsers.forEach(user => {
      console.log(`   - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, Privileges: ${user.privileges}`);
    });

    // Check for users with admin privileges
    const adminPrivilegeUsers = await db
      .select({ id: users.id, email: users.email, role: users.role, privileges: users.privileges })
      .from(users)
      .where(sql`'admin' = ANY(${users.privileges})`);

    console.log('\nUsers with admin privileges:');
    adminPrivilegeUsers.forEach(user => {
      console.log(`   - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, Privileges: ${user.privileges}`);
    });

    // Check all users to see what roles exist
    const allUsers = await db
      .select({ id: users.id, email: users.email, role: users.role, privileges: users.privileges })
      .from(users)
      .limit(10);

    console.log('\nAll users (first 10):');
    allUsers.forEach(user => {
      console.log(`   - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}, Privileges: ${user.privileges}`);
    });

  } catch (error) {
    console.error('❌ Failed to check admin users:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the script
checkAdminUsers()
  .then(() => {
    console.log('\n✅ Admin user check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Admin user check failed:', error);
    process.exit(1);
  }); 