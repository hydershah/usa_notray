import { storage } from '../server/storage.js';
import bcrypt from 'bcrypt';

async function testLoginCredentials() {
  console.log('🔍 Testing login credentials...');
  
  const email = 'info@usanotary.net';
  const password = 'AcesOverKing#22';
  
  try {
    // Get the user
    console.log(`📧 Looking up user: ${email}`);
    const user = await storage.getUserByEmail(email.toLowerCase());
    
    if (!user) {
      console.log('❌ User not found!');
      return;
    }
    
    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.isActive}`);
    console.log(`   Has Password: ${!!user.password}`);
    console.log(`   Password Length: ${user.password?.length || 0}`);
    
    // Test password comparison
    console.log(`\n🔐 Testing password: "${password}"`);
    
    if (!user.password) {
      console.log('❌ User has no password set!');
      return;
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(`🎯 Password match: ${isPasswordValid ? '✅ VALID' : '❌ INVALID'}`);
    
    if (!isPasswordValid) {
      console.log('\n🔄 Trying to create a new password hash...');
      const newHash = await bcrypt.hash(password, 10);
      console.log(`New hash: ${newHash}`);
      
      const testNewHash = await bcrypt.compare(password, newHash);
      console.log(`Test new hash: ${testNewHash ? '✅ WORKS' : '❌ FAILS'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testLoginCredentials();
