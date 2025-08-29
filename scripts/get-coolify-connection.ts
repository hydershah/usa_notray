#!/usr/bin/env npx tsx

/**
 * Get Coolify Database Connection Details
 * Help find the correct external connection string
 */

async function getCoolifyConnection() {
  try {
    console.log('🔍 Getting Coolify PostgreSQL Connection Details\n');

    console.log('📋 Based on your Coolify screenshot, you have:');
    console.log('• Database ID: postgresql-database-tk88ksw4gc44g');
    console.log('• Image: postgres:17-alpine');
    console.log('• Internal hostname: tk88ksw4gc44g');
    console.log('• Port mapping: 3000:5432');

    console.log('\n❌ Current Issue:');
    console.log('The internal hostname "tk88ksw4gc44g" only works within Coolify network.');
    console.log('You need the EXTERNAL connection details to connect from your local machine.');

    console.log('\n🔧 How to Get External Connection:');
    console.log('1. In Coolify dashboard, go to your PostgreSQL service');
    console.log('2. Look for "Environment Variables" or "Secrets" tab');
    console.log('3. Find the external/public database URL');
    console.log('4. Or check the "Network" section for external port mapping');

    console.log('\n🌐 What to Look For:');
    console.log('External connection should look like one of these formats:');
    console.log('• postgres://postgres:PASSWORD@YOUR_SERVER_IP:PORT/postgres');
    console.log('• postgres://postgres:PASSWORD@your-domain.com:PORT/postgres');
    console.log('• postgres://postgres:PASSWORD@coolify-server.example.com:5432/postgres');

    console.log('\n🔍 Alternative Ways to Find Connection:');
    console.log('1. Check Coolify server IP + mapped port');
    console.log('2. Look for "Public URL" or "External Access" in database settings');
    console.log('3. Check if Coolify exposed PostgreSQL on a public port');
    console.log('4. Look in your Coolify project environment variables');

    console.log('\n📝 Expected Connection Format:');
    console.log('postgres://postgres:h1Vk5DUJxhjTSKkddqfGGvTaBbIXOgPxddNHBNuwCtYrZEiQtElfnFewz4ZbGx9O@[EXTERNAL_IP_OR_DOMAIN]:[EXTERNAL_PORT]/postgres');

    console.log('\n🔧 Quick Test Methods:');
    console.log('Once you get the external connection string:');
    console.log('1. Update DATABASE_URL in .env');
    console.log('2. Run: npx tsx scripts/check-current-db.ts');
    console.log('3. Should see "Database connected successfully"');

    console.log('\n💡 Common Coolify Patterns:');
    console.log('• If Coolify server IP is 45.32.217.149, try:');
    console.log('  postgres://postgres:PASSWORD@45.32.217.149:3000/postgres');
    console.log('• If you have a domain, try:');
    console.log('  postgres://postgres:PASSWORD@your-domain.com:3000/postgres');

    console.log('\n⚠️  Security Note:');
    console.log('Make sure PostgreSQL port is accessible from your location.');
    console.log('Coolify might need firewall configuration to allow external connections.');

    console.log('\n🎯 Next Steps:');
    console.log('1. Find the external IP/domain of your Coolify server');
    console.log('2. Update .env with: postgres://postgres:PASSWORD@EXTERNAL_IP:3000/postgres');
    console.log('3. Test connection again');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

getCoolifyConnection();
