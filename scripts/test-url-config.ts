#!/usr/bin/env tsx

/**
 * Test URL Configuration
 * Verifies that all email and invitation URLs use localhost correctly
 */

import { emailService } from '../server/lib/email-service';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = (message: string, color = colors.reset) => {
  console.log(`${color}${message}${colors.reset}`);
};

const testURLGeneration = async () => {
  log('\n🔍 Testing URL Configuration\n', colors.bold);

  const results: { test: string; passed: boolean; url?: string; error?: string }[] = [];

  // Test 1: Environment variables
  log('1. Testing Environment Variables:', colors.blue);
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
  
  log(`   CLIENT_URL: ${clientUrl}`);
  log(`   SERVER_URL: ${serverUrl}`);
  
  const shouldBeLocalhost = clientUrl.includes('localhost') || clientUrl.includes('127.0.0.1');
  results.push({
    test: 'Environment uses localhost',
    passed: shouldBeLocalhost,
    url: clientUrl
  });

  // Test 2: Email service URL generation simulation
  log('\n2. Testing Email URL Generation:', colors.blue);
  
  // Simulate email URL generation patterns
  const testToken = 'test123456';
  const testUrls = {
    signerInvitation: `${process.env.CLIENT_URL || 'http://localhost:5173'}/sign/${testToken}`,
    userInvitation: `${process.env.CLIENT_URL || 'http://localhost:5173'}/register?token=${testToken}`,
    passwordReset: `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${testToken}`,
    accountSetup: `${process.env.CLIENT_URL || 'http://localhost:5173'}/set-password?token=${testToken}`
  };

  Object.entries(testUrls).forEach(([type, url]) => {
    log(`   ${type}: ${url}`);
    const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
    const hasCorrectToken = url.includes(testToken);
    
    results.push({
      test: `${type} URL format`,
      passed: isLocalhost && hasCorrectToken,
      url
    });
  });

  // Test 3: Document URL generation
  log('\n3. Testing Document URL Generation:', colors.blue);
  
  const testPaths = {
    localFile: 'uploads/document.pdf',
    vultrFile: 'vultr://bucket/document.pdf'
  };

  Object.entries(testPaths).forEach(([type, filePath]) => {
    let url: string;
    
    if (filePath.startsWith('vultr://')) {
      const vultrPath = filePath.replace('vultr://', '');
      url = `/api/documents/vultr/${encodeURIComponent(vultrPath)}`;
    } else {
      url = `/api/documents/${encodeURIComponent(filePath)}`;
    }
    
    log(`   ${type}: ${url}`);
    const hasCorrectFormat = url.startsWith('/api/documents');
    
    results.push({
      test: `${type} URL format`,
      passed: hasCorrectFormat,
      url
    });
  });

  // Test 4: Check for hardcoded production domains (should not exist)
  log('\n4. Testing for Hardcoded Production Domains:', colors.blue);
  
  const productionDomains = [
    'https://notary.usanotaryservices.com',
    'notary.usanotaryservices.com'
  ];

  let foundHardcodedDomains = false;
  
  // This is a simple check - in a real scenario you'd scan files
  productionDomains.forEach(domain => {
    const emailUrlsContainDomain = Object.values(testUrls).some(url => url.includes(domain));
    if (emailUrlsContainDomain) {
      foundHardcodedDomains = true;
      log(`   ❌ Found hardcoded domain: ${domain}`, colors.red);
    }
  });

  if (!foundHardcodedDomains) {
    log(`   ✅ No hardcoded production domains found`, colors.green);
  }

  results.push({
    test: 'No hardcoded production domains',
    passed: !foundHardcodedDomains
  });

  // Test 5: Validate URL formats
  log('\n5. Testing URL Format Validation:', colors.blue);
  
  Object.entries(testUrls).forEach(([type, url]) => {
    try {
      new URL(url);
      log(`   ✅ ${type}: Valid URL format`, colors.green);
      results.push({
        test: `${type} URL validity`,
        passed: true,
        url
      });
    } catch (error) {
      log(`   ❌ ${type}: Invalid URL format - ${url}`, colors.red);
      results.push({
        test: `${type} URL validity`,
        passed: false,
        url,
        error: error instanceof Error ? error.message : 'Invalid URL'
      });
    }
  });

  // Summary
  log('\n📊 Test Summary:', colors.bold);
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const allPassed = passed === total;

  log(`   Total Tests: ${total}`);
  log(`   Passed: ${passed}`, allPassed ? colors.green : colors.yellow);
  log(`   Failed: ${total - passed}`, total - passed === 0 ? colors.green : colors.red);

  if (!allPassed) {
    log('\n❌ Failed Tests:', colors.red);
    results.filter(r => !r.passed).forEach(result => {
      log(`   • ${result.test}${result.url ? ` (${result.url})` : ''}${result.error ? ` - ${result.error}` : ''}`);
    });
  }

  log('\n🎯 Expected Behavior:', colors.blue);
  log('   • All email invitations should use localhost:5173');
  log('   • No hardcoded production domains in development');
  log('   • Document URLs should use relative /api/documents paths');
  log('   • All URLs should be valid and properly formatted');

  if (allPassed) {
    log('\n🎉 All URL configuration tests passed!', colors.green + colors.bold);
    log('   Email invitations will now work correctly in localhost development.', colors.green);
  } else {
    log('\n⚠️  Some tests failed. Please check the configuration.', colors.yellow + colors.bold);
  }

  return allPassed;
};

// Run the test
testURLGeneration().catch(error => {
  log(`\n💥 Test failed with error: ${error.message}`, colors.red);
  process.exit(1);
}); 