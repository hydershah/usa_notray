#!/usr/bin/env node

/**
 * Setup Vultr Environment Variables
 * This script adds Vultr configuration to the .env file
 */

import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');

// Vultr configuration
const vultrConfig = `
# Vultr Object Storage Configuration
VULTR_ACCESS_KEY=GE8MIGK9HAH7L26SPN51
VULTR_SECRET_KEY=F4kBLWvvM6CSL3nDtdp7ROdynGmc5A1Fxy1IH20e
VULTR_REGION=ewr1
VULTR_BUCKET_NAME=usanotary
VULTR_ENDPOINT=https://ewr1.vultrobjects.com
VULTR_HOST_BASE=ewr1.vultrobjects.com
VULTR_HOST_BUCKET=%(bucket)s.ewr1.vultrobjects.com
`;

async function setupVultrEnv() {
  console.log('🔧 Setting up Vultr environment variables...');
  
  try {
    let envContent = '';
    
    // Read existing .env file if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      console.log('📁 Found existing .env file');
      
      // Check if Vultr config already exists
      if (envContent.includes('VULTR_ACCESS_KEY')) {
        console.log('⚠️ Vultr configuration already exists in .env file');
        console.log('📝 Skipping Vultr configuration setup');
        return;
      }
    } else {
      console.log('📁 Creating new .env file');
    }
    
    // Add Vultr configuration
    const newEnvContent = envContent + vultrConfig;
    
    // Write to .env file
    fs.writeFileSync(envPath, newEnvContent);
    
    console.log('✅ Vultr environment variables added to .env file');
    console.log('📝 Please restart your development server to apply the changes');
    
  } catch (error) {
    console.error('❌ Failed to setup Vultr environment:', error.message);
    console.log('📝 Please manually add the following to your .env file:');
    console.log(vultrConfig);
  }
}

setupVultrEnv(); 