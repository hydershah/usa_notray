import { storage } from '../server/storage';
import bcrypt from 'bcrypt';

async function createMissingUser() {
  try {
    const email = 'title@cryptofamilyuser.com';
    const password = process.argv[2];
    
    if (!password) {
      console.log('❌ Please provide a password as an argument');
      console.log('Usage: npx tsx scripts/create-missing-user.ts "your-password"');
      process.exit(1);
    }

    console.log('🔍 Creating missing user account...');
    
    // Check if user already exists
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      console.log('✅ User already exists! No need to create.');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user account
    const userData = {
      username: email,
      email: email,
      password: hashedPassword,
      firstName: 'Hyder', // Based on company name
      lastName: '',
      fullName: 'Hyder',
      role: 'title_company',
      companyRole: 'manager',
      companyId: 15, // The company ID we found
      isActive: true,
      approvalStatus: 'approved',
      emailVerified: true,
      emailVerifiedAt: new Date()
    };

    const newUser = await storage.createUser(userData);

    console.log('✅ User account created successfully!');
    console.log(`  - ID: ${newUser.id}`);
    console.log(`  - Email: ${newUser.email}`);
    console.log(`  - Role: ${newUser.role}`);
    console.log(`  - Company ID: ${newUser.companyId}`);
    console.log(`  - Is Active: ${newUser.isActive}`);
    
    console.log('\n🎉 You can now log in with:');
    console.log(`  Email: ${email}`);
    console.log(`  Password: [the password you provided]`);

  } catch (error) {
    console.error('❌ Error creating user:', error);
  }
}

createMissingUser().then(() => {
  console.log('\n✅ User creation completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
