#!/usr/bin/env npx tsx

/**
 * Create Admin User in Coolify PostgreSQL (Retry with Better Connection Handling)
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { users } from '../shared/schema.js';
import { sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as schema from '../shared/schema.js';

async function createAdminUserCoolify() {
  let pool: Pool | null = null;
  
  try {
    console.log('👤 Creating Admin User in Coolify PostgreSQL\n');

    // Hardcoded Coolify connection with better settings
    const coolifyUrl = "postgres://postgres:h1Vk5DUJxhjTSKkddqfGGvTaBblXOgPxddNHBNuwCtYrZEiQtElfnFewz4ZbGx9O@45.32.217.149:5432/postgres";
    
    pool = new Pool({
      connectionString: coolifyUrl,
      ssl: false,
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
      acquireTimeoutMillis: 15000,
      allowExitOnIdle: true
    });

    const db = drizzle({ client: pool, schema });

    // Test connection first
    console.log('⏱️  Testing connection...');
    const connectionStart = Date.now();
    await db.execute(sql`SELECT 1 as test;`);
    const connectionTime = Date.now() - connectionStart;
    console.log(`✅ Connected successfully! (${connectionTime}ms)`);

    // Hash the password
    console.log('🔒 Hashing password...');
    const hashedPassword = await bcrypt.hash('AcesOverKing#22', 10);

    // Check if user already exists
    console.log('🔍 Checking if user already exists...');
    const existingCheck = await db.execute(sql`
      SELECT id, email, role, is_active FROM users 
      WHERE LOWER(email) = LOWER('info@usanotary.net');
    `);

    if (existingCheck.rows.length > 0) {
      const existing = existingCheck.rows[0];
      console.log(`⚠️  User already exists (ID: ${existing.id}, Role: ${existing.role})`);
      console.log('🔄 Updating password and ensuring admin privileges...');
      
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
        WHERE LOWER(email) = LOWER('info@usanotary.net');
      `);
      
      console.log('✅ User updated successfully!');
    } else {
      console.log('➕ Creating new admin user...');
      
      const insertResult = await db.execute(sql`
        INSERT INTO users (
          username, email, password, role, first_name, last_name, full_name,
          is_active, email_verified, profile_complete, account_setup_complete,
          created_at, updated_at
        ) VALUES (
          'usanotary_admin',
          'info@usanotary.net',
          ${hashedPassword},
          'admin',
          'USA',
          'Notary',
          'USA Notary Admin',
          true,
          true,
          true,
          true,
          NOW(),
          NOW()
        ) RETURNING id, email;
      `);
      
      console.log('✅ New admin user created successfully!');
      if (insertResult.rows.length > 0) {
        console.log(`   ID: ${insertResult.rows[0].id}`);
      }
    }

    // Verify the user
    console.log('\n🔍 Verifying admin user...');
    const verifyResult = await db.execute(sql`
      SELECT id, username, email, role, first_name, last_name, 
             is_active, email_verified, profile_complete, account_setup_complete
      FROM users 
      WHERE LOWER(email) = LOWER('info@usanotary.net');
    `);

    if (verifyResult.rows.length > 0) {
      const user = verifyResult.rows[0];
      console.log('✅ Admin user verified:');
      console.log(`   🆔 ID: ${user.id}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   👤 Username: ${user.username}`);
      console.log(`   🏷️  Role: ${user.role}`);
      console.log(`   ✅ Active: ${user.is_active}`);
      console.log(`   📨 Email Verified: ${user.email_verified}`);
      console.log(`   📋 Profile Complete: ${user.profile_complete}`);
      console.log(`   🔧 Setup Complete: ${user.account_setup_complete}`);
    }

    // Test password
    console.log('\n🔐 Testing login credentials...');
    const passwordTest = await db.execute(sql`
      SELECT password FROM users 
      WHERE LOWER(email) = LOWER('info@usanotary.net') AND is_active = true;
    `);

    if (passwordTest.rows.length > 0) {
      const passwordMatch = await bcrypt.compare('AcesOverKing#22', passwordTest.rows[0].password);
      if (passwordMatch) {
        console.log('✅ Password verification successful!');
      } else {
        console.log('❌ Password verification failed');
      }
    }

    // Database stats
    console.log('\n📊 Database Summary:');
    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users,
        COUNT(*) FILTER (WHERE role = 'admin') as admin_users
      FROM users;
    `);
    
    if (stats.rows.length > 0) {
      const stat = stats.rows[0];
      console.log(`   👥 Total Users: ${stat.total_users}`);
      console.log(`   ✅ Active Users: ${stat.active_users}`);
      console.log(`   🔧 Admin Users: ${stat.admin_users}`);
    }

    console.log('\n🎉 Admin User Setup Complete!');
    console.log('\n🔑 Your Login Credentials:');
    console.log('   📧 Email: info@usanotary.net');
    console.log('   🔑 Password: AcesOverKing#22');
    console.log('   🏷️  Role: admin');
    
    console.log('\n⚠️  Next Steps:');
    console.log('1. Fix your app\'s DATABASE_URL environment variable');
    console.log('2. Change: tk88ksw4gc44g → 45.32.217.149');
    console.log('3. Restart your Coolify app');
    console.log('4. Test login with your credentials');

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    
    if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Connection Issue - Check:');
      console.log('• Is "Make it publicly available" enabled in Coolify?');
      console.log('• Is the PostgreSQL service running?');
      console.log('• Is port 5432 accessible?');
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

createAdminUserCoolify();
