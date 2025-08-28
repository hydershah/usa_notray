import { storage } from '../server/storage.js';
import bcrypt from 'bcrypt';

async function createSpecificUser() {
  console.log('🧪 Creating specific user account...');
  
  const email = 'info@usanotary.net';
  const password = 'AcesOverKing#22';
  const fullName = 'USA Notary Services';
  
  try {
    // Check if user already exists
    console.log('📧 Checking if user already exists...');
    const existingUser = await storage.getUserByEmail(email.toLowerCase());
    if (existingUser) {
      console.log('❌ User already exists with this email:', email);
      console.log('User details:', {
        id: existingUser.id,
        email: existingUser.email,
        role: existingUser.role,
        fullName: existingUser.fullName || `${existingUser.firstName} ${existingUser.lastName}`.trim()
      });
      return;
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Parse full name
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create user data
    const userData = {
      username: email,
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName: firstName,
      lastName: lastName,
      fullName: fullName,
      phoneNumber: '(804) 767-7500', // Phone from the website
      address1: '11357 Nuckols Road, Suite 1087',
      city: 'Glen Allen',
      state: 'VA',
      zipCode: '23059',
      role: 'admin', // Making this user an admin
      isActive: true,
      approvalStatus: 'approved',
      isNotificationsEnabled: true,
      mfaEnabled: false,
      foreignLanguages: []
    };

    console.log('👤 Creating user with data:', {
      email: userData.email,
      fullName: userData.fullName,
      role: userData.role,
      address: `${userData.address1}, ${userData.city}, ${userData.state} ${userData.zipCode}`
    });

    // Create user
    const newUser = await storage.createUser(userData);

    console.log('✅ User created successfully!');
    console.log('User details:', {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName || `${newUser.firstName} ${newUser.lastName}`.trim(),
      role: newUser.role,
      isActive: newUser.isActive
    });

    console.log('\n🎯 Login credentials:');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${newUser.role}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create user:', error);
    process.exit(1);
  }
}

createSpecificUser();
