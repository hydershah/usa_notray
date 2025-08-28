import { db } from '../server/db.js';
import { sql } from 'drizzle-orm';
import { users } from '../shared/schema.js';

async function checkSetup() {
  console.log('🔍 Checking Railway database setup...');
  
  try {
    // Check if users table exists
    console.log('📋 Checking tables...');
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('✅ Tables found:', tables.rows?.map(t => t.table_name).join(', ') || 'No tables found');
    
    // Check users table specifically
    if (tables.rows?.some(t => t.table_name === 'users')) {
      console.log('👥 Checking users table...');
      
      const allUsers = await db.execute(sql`SELECT id, username, email, role FROM users;`);
      console.log(`📊 Total users: ${allUsers.rows?.length || 0}`);
      
      if (allUsers.rows && allUsers.rows.length > 0) {
        console.log('Users found:');
        allUsers.rows.forEach(user => {
          console.log(`  - ID: ${user.id}, Email: ${user.email}, Role: ${user.role}`);
        });
      } else {
        console.log('❌ No users found in database');
      }
      
      // Check for admin user specifically
      const adminUsers = await db.execute(sql`SELECT * FROM users WHERE role = 'admin';`);
      console.log(`👑 Admin users found: ${adminUsers.rows?.length || 0}`);
    } else {
      console.log('❌ Users table not found');
    }
    
    // Check if system_settings table exists for email config
    if (tables.rows?.some(t => t.table_name === 'system_settings')) {
      console.log('⚙️ Checking system settings...');
      const emailSettings = await db.execute(sql`SELECT key, value FROM system_settings WHERE key LIKE '%email%' OR key LIKE '%smtp%';`);
      console.log(`📧 Email settings found: ${emailSettings.rows?.length || 0}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Check failed:', error);
    process.exit(1);
  }
}

checkSetup();
