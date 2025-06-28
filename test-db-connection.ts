import { storage } from "./server/storage.ts";
import bcrypt from "bcrypt";

async function testDbConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test getting user by email
    const user = await storage.getUserByEmail('admin@usanotary.com');
    console.log('Found user:', {
      id: user?.id,
      username: user?.username,
      email: user?.email,
      role: user?.role,
      hasPassword: !!user?.password
    });

    if (!user) {
      console.log('User not found!');
      return;
    }

    // Test password comparison
    console.log('Testing password comparison...');
    const isValidPassword = await bcrypt.compare('admin123', user.password);
    console.log('Password valid:', isValidPassword);

    if (isValidPassword) {
      console.log('✅ Authentication test passed!');
    } else {
      console.log('❌ Password comparison failed');
    }

  } catch (error) {
    console.error('Database connection test failed:', error);
  } finally {
    process.exit(0);
  }
}

testDbConnection(); 