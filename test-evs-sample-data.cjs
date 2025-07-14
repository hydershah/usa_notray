const fetch = require('node-fetch');

async function testEVSSampleData() {
  console.log('🧠 Testing EVS with Sample Data for KBA Questions...\n');

  // EVS typically has these test SSNs that return data
  const testCases = [
    {
      name: "Test Person 1",
      firstName: "JOHN",
      lastName: "DOE",
      ssn: "123456789",
      dateOfBirth: "1980-01-01",
      street: "123 MAIN ST",
      city: "ANYTOWN",
      state: "CA",
      zipCode: "90210"
    },
    {
      name: "Test Person 2",
      firstName: "JANE",
      lastName: "SMITH",
      ssn: "987654321",
      dateOfBirth: "1975-05-15",
      street: "456 ELM ST",
      city: "SOMEWHERE",
      state: "TX",
      zipCode: "75201"
    },
    {
      name: "Test Person 3 (Louisville)",
      firstName: "MICHAEL",
      lastName: "JOHNSON", 
      ssn: "111223333",
      dateOfBirth: "1985-12-10",
      street: "789 OAK AVE",
      city: "LOUISVILLE",
      state: "KY",
      zipCode: "40202"
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    console.log('=' .repeat(50));
    
    try {
      const endpoint = 'https://blueassure.evssolutions.com/WebServices/Integrated/Main/V300/AssureId';
      
      const assureIdRequest = {
        meta: {
          credentials: {
            username: process.env.EVS_API_KEY || 'E27235-CE567A22-0D31-474A-B551-252882763208',
            password: process.env.EVS_PASSWORD || '8aeWPi0XV#AyS#I'
          },
          customerReference: `TEST_${testCase.name.replace(/\s+/g, '_')}_${Date.now()}`
        },
        data: {
          firstName: testCase.firstName,
          lastName: testCase.lastName,
          ssn: testCase.ssn,
          dateOfBirth: testCase.dateOfBirth,
          street: testCase.street,
          city: testCase.city,
          state: testCase.state,
          zipCode: testCase.zipCode,
          phoneNumber: "5551234567",
          emailAddress: `${testCase.firstName.toLowerCase()}@example.com`
        }
      };

      console.log('📡 Request data:', {
        name: `${testCase.firstName} ${testCase.lastName}`,
        ssn: testCase.ssn,
        address: `${testCase.street}, ${testCase.city}, ${testCase.state} ${testCase.zipCode}`
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Host': 'blueassure.evssolutions.com:443',
          'User-Agent': 'NotaryPlatform-Sample-KBA-Test/1.0.0'
        },
        body: JSON.stringify(assureIdRequest)
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error:', errorText);
        continue;
      }

      const result = await response.json();
      
      // Show verification results
      if (result.data && result.data.assureId) {
        const assureId = result.data.assureId;
        console.log('\n📋 Verification Results:');
        console.log(`  Address: ${assureId.addressVerificationResult?.code} - ${assureId.addressVerificationResult?.description}`);
        console.log(`  SSN: ${assureId.socialSecurityNumberResult?.code} - ${assureId.socialSecurityNumberResult?.description}`);
        console.log(`  DOB: ${assureId.dateOfBirthResult?.code} - ${assureId.dateOfBirthResult?.description}`);
        console.log(`  Phone: ${assureId.phoneVerificationResult?.code} - ${assureId.phoneVerificationResult?.description}`);
      }

      // Check for KBA questions
      if (result.data && result.data.kbaQuestions) {
        const questions = result.data.kbaQuestions.questions;
        console.log(`\n🧠 KBA Questions: ${questions.length} found`);
        
        if (questions.length > 0) {
          console.log('\n🎉 SUCCESS! Found KBA Questions:');
          console.log('=' .repeat(60));
          
          questions.forEach((question, index) => {
            console.log(`\n--- Question ${index + 1} ---`);
            console.log('Full Structure:', JSON.stringify(question, null, 2));
          });
          
          // Save successful result
          require('fs').writeFileSync(`successful-kba-${testCase.name.replace(/\s+/g, '-')}.json`, 
            JSON.stringify({
              testData: testCase,
              kbaQuestions: result.data.kbaQuestions,
              fullResponse: result
            }, null, 2)
          );
          
          console.log(`\n💾 Saved to: successful-kba-${testCase.name.replace(/\s+/g, '-')}.json`);
          
          // We found questions, no need to test more cases
          return result;
        } else {
          console.log('❌ No KBA questions returned');
        }
      } else {
        console.log('❌ No kbaQuestions object in response');
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Test failed for ${testCase.name}:`, error.message);
    }
  }

  console.log('\n🎯 All test cases completed. No KBA questions were returned.');
  console.log('💡 This might be because:');
  console.log('   - Workflows are disabled (as shown in responses)');
  console.log('   - Test data doesn\'t match EVS database records');
  console.log('   - KBA service needs to be enabled separately');
  console.log('\n📞 Contact EVS Support: 866-491-5665');
  console.log('📧 Account: E27235-CE567A22-0D31-474A-B551-252882763208');
}

// Run the test
testEVSSampleData().then(() => {
  console.log('\n🏁 Sample data test completed!');
}).catch(error => {
  console.error('💥 Test execution failed:', error);
}); 