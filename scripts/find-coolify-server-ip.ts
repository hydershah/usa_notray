#!/usr/bin/env npx tsx

/**
 * Help identify Coolify server IP for external database connection
 */

async function findCoolifyServerIP() {
  console.log('🔍 Finding Your Coolify Server IP\n');

  console.log('📍 Methods to Find Your Server IP:');
  
  console.log('\n1. 🌐 From Browser URL:');
  console.log('   • Look at your Coolify dashboard URL');
  console.log('   • Should be: http://YOUR_IP:8000/ or https://YOUR_IP:8000/');
  console.log('   • The IP in the URL is your server IP');

  console.log('\n2. 📧 From VPS Provider:');
  console.log('   • Check your VPS dashboard (DigitalOcean, Linode, etc.)');
  console.log('   • Look for "Public IP" or "External IP"');
  console.log('   • Usually shown prominently on server details');

  console.log('\n3. 🔧 From Coolify Settings:');
  console.log('   • Go to Coolify dashboard');
  console.log('   • Check "Servers" section');
  console.log('   • Your server should show its IP address');

  console.log('\n4. 💻 From Terminal (if you have SSH access):');
  console.log('   • SSH to your server');
  console.log('   • Run: curl ifconfig.me');
  console.log('   • This shows your public IP');

  console.log('\n📝 Once You Have the IP:');
  console.log('Your connection string will be:');
  console.log('postgres://postgres:h1Vk5DUJxhjTSKkddqfGGvTaBbIXOgPxddNHBNuwCtYrZEiQtElfnFewz4ZbGx9O@[YOUR_IP]:3000/postgres');

  console.log('\n🔧 If External Access Still Not Working:');
  console.log('1. In Coolify PostgreSQL service:');
  console.log('   • Go to "Environment Variables"');
  console.log('   • Add: POSTGRES_HOST_AUTH_METHOD=trust');
  console.log('   • Or: POSTGRES_HOST_AUTH_METHOD=md5');

  console.log('\n2. Check Port Mapping:');
  console.log('   • Ensure PostgreSQL container shows: 0.0.0.0:3000->5432/tcp');
  console.log('   • Not: 127.0.0.1:3000->5432/tcp');

  console.log('\n3. Enable External Access:');
  console.log('   • Look for "External Access" toggle in PostgreSQL service');
  console.log('   • Or "Public Access" checkbox');
  console.log('   • Enable it and restart the service');

  console.log('\n📞 Quick Test Method:');
  console.log('Once you think external access is working:');
  console.log('telnet YOUR_SERVER_IP 3000');
  console.log('(Should connect if PostgreSQL is accessible)');

  console.log('\n🚨 Common Issues:');
  console.log('• Firewall blocking port 3000');
  console.log('• PostgreSQL bound to localhost only');
  console.log('• External access not enabled in Coolify');
  console.log('• VPS provider firewall rules');

  process.exit(0);
}

findCoolifyServerIP();
