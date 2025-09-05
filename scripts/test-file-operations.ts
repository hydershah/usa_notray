#!/usr/bin/env npx tsx

/**
 * Test script to verify file operations issues
 * Tests document upload, download, and deletion functionality
 */

import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
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

// Create a test file
function createTestFile(): string {
  const testFilePath = path.join(process.cwd(), 'test-document-temp.pdf');
  const testContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n174\n%%EOF');
  fs.writeFileSync(testFilePath, testContent);
  return testFilePath;
}

async function getAuthToken(): Promise<string | null> {
  try {
    // First register a test user
    const testUser = {
      email: `filetest-${Date.now()}@example.com`,
      password: 'FileTest123!',
      firstName: 'File',
      lastName: 'Tester',
      role: 'client'
    };

    const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });

    if (registerResponse.ok) {
      const data = await registerResponse.json() as any;
      return data.token;
    }

    // Try to login if registration failed (user might exist)
    const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testUser.email, password: testUser.password })
    });

    if (loginResponse.ok) {
      const data = await loginResponse.json() as any;
      return data.token;
    }

    return null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

async function testDocumentUpload(token: string) {
  console.log('📤 Testing document upload...');

  try {
    const testFilePath = createTestFile();
    const formData = new FormData();
    
    formData.append('documents', fs.createReadStream(testFilePath), {
      filename: 'test-document.pdf',
      contentType: 'application/pdf'
    });

    // Test job creation with document upload
    formData.append('titleCompany', 'Test Title Company');
    formData.append('closingType', 'Purchase');
    formData.append('signers', JSON.stringify([{
      name: 'Test Signer',
      email: `signer-${Date.now()}@example.com`,
      role: 'buyer'
    }]));

    const response = await fetch(`${BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    const responseData = await response.json() as any;
    
    // Clean up test file
    fs.unlinkSync(testFilePath);

    if (response.ok) {
      results.push({
        test: 'Document Upload',
        status: 'PASS',
        message: 'Document upload successful',
        details: { jobId: responseData.job?.id, documentCount: responseData.documentCount }
      });
      return responseData.job?.id;
    } else {
      results.push({
        test: 'Document Upload',
        status: 'FAIL',
        message: `Upload failed: ${responseData.message}`,
        details: responseData
      });
      return null;
    }
  } catch (error) {
    results.push({
      test: 'Document Upload',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
    return null;
  }
}

async function testDocumentRetrieval(token: string, jobId: number) {
  console.log('📥 Testing document retrieval...');

  try {
    const response = await fetch(`${BASE_URL}/api/jobs/${jobId}/documents`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const responseData = await response.json() as any;
    
    if (response.ok && Array.isArray(responseData.documents)) {
      results.push({
        test: 'Document Retrieval',
        status: 'PASS',
        message: 'Document retrieval successful',
        details: { documentCount: responseData.documents.length }
      });
      return responseData.documents[0]?.id;
    } else {
      results.push({
        test: 'Document Retrieval',
        status: 'FAIL',
        message: `Retrieval failed: ${responseData.message}`,
        details: responseData
      });
      return null;
    }
  } catch (error) {
    results.push({
      test: 'Document Retrieval',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
    return null;
  }
}

async function testDocumentPreview(token: string, jobId: number, documentId: number) {
  console.log('👀 Testing document preview...');

  try {
    const response = await fetch(`${BASE_URL}/api/jobs/${jobId}/documents/${documentId}/preview`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      // Check if we get a redirect or direct content
      const contentType = response.headers.get('content-type');
      const cacheStatus = response.headers.get('x-cache');
      
      results.push({
        test: 'Document Preview',
        status: 'PASS',
        message: 'Document preview accessible',
        details: { 
          contentType,
          cacheStatus,
          status: response.status,
          redirected: response.redirected
        }
      });
    } else {
      const responseData = await response.text();
      results.push({
        test: 'Document Preview',
        status: 'FAIL',
        message: `Preview failed: ${response.status} ${response.statusText}`,
        details: { responseBody: responseData }
      });
    }
  } catch (error) {
    results.push({
      test: 'Document Preview',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }
}

async function testDocumentDeletion(token: string, jobId: number, documentId: number) {
  console.log('🗑️ Testing document deletion...');

  try {
    const response = await fetch(`${BASE_URL}/api/jobs/${jobId}/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const responseData = await response.json() as any;
    
    if (response.ok) {
      results.push({
        test: 'Document Deletion',
        status: 'PASS',
        message: 'Document deletion successful',
        details: responseData
      });
    } else {
      results.push({
        test: 'Document Deletion',
        status: 'FAIL',
        message: `Deletion failed: ${responseData.message}`,
        details: responseData
      });
    }
  } catch (error) {
    results.push({
      test: 'Document Deletion',
      status: 'ERROR',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: error
    });
  }
}

function printResults() {
  console.log('\n📊 FILE OPERATIONS TEST RESULTS');
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

  if (failed > 0 || errors > 0) {
    process.exit(1);
  }
}

async function main() {
  console.log('🧪 FILE OPERATIONS TESTING SUITE');
  console.log('=' .repeat(50));
  console.log(`Testing against: ${BASE_URL}\n`);

  const token = await getAuthToken();
  if (!token) {
    console.error('❌ Failed to get authentication token');
    process.exit(1);
  }

  console.log('✅ Authentication successful\n');

  const jobId = await testDocumentUpload(token);
  if (jobId) {
    const documentId = await testDocumentRetrieval(token, jobId);
    if (documentId) {
      await testDocumentPreview(token, jobId, documentId);
      await testDocumentDeletion(token, jobId, documentId);
    }
  }
  
  printResults();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
