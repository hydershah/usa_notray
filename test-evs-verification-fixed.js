const { createReadStream } = require('fs');
const fetch = require('node-fetch');

async function testEVSVerification() {
  console.log('🧪 Testing EVS Verification System...');
  
  try {
    // Create test image buffers (1x1 pixel images for testing)
    const createTestImage = () => {
      // Minimal JPEG header + data (1x1 white pixel)
      return Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x11, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4,
        0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xDA, 0x00, 0x0C,
        0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3F, 0x00, 0x00, 0xFF, 0xD9
      ]);
    };

    // Pad the test image to meet minimum size requirements (200KB+)
    const baseImage = createTestImage();
    const paddingSize = 220 * 1024; // 220KB to exceed minimum
    const testImage = Buffer.concat([
      baseImage, 
      Buffer.alloc(paddingSize - baseImage.length, 0xFF)
    ]);

    console.log(`📐 Test image size: ${Math.round(testImage.length / 1024)}KB`);

    // Create form data for the request
    const FormData = require('form-data');
    const formData = new FormData();
    
    formData.append('userId', '44'); // Test with user 44
    formData.append('documentType', 'drivers_license');
    formData.append('frontImage', testImage, { filename: 'front.jpg', contentType: 'image/jpeg' });
    formData.append('backImage', testImage, { filename: 'back.jpg', contentType: 'image/jpeg' });
    formData.append('selfieImage', testImage, { filename: 'selfie.jpg', contentType: 'image/jpeg' });

    console.log('🔍 Starting EVS verification request...');
    const startTime = Date.now();

    const response = await fetch('http://localhost:3000/api/verification/evs-verify', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${process.env.TEST_TOKEN}` // You'll need to set this
      }
    });

    const duration = Date.now() - startTime;
    console.log(`⏱️  Request completed in ${duration}ms`);

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ EVS Verification SUCCESS!');
      console.log(`   - Status: ${result.status}`);
      console.log(`   - Confidence: ${result.confidence}%`);
      console.log(`   - Message: ${result.message}`);
      if (result.storedImages) {
        console.log('   - Images stored successfully');
      }
    } else {
      console.log('❌ EVS Verification FAILED');
      console.log(`   - Status: ${response.status}`);
      console.log(`   - Error: ${result.message || result.error}`);
      if (result.reasons) {
        console.log(`   - Reasons: ${result.reasons.join(', ')}`);
      }
    }

    return response.ok;

  } catch (error) {
    console.error('❌ Test Error:', error.message);
    return false;
  }
}

if (require.main === module) {
  testEVSVerification()
    .then(success => {
      if (success) {
        console.log('\n🎉 EVS verification system is working!');
        process.exit(0);
      } else {
        console.log('\n💥 EVS verification system has issues');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testEVSVerification }; 