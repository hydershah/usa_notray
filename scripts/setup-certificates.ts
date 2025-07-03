#!/usr/bin/env ts-node

import { certificateService } from '../server/certificate-service';
import { storage } from '../server/storage';

/**
 * Setup script for Certificate Authority and Certificate Management System
 * This script initializes the CA and prepares the system for certificate generation
 */

async function setupCertificates() {
  console.log('🔧 Setting up Certificate Authority and Certificate Management System...\n');

  try {
    // Step 1: Initialize database connection
    console.log('📊 Initializing database connection...');
    // Database should already be initialized by the main application

    // Step 2: Initialize Certificate Service (this will create CA and database tables)
    console.log('🏗️  Initializing Certificate Service...');
    await certificateService.initialize();

    // Step 3: Verify CA certificate was created
    console.log('✅ Verifying Certificate Authority setup...');
    const fs = require('fs');
    const path = require('path');
    
    const caKeyPath = path.join('./certs', 'ca-key.pem');
    const caCertPath = path.join('./certs', 'ca-cert.pem');
    
    if (fs.existsSync(caKeyPath) && fs.existsSync(caCertPath)) {
      console.log('✅ Certificate Authority files verified:');
      console.log(`   - CA Private Key: ${caKeyPath}`);
      console.log(`   - CA Certificate: ${caCertPath}`);
    } else {
      throw new Error('Certificate Authority files not found after initialization');
    }

    // Step 4: Test certificate generation (optional)
    console.log('\n🧪 Testing certificate generation system...');
    
    // Get the first approved notary user for testing
    const testUser = await storage.executeQuery(`
      SELECT id, full_name, email, user_type, approval_status 
      FROM users 
      WHERE user_type = 'notary' AND approval_status = 'approved' 
      LIMIT 1
    `);

    if (testUser.length > 0) {
      const user = testUser[0];
      console.log(`   - Found test user: ${user.full_name} (${user.email})`);
      
      // Check if user already has a certificate
      const existingCert = await storage.executeQuery(
        'SELECT id FROM certificates WHERE user_id = $1 AND status = $2',
        [user.id, 'active']
      );

      if (existingCert.length === 0) {
        console.log('   - Generating test certificate...');
        const result = await certificateService.generateNotaryCertificate(user.id);
        
        if (result.success) {
          console.log('✅ Test certificate generated successfully!');
          console.log(`   - Certificate ID: ${result.certificateId}`);
          console.log(`   - P12 Password: ${result.p12Password}`);
        } else {
          console.log(`⚠️  Test certificate generation failed: ${result.error}`);
        }
      } else {
        console.log('   - User already has an active certificate, skipping test generation');
      }
    } else {
      console.log('   - No approved notary users found for testing, skipping test generation');
    }

    // Step 5: Get certificate statistics
    console.log('\n📊 Certificate System Statistics:');
    const stats = await certificateService.getCertificateStats();
    console.log(`   - Total Certificates: ${stats.total}`);
    console.log(`   - Active Certificates: ${stats.active}`);
    console.log(`   - Expired Certificates: ${stats.expired}`);
    console.log(`   - Revoked Certificates: ${stats.revoked}`);
    console.log(`   - Near Expiry: ${stats.nearExpiry}`);

    // Step 6: Setup complete
    console.log('\n🎉 Certificate Authority setup completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Start your application server');
    console.log('   2. Approved notaries can generate certificates via the UI');
    console.log('   3. Administrators can manage certificates via the admin panel');
    console.log('   4. Set up automated certificate expiry checking (optional)');

    console.log('\n🔗 Available API Endpoints:');
    console.log('   - POST /api/certificates/generate-self (for notaries)');
    console.log('   - GET  /api/certificates/status (check certificate status)');
    console.log('   - GET  /api/certificates/download/:userId (download certificate)');
    console.log('   - POST /api/certificates/generate/:userId (admin only)');
    console.log('   - GET  /api/certificates/stats (admin only)');

    console.log('\n📁 Certificate Files Location: ./certs/');
    console.log('   ⚠️  Keep the CA private key (ca-key.pem) secure and backed up!');

  } catch (error) {
    console.error('\n❌ Certificate setup failed:', error);
    console.error('\nTroubleshooting:');
    console.error('   1. Ensure OpenSSL is installed and accessible');
    console.error('   2. Check database connection and permissions');
    console.error('   3. Verify write permissions for ./certs/ directory');
    console.error('   4. Check application logs for detailed error messages');
    
    process.exit(1);
  }
}

// Function to check OpenSSL availability
async function checkOpenSSL() {
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    console.log('🔍 Checking OpenSSL availability...');
    const { stdout } = await execAsync('openssl version');
    console.log(`✅ OpenSSL found: ${stdout.trim()}`);
    return true;
  } catch (error) {
    console.error('❌ OpenSSL not found or not accessible');
    console.error('   Please install OpenSSL:');
    console.error('   - macOS: brew install openssl');
    console.error('   - Ubuntu/Debian: sudo apt-get install openssl');
    console.error('   - Windows: Download from https://slproweb.com/products/Win32OpenSSL.html');
    return false;
  }
}

// Function to create certs directory if it doesn't exist
async function ensureCertsDirectory() {
  const fs = require('fs');
  const path = require('path');
  
  const certsDir = path.join(process.cwd(), 'certs');
  
  if (!fs.existsSync(certsDir)) {
    console.log('📁 Creating certificates directory...');
    fs.mkdirSync(certsDir, { recursive: true });
    console.log(`✅ Created directory: ${certsDir}`);
  } else {
    console.log(`✅ Certificates directory exists: ${certsDir}`);
  }
}

// Main execution
async function main() {
  console.log('🚀 USA Notary Platform - Certificate Authority Setup\n');

  // Pre-flight checks
  const hasOpenSSL = await checkOpenSSL();
  if (!hasOpenSSL) {
    process.exit(1);
  }

  await ensureCertsDirectory();

  // Run setup
  await setupCertificates();
}

// Run the setup if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

export { setupCertificates, checkOpenSSL, ensureCertsDirectory }; 