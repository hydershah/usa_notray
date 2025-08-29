#!/usr/bin/env npx tsx

/**
 * Create Admin User in Coolify PostgreSQL
 * Creates: info@usanotary.net with admin privileges
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users } from '../shared/schema.js';
import { sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as schema from '../shared/schema.js';

async function createAdminUserCoolify() {
  try {
    console.log('👤 Creating Admin User in Coolify PostgreSQL\n');

    // Hardcoded Coolify connection
    const coolifyUrl = "postgres://postgres:h1Vk5DUJxhjTSKkddqfGGvTaBblXOgPxddNHBNuwCtYrZEiQtElfnFewz4ZbGx9O@45.32.217.149:5432/postgres";
    
    const pool = new Pool({
      connectionString: coolifyUrl,
      ssl: false,
      max: 2,
    });

    const db = drizzle({ client: pool, schema });

    console.log('🔗 Connected to Coolify database');

    // Hash the password
    console.log('🔒 Hashing password...');
    const hashedPassword = await bcrypt.hash('AcesOverKing#22', 10);

    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const existingUser = await db.execute(sql`
      SELECT id, email, role FROM users WHERE email = 'info@usanotary.net';
    `);

    if (existingUser.rows.length > 0) {
      console.log('⚠️  User already exists! Updating password and role...');
      
      await db.execute(sql`
        UPDATE users 
        SET 
          password = ${hashedPassword},
          role = 'admin',
          is_active = true,
          email_verified = true,
          profile_complete = true,
          account_setup_complete = true,
          updated_at = NOW()
        WHERE email = 'info@usanotary.net';
      `);
      
      console.log('✅ User updated successfully!');
    } else {
      console.log('➕ Creating new admin user...');
      
      const [newUser] = await db.insert(users).values({
        username: 'usanotary_admin',
        email: 'info@usanotary.net',
        password: hashedPassword,
        role: 'admin',
        firstName: 'USA',
        lastName: 'Notary',
        fullName: 'USA Notary Admin',
        isActive: true,
        emailVerified: true,
        profileComplete: true,
        accountSetupComplete: true
      }).returning();
      
      console.log('✅ New admin user created successfully!');
      console.log(`   ID: ${newUser.id}`);
    }

    // Verify the user was created/updated
    console.log('\n🔍 Verifying admin user...');
    const verifyUser = await db.execute(sql`
      SELECT id, username, email, role, first_name, last_name, is_active, email_verified, profile_complete
      FROM users 
      WHERE email = 'info@usanotary.net';
    `);

    if (verifyUser.rows.length > 0) {
      const user = verifyUser.rows[0];
      console.log('✅ Admin user verified:');
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   👤 Name: ${user.first_name} ${user.last_name}`);
      console.log(`   🏷️  Role: ${user.role}`);
      console.log(`   ✅ Active: ${user.is_active}`);
      console.log(`   📨 Email Verified: ${user.email_verified}`);
      console.log(`   📋 Profile Complete: ${user.profile_complete}`);
    }

    // Test login credentials
    console.log('\n🔐 Testing login credentials...');
    const loginTest = await db.execute(sql`
      SELECT id, email, password, role 
      FROM users 
      WHERE email = 'info@usanotary.net' AND is_active = true;
    `);

    if (loginTest.rows.length > 0) {
      const user = loginTest.rows[0];
      const passwordMatch = await bcrypt.compare('AcesOverKing#22', user.password);
      
      if (passwordMatch) {
        console.log('✅ Password verification successful!');
        console.log('🎉 Login credentials are working correctly');
      } else {
        console.log('❌ Password verification failed');
      }
    }

    // Show database summary
    console.log('\n📊 Database Summary:');
    const totalUsers = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE is_active = true;`);
    const adminUsers = await db.execute(sql`SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND is_active = true;`);
    
    console.log(`   👥 Total Active Users: ${totalUsers.rows[0].count}`);
    console.log(`   🔧 Admin Users: ${adminUsers.rows[0].count}`);

    await pool.end();

    console.log('\n🎉 Admin User Setup Complete!');
    console.log('\n🔑 Login Credentials:');
    console.log('   📧 Email: info@usanotary.net');
    console.log('   🔑 Password: AcesOverKing#22');
    console.log('   🏷️  Role: admin');
    
    console.log('\n⚠️  Important:');
    console.log('   • Fix your app\'s DATABASE_URL first to connect to Coolify');
    console.log('   • Use IP: 45.32.217.149:5432 instead of tk88ksw4gc44g:5432');
    console.log('   • Then test login with the above credentials');

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
}

createAdminUserCoolify();
