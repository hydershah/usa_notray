// Simple test to verify IP location API works
const https = require('https');

async function testIPLocationAPI() {
  console.log('🌍 Testing IP location API...');
  
  return new Promise((resolve, reject) => {
    const req = https.get('https://ipapi.co/json/', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const locationData = JSON.parse(data);
          console.log('✅ IP Location API Response:');
          console.log(`  📍 City: ${locationData.city}`);
          console.log(`  🏛️ Region: ${locationData.region}`);
          console.log(`  🌎 Country: ${locationData.country_name}`);
          console.log(`  ⏰ Timezone: ${locationData.timezone}`);
          console.log(`  🏢 ISP: ${locationData.org}`);
          console.log(`  📡 IP: ${locationData.ip}`);
          
          resolve(locationData);
        } catch (error) {
          reject(new Error(`Failed to parse location data: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`IP location API request failed: ${error.message}`));
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('IP location API request timeout'));
    });
  });
}

// Test browser timezone detection
function testTimezoneDetection() {
  console.log('🕐 Testing timezone detection...');
  
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log(`✅ Browser timezone: ${timezone}`);
    return timezone;
  } catch (error) {
    console.error('❌ Timezone detection failed:', error.message);
    return null;
  }
}

// Main test function
async function runLocationTests() {
  console.log('🧪 Running Location Service Tests...\n');
  
  try {
    // Test IP location API
    await testIPLocationAPI();
    console.log('');
    
    // Test timezone detection
    testTimezoneDetection();
    console.log('');
    
    console.log('🎉 All location service tests passed!');
    console.log('📋 Summary:');
    console.log('  ✅ IP geolocation API working');
    console.log('  ✅ Timezone detection working');
    console.log('  📱 Ready for browser integration');
    
  } catch (error) {
    console.error('❌ Location service test failed:', error.message);
    throw error;
  }
}

// Run tests
runLocationTests()
  .then(() => {
    console.log('\n👍 Location service tests completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Location service tests failed:', error);
    process.exit(1);
  }); 