#!/usr/bin/env npx tsx

/**
 * Test Coolify PostgreSQL Connection (Hardcoded)
 * Tests connection without modifying .env file
 */

import { Pool } from 'pg';

async function testCoolifyConnection() {
  try {
    console.log('🔍 Testing Coolify PostgreSQL Connection (Hardcoded)\n');

    // Hardcoded Coolify connection string
    const coolifyUrl = "postgres://postgres:h1Vk5DUJxhjTSKkddqfGGvTaBbIXOgPxddNHBNuwCtYrZEiQtElfnFewz4ZbGx9O@45.32.217.149:5432/postgres";
    
    console.log('🔗 Testing connection to: 45.32.217.149:5432');
    console.log('📊 Database: postgres');
    console.log('👤 Username: postgres');
    
    // Create pool for testing
    const pool = new Pool({
      connectionString: coolifyUrl,
      ssl: false, // Try without SSL first
      max: 1,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 10000,
    });

    console.log('\n⏱️  Attempting connection...');
    const start = Date.now();
    
    try {
      // Test basic connection
      const client = await pool.connect();
      const duration = Date.now() - start;
      
      console.log(`✅ Connection successful! (${duration}ms)`);
      
      // Test basic query
      const queryStart = Date.now();
      const result = await client.query('SELECT NOW() as current_time, version() as db_version;');
      const queryDuration = Date.now() - queryStart;
      
      console.log(`✅ Query successful! (${queryDuration}ms)`);
      console.log(`📅 Server time: ${result.rows[0].current_time}`);
      console.log(`🐘 PostgreSQL version: ${result.rows[0].db_version.split(' ')[0]}`);
      
      // Test database info
      const dbInfo = await client.query(`
        SELECT 
          current_database() as database_name,
          current_user as current_user,
          inet_server_addr() as server_ip,
          inet_server_port() as server_port;
      `);
      
      console.log('\n📊 Database Information:');
      console.log(`   Database: ${dbInfo.rows[0].database_name}`);
      console.log(`   User: ${dbInfo.rows[0].current_user}`);
      console.log(`   Server IP: ${dbInfo.rows[0].server_ip || 'Not available'}`);
      console.log(`   Server Port: ${dbInfo.rows[0].server_port}`);
      
      client.release();
      await pool.end();
      
      console.log('\n🎉 Coolify PostgreSQL Connection Test PASSED!');
      console.log('\n📋 Performance Summary:');
      console.log(`   Connection time: ${duration}ms`);
      console.log(`   Query time: ${queryDuration}ms`);
      console.log(`   Total time: ${duration + queryDuration}ms`);
      
      if (duration < 50) {
        console.log('🟢 Excellent connection speed!');
      } else if (duration < 100) {
        console.log('🟡 Good connection speed');
      } else {
        console.log('🟠 Acceptable connection speed');
      }
      
    } catch (connectionError) {
      const duration = Date.now() - start;
      console.log(`❌ Connection failed after ${duration}ms`);
      console.log(`Error: ${connectionError.message}`);
      
      console.log('\n🔧 Troubleshooting:');
      if (connectionError.message.includes('ENOTFOUND')) {
        console.log('• DNS resolution failed - check server IP');
      } else if (connectionError.message.includes('ECONNREFUSED')) {
        console.log('• Connection refused - PostgreSQL not accessible externally');
        console.log('• Make sure "Make it publicly available" is enabled in Coolify');
      } else if (connectionError.message.includes('timeout')) {
        console.log('• Connection timeout - firewall might be blocking port 5432');
      } else if (connectionError.message.includes('authentication')) {
        console.log('• Authentication failed - check password');
      } else {
        console.log(`• Unknown error: ${connectionError.message}`);
      }
      
      console.log('\n📋 Next Steps:');
      console.log('1. Enable "Make it publicly available" in Coolify');
      console.log('2. Check firewall allows port 5432');
      console.log('3. Restart PostgreSQL service in Coolify');
      console.log('4. Verify server IP: 45.32.217.149');
    }

  } catch (error) {
    console.error('❌ Test setup error:', error);
  }
}

testCoolifyConnection();
