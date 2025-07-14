const fetch = require('node-fetch');

async function testEVSKBAResponse() {
  console.log('🧠 Testing EVS AssureID KBA Response Structure...\n');

  const endpoint = 'https://blueassure.evssolutions.com/WebServices/Integrated/Main/V300/AssureId';
  
  const blueAssureRequest = {
    meta: {
      credentials: {
        username: process.env.EVS_API_KEY || 'E27235-CE567A22-0D31-474A-B551-252882763208',
        password: process.env.EVS_PASSWORD || '8aeWPi0XV#AyS#I'
      },
      customerReference: `KBA_TEST_${Date.now()}`
    },
    data: {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123456789',
      dateOfBirth: '1985-05-15',
      street: '123 Main Street',
      city: 'Louisville',
      state: 'KY',
      zipCode: '40202',
      phoneNumber: '5025551234',
      emailAddress: 'john.doe@example.com'
    }
  };

  try {
    console.log('📡 Making request to:', endpoint);
    console.log('📋 Request payload:', JSON.stringify(blueAssureRequest, null, 2));
    console.log('\n');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Host': 'blueassure.evssolutions.com:443',
        'User-Agent': 'NotaryPlatform-KBA-Test/1.0.0'
      },
      body: JSON.stringify(blueAssureRequest)
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', response.headers.raw());
    console.log('\n');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return;
    }

    const result = await response.json();
    
    console.log('✅ SUCCESS! Full EVS AssureID Response:');
    console.log('================================================');
    console.log(JSON.stringify(result, null, 2));
    console.log('================================================\n');

    // Extract and analyze KBA questions specifically
    if (result.data && result.data.kbaQuestions) {
      console.log('🧠 KBA QUESTIONS STRUCTURE ANALYSIS:');
      console.log('=====================================');
      console.log('KBA Questions Object:', JSON.stringify(result.data.kbaQuestions, null, 2));
      
      if (result.data.kbaQuestions.questions && Array.isArray(result.data.kbaQuestions.questions)) {
        console.log(`\n📊 Found ${result.data.kbaQuestions.questions.length} KBA questions:`);
        
        result.data.kbaQuestions.questions.forEach((question, index) => {
          console.log(`\n--- Question ${index + 1} ---`);
          console.log('Structure:', JSON.stringify(question, null, 2));
          console.log('Question Text:', question.questionText || question.text || 'No text found');
          console.log('Answer Options:', question.answerOptions || question.answers || 'No answers found');
          console.log('Question Type:', question.questionType || question.type || 'Type not specified');
        });
      } else {
        console.log('❌ No questions array found in kbaQuestions object');
      }
    } else {
      console.log('❌ No kbaQuestions found in response data');
      console.log('Available data keys:', Object.keys(result.data || {}));
    }

    // Extract other important data for context
    if (result.data && result.data.assureId) {
      console.log('\n📋 ASSURE ID VERIFICATION RESULTS:');
      console.log('===================================');
      console.log('Address Verification:', result.data.assureId.addressVerificationResult);
      console.log('SSN Verification:', result.data.assureId.socialSecurityNumberResult);
      console.log('Email Verification:', result.data.assureId.emailVerificationResult);
      console.log('Fraud Check:', result.data.assureId.reportedFraudResult);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testEVSKBAResponse().then(() => {
  console.log('\n🎯 Test completed!');
}).catch(error => {
  console.error('💥 Test execution failed:', error);
}); 