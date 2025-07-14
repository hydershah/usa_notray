const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function testRealKBAResponse() {
  console.log('🧠 Testing Real KBA Response with Actual Driver License Data...\n');

  try {
    // Step 1: Read the real images
    console.log('📁 Reading real driver license images...');
    const frontImagePath = path.join(__dirname, 'real data', 'Ray DL.jpg');
    const backImagePath = path.join(__dirname, 'real data', 'ray DL Back.jpg');
    const selfieImagePath = path.join(__dirname, 'real data', 'WhatsApp Image 2025-07-05 at 7.11.21 PM.jpeg');

    const frontImageBuffer = fs.readFileSync(frontImagePath);
    const backImageBuffer = fs.readFileSync(backImagePath);
    const selfieImageBuffer = fs.readFileSync(selfieImagePath);

    console.log(`✅ Loaded images:
    - Front: ${frontImageBuffer.length} bytes
    - Back: ${backImageBuffer.length} bytes  
    - Selfie: ${selfieImageBuffer.length} bytes\n`);

    // Step 2: First call AssureCard to extract data from the driver's license
    console.log('🆔 Step 1: Calling AssureCard to extract DL data...');
    const assureCardEndpoint = 'https://blueassure.evssolutions.com/WebServices/Integrated/Main/V300/AssureCard';
    
    const assureCardRequest = {
      meta: {
        credentials: {
          username: process.env.EVS_API_KEY || 'E27235-CE567A22-0D31-474A-B551-252882763208',
          password: process.env.EVS_PASSWORD || '8aeWPi0XV#AyS#I'
        },
        customerReference: `REAL_DL_TEST_${Date.now()}`
      },
      data: {
        documentType: 'DriversLicense',
        directImageUpload: {
          frontImage: frontImageBuffer.toString('base64'),
          backImage: backImageBuffer.toString('base64'),
          selfieImage: selfieImageBuffer.toString('base64')
        }
      }
    };

    const assureCardResponse = await fetch(assureCardEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Host': 'blueassure.evssolutions.com:443',
        'User-Agent': 'NotaryPlatform-Real-KBA-Test/1.0.0'
      },
      body: JSON.stringify(assureCardRequest)
    });

    console.log('📥 AssureCard Response status:', assureCardResponse.status);

    if (!assureCardResponse.ok) {
      const errorText = await assureCardResponse.text();
      console.error('❌ AssureCard Error:', errorText);
      return;
    }

    const assureCardResult = await assureCardResponse.json();
    
    console.log('✅ AssureCard Response:');
    console.log('================================================');
    console.log(JSON.stringify(assureCardResult, null, 2));
    console.log('================================================\n');

    // Step 3: Extract person data from AssureCard response
    let extractedData = null;
    if (assureCardResult.data && assureCardResult.data.assureCard) {
      const card = assureCardResult.data.assureCard;
      extractedData = {
        firstName: card.firstName || card.givenName || '',
        lastName: card.lastName || card.surname || '',
        dateOfBirth: card.dateOfBirth || card.birthDate || '',
        street: card.address || card.street || '',
        city: card.city || '',
        state: card.state || card.stateProvince || '',
        zipCode: card.zipCode || card.postalCode || '',
        ssn: card.ssn || null, // May not be on DL
        phoneNumber: null, // Not on DL
        emailAddress: null // Not on DL
      };
    }

    if (!extractedData || !extractedData.firstName) {
      console.log('⚠️ Could not extract person data from AssureCard response');
      console.log('Available AssureCard data:', Object.keys(assureCardResult.data || {}));
      
      // Try to extract from document field if exists
      if (assureCardResult.data && assureCardResult.data.document) {
        console.log('Document data:', JSON.stringify(assureCardResult.data.document, null, 2));
      }
      
      // Fallback to manual data entry for testing
      console.log('📝 Using fallback data for KBA test...');
      extractedData = {
        firstName: 'Ray',  // Based on the filename
        lastName: 'Unknown',
        dateOfBirth: '1985-01-01',
        street: '123 Test Street',
        city: 'Louisville',
        state: 'KY',
        zipCode: '40202'
      };
    }

    console.log('📋 Extracted/Using person data:', extractedData);

    // Step 4: Now call AssureID with the extracted data to get KBA questions
    console.log('\n🧠 Step 2: Calling AssureID to get real KBA questions...');
    const assureIdEndpoint = 'https://blueassure.evssolutions.com/WebServices/Integrated/Main/V300/AssureId';
    
    const assureIdRequest = {
      meta: {
        credentials: {
          username: process.env.EVS_API_KEY || 'E27235-CE567A22-0D31-474A-B551-252882763208',
          password: process.env.EVS_PASSWORD || '8aeWPi0XV#AyS#I'
        },
        customerReference: `REAL_KBA_TEST_${Date.now()}`
      },
      data: {
        firstName: extractedData.firstName,
        lastName: extractedData.lastName,
        dateOfBirth: extractedData.dateOfBirth,
        street: extractedData.street,
        city: extractedData.city,
        state: extractedData.state,
        zipCode: extractedData.zipCode,
        ssn: extractedData.ssn,
        phoneNumber: extractedData.phoneNumber,
        emailAddress: extractedData.emailAddress
      }
    };

    console.log('📡 AssureID Request:', JSON.stringify(assureIdRequest, null, 2));

    const assureIdResponse = await fetch(assureIdEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Host': 'blueassure.evssolutions.com:443',
        'User-Agent': 'NotaryPlatform-Real-KBA-Test/1.0.0'
      },
      body: JSON.stringify(assureIdRequest)
    });

    console.log('📥 AssureID Response status:', assureIdResponse.status);

    if (!assureIdResponse.ok) {
      const errorText = await assureIdResponse.text();
      console.error('❌ AssureID Error:', errorText);
      return;
    }

    const assureIdResult = await assureIdResponse.json();
    
    console.log('✅ SUCCESS! Real AssureID KBA Response:');
    console.log('================================================');
    console.log(JSON.stringify(assureIdResult, null, 2));
    console.log('================================================\n');

    // Step 5: Analyze the real KBA questions structure
    if (assureIdResult.data && assureIdResult.data.kbaQuestions) {
      console.log('🧠 REAL KBA QUESTIONS ANALYSIS:');
      console.log('================================');
      console.log('KBA Questions Object:', JSON.stringify(assureIdResult.data.kbaQuestions, null, 2));
      
      if (assureIdResult.data.kbaQuestions.questions && Array.isArray(assureIdResult.data.kbaQuestions.questions)) {
        console.log(`\n📊 Found ${assureIdResult.data.kbaQuestions.questions.length} REAL KBA questions:`);
        
        assureIdResult.data.kbaQuestions.questions.forEach((question, index) => {
          console.log(`\n--- Real Question ${index + 1} ---`);
          console.log('Full Structure:', JSON.stringify(question, null, 2));
          console.log('Question Text:', question.questionText || question.text || question.question || 'No text found');
          
          // Look for answer options in various possible fields
          const answers = question.answerOptions || question.answers || question.choices || question.options;
          if (answers) {
            console.log('Answer Options:');
            if (Array.isArray(answers)) {
              answers.forEach((answer, i) => {
                console.log(`  ${i + 1}. ${typeof answer === 'string' ? answer : JSON.stringify(answer)}`);
              });
            } else {
              console.log('  (Non-array format):', answers);
            }
          } else {
            console.log('Answer Options: Not found');
          }
          
          console.log('Question ID:', question.id || question.questionId || 'No ID found');
          console.log('Question Type:', question.questionType || question.type || 'Type not specified');
          console.log('Category:', question.category || question.questionCategory || 'No category');
        });

        // Save the structure to a file for reference
        fs.writeFileSync('real-kba-structure.json', JSON.stringify({
          extractedPersonData: extractedData,
          kbaQuestions: assureIdResult.data.kbaQuestions,
          fullResponse: assureIdResult
        }, null, 2));
        
        console.log('\n💾 Saved real KBA structure to: real-kba-structure.json');
        
      } else {
        console.log('❌ No questions array found in kbaQuestions object');
        console.log('KBA Questions keys:', Object.keys(assureIdResult.data.kbaQuestions));
      }
    } else {
      console.log('❌ No kbaQuestions found in AssureID response data');
      console.log('Available AssureID data keys:', Object.keys(assureIdResult.data || {}));
    }

    // Step 6: Show verification results context
    if (assureIdResult.data && assureIdResult.data.assureId) {
      console.log('\n📋 REAL ASSURE ID VERIFICATION RESULTS:');
      console.log('======================================');
      console.log('Address Verification:', assureIdResult.data.assureId.addressVerificationResult);
      console.log('SSN Verification:', assureIdResult.data.assureId.socialSecurityNumberResult);
      console.log('Email Verification:', assureIdResult.data.assureId.emailVerificationResult);
      console.log('Phone Verification:', assureIdResult.data.assureId.phoneVerificationResult);
      console.log('Fraud Check:', assureIdResult.data.assureId.reportedFraudResult);
      console.log('Minor Check:', assureIdResult.data.assureId.minorResult);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testRealKBAResponse().then(() => {
  console.log('\n🎯 Real KBA test completed!');
}).catch(error => {
  console.error('💥 Test execution failed:', error);
}); 