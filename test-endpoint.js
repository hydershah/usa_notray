import fetch from 'node-fetch';

async function testEndpoint() {
  try {
    console.log('Testing database endpoint...');
    
    const response = await fetch('http://localhost:3002/api/job-requests/test-db');
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEndpoint(); 