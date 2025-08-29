#!/usr/bin/env npx tsx

/**
 * Health Check Script for Deployment
 * Checks if the application is running correctly
 */

import fetch from 'node-fetch';

async function healthCheck() {
  try {
    console.log('🔍 Running health check...');

    const host = process.env.HOST || 'localhost';
    const port = process.env.PORT || 3000;
    const url = `http://${host}:${port}/health`;

    console.log(`📊 Checking: ${url}`);

    const response = await fetch(url, {
      timeout: 5000,
    });

    if (response.ok) {
      const data = await response.text();
      console.log('✅ Health check passed!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${data}`);
      process.exit(0);
    } else {
      console.log('❌ Health check failed!');
      console.log(`   Status: ${response.status}`);
      console.log(`   Response: ${await response.text()}`);
      process.exit(1);
    }

  } catch (error) {
    console.log('❌ Health check failed!');
    console.log(`   Error: ${error.message}`);
    process.exit(1);
  }
}

healthCheck();
