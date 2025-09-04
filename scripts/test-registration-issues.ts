#!/usr/bin/env npx tsx

/**
 * Test script to verify user registration issues
 * Tests the specific TypeScript errors we identified in routes.ts
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';

config();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'ERROR';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testUserRegistration() {
  console.log('🧪 Testing User Registration Issues...\n');

  // Test 1: Basic Registration
  try {
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      username: `testuser${Date.now()}`,
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'client'
    };

    console.log('📝 Testing basic user registration...');
    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser)
    });

    const responseData = await response.json() as any;
    
    if (response.ok) {
      results.push({
        test: 'Basic Registration',
        status: 'PASS',
        message: 'Registration successful',
        details: { userId: responseData.user?.id }
      });
    } else {
      results.push({
        test: 'Basic Registration',
        status: 'FAIL',
        message: `Registration failed: ${responseData.message}`,
        details: responseData
      });
    }
  } catch (error) {
    results.push({
      test: 'Basic Registration',
      status: 'ERROR',
      message: `Network/Server error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }

  // Test 2: Registration with Edge Cases
  try {
    console.log('🔍 Testing registration with edge cases...');
    const edgeCaseUser = {
      email: `UPPERCASE-${Date.now()}@EXAMPLE.COM`,
      username: '', // Empty username to test fallback
      password: 'EdgeCase123!',
      firstName: 'Edge',
      lastName: 'Case'
    };

    const response = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(edgeCaseUser)
    });

    const responseData = await response.json() as any;
    
    if (response.ok) {
      results.push({
        test: 'Edge Case Registration',
        status: 'PASS',
        message: 'Edge case registration successful',
        details: { 
          normalizedEmail: responseData.user?.email,
          fallbackUsername: responseData.user?.username 
        }
      });
    } else {
      results.push({
        test: 'Edge Case Registration',
        status: 'FAIL',
        message: `Edge case registration failed: ${responseData.message}`,
        details: responseData
      });
    }
  } catch (error) {
    results.push({
      test: 'Edge Case Registration',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }

  // Test 3: Duplicate Registration
  try {
    console.log('🔄 Testing duplicate registration handling...');
    const duplicateUser = {
      email: 'duplicate@example.com',
      username: 'duplicate',
      password: 'Duplicate123!',
      firstName: 'Duplicate',
      lastName: 'User'
    };

    // Try to register twice
    await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicateUser)
    });

    const response2 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duplicateUser)
    });

    const responseData = await response2.json() as any;
    
    if (response2.status === 400 && responseData.message?.includes('exists')) {
      results.push({
        test: 'Duplicate Registration',
        status: 'PASS',
        message: 'Duplicate registration properly rejected',
        details: responseData
      });
    } else {
      results.push({
        test: 'Duplicate Registration',
        status: 'FAIL',
        message: 'Duplicate registration not handled correctly',
        details: responseData
      });
    }
  } catch (error) {
    results.push({
      test: 'Duplicate Registration',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }
}

async function testAuthenticationFlow() {
  console.log('\n🔐 Testing Authentication Flow...');

  try {
    const loginData = {
      email: 'duplicate@example.com',
      password: 'Duplicate123!'
    };

    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData)
    });

    const responseData = await response.json() as any;
    
    if (response.ok && responseData.token) {
      results.push({
        test: 'User Login',
        status: 'PASS',
        message: 'Login successful',
        details: { hasToken: !!responseData.token }
      });
    } else {
      results.push({
        test: 'User Login',
        status: 'FAIL',
        message: `Login failed: ${responseData.message}`,
        details: responseData
      });
    }
  } catch (error) {
    results.push({
      test: 'User Login',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }
}

function printResults() {
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('=' .repeat(50));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`🚨 Errors: ${errors}`);
  console.log(`📋 Total: ${results.length}\n`);
  
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '🚨';
    console.log(`${icon} ${index + 1}. ${result.test}`);
    console.log(`   ${result.message}`);
    if (result.details && Object.keys(result.details).length > 0) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
    console.log('');
  });

  // Exit with error code if any tests failed
  if (failed > 0 || errors > 0) {
    process.exit(1);
  }
}

async function main() {
  console.log('🧪 REGISTRATION & AUTH TESTING SUITE');
  console.log('=' .repeat(50));
  console.log(`Testing against: ${BASE_URL}\n`);

  await testUserRegistration();
  await testAuthenticationFlow();
  
  printResults();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
