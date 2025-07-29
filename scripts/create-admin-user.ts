import { db } from '../server/db';
import { users } from '../shared/schema';
import bcrypt from 'bcrypt';

async function createAdminUser() {
  console.log('👤 Creating Admin User for Job Request Testing...\n');

  try {
    // Check if admin user already exists
    const existingAdmin = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(users.role === 'admin')
      .limit(1);

    if (existingAdmin.length > 0) {
      console.log('✅ Admin user already exists:');
      console.log(`   - ID: ${existingAdmin[0].id}`);
      console.log(`   - Email: ${existingAdmin[0].email}`);
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const [newAdmin] = await db
      .insert(users)
      .values({
        username: 'admin',
        email: 'admin@test.com',
        password: hashedPassword,
        role: 'admin',
        privileges: ['admin'],
        firstName: 'Admin',
        lastName: 'User',
        fullName: 'Admin User',
        phoneNumber: '+1234567890',
        isActive: true,
        isVerified: true,
        verificationStatus: 'approved'
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    console.log('✅ Admin user created successfully:');
    console.log(`   - ID: ${newAdmin.id}`);
    console.log(`   - Email: ${newAdmin.email}`);
    console.log(`   - Role: ${newAdmin.role}`);
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('   - Email: admin@test.com');
    console.log('   - Password: admin123');
    console.log('');
    console.log('📝 Use these credentials to test the admin job request functionality');

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the script
createAdminUser()
  .then(() => {
    console.log('✅ Admin user setup completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Admin user setup failed:', error);
    process.exit(1);
  }); 