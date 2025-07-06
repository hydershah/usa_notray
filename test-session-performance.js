#!/usr/bin/env node

const fetch = require('node-fetch');

async function testSessionPerformance() {
  console.log('🧪 Testing session endpoint performance...\n');
  
  const sessionId = '24'; // Using the same session ID from the logs
  const baseUrl = 'http://localhost:3000';
  
  // You'll need to replace this with a valid JWT token
  const token = 'your-jwt-token-here'; // Replace with actual token
  
  const testEndpoints = [
    '/api/session/24/state',
    '/api/jobs/24',
    '/api/editor/session/H2nO17C18LPM',
    '/api/editor/session/H2nO17C18LPM/tags'
  ];
  
  for (const endpoint of testEndpoints) {
    console.log(`Testing ${endpoint}...`);
    
    try {
      // Test without cache (first call)
      const start1 = Date.now();
      const response1 = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const duration1 = Date.now() - start1;
      const cacheStatus1 = response1.headers.get('X-Cache') || 'UNKNOWN';
      
      console.log(`  First call: ${duration1}ms (${cacheStatus1})`);
      
      // Test with cache (second call)
      const start2 = Date.now();
      const response2 = await fetch(`${baseUrl}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const duration2 = Date.now() - start2;
      const cacheStatus2 = response2.headers.get('X-Cache') || 'UNKNOWN';
      
      console.log(`  Second call: ${duration2}ms (${cacheStatus2})`);
      
      if (cacheStatus2 === 'HIT') {
        const improvement = ((duration1 - duration2) / duration1 * 100).toFixed(1);
        console.log(`  ✅ Cache improvement: ${improvement}%`);
      } else {
        console.log(`  ⚠️ Cache not working properly`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error testing ${endpoint}:`, error.message);
    }
    
    console.log('');
  }
  
  console.log('🎉 Performance test completed!');
}

// Only run test if server is available
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  const serverAvailable = await checkServer();
  
  if (!serverAvailable) {
    console.log('❌ Server is not available at http://localhost:3000');
    console.log('Please start the server with: npm run dev');
    process.exit(1);
  }
  
  await testSessionPerformance();
}

main().catch(console.error); 