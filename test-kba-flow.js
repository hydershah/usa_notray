/**
 * KBA Flow Test Script
 * 
 * This demonstrates the complete KBA flow you requested:
 * 1. User chooses KBA during job creation
 * 2. User gets popup with 5 random questions from EVS
 * 3. If they fail, they can try again  
 * 4. If they fail twice, they get locked for 24 hours
 */

const testKBAFlow = async () => {
  console.log('🧠 Testing KBA Flow Implementation');
  console.log('=====================================');
  
  // Test user data (this would come from the job creation form)
  const testUser = {
    userId: 1,
    firstName: 'John',
    lastName: 'Smith',
    dateOfBirth: '1990-01-01',
    ssn: '123456789',
    address: {
      street: '123 Main St',
      city: 'Louisville', 
      state: 'KY',
      zipCode: '40202'
    },
    phone: '5021234567',
    email: 'john.smith@example.com'
  };

  try {
    console.log('📋 Step 1: Check KBA Status');
    // Check if user is locked or already verified
    const statusResponse = await fetch('http://localhost:3000/api/kba/status/1', {
      headers: {
        'Authorization': `Bearer your_token_here`
      }
    });
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log('✅ KBA Status:', statusData.status);
      
      if (statusData.status.isLocked) {
        console.log('🔒 User is currently locked until:', statusData.status.lockedUntil);
        return;
      }
      
      if (statusData.status.isVerified) {
        console.log('✅ User is already KBA verified');
        return;
      }
    }

    console.log('\n🚀 Step 2: Initialize KBA Session');
    // Initialize KBA session (this happens when popup opens)
    const initResponse = await fetch('http://localhost:3000/api/kba/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer your_token_here`
      },
      body: JSON.stringify(testUser)
    });

    if (!initResponse.ok) {
      const error = await initResponse.json();
      console.log('❌ Failed to initialize KBA:', error.message);
      return;
    }

    const initData = await initResponse.json();
    console.log('✅ KBA Session initialized successfully!');
    console.log('📝 Session ID:', initData.sessionId);
    console.log('❓ Number of questions:', initData.questions.length);
    console.log('🔄 Attempts remaining:', initData.attemptsRemaining);
    
    // Display the questions (as they would appear in the popup)
    console.log('\n📋 KBA Questions:');
    initData.questions.forEach((question, index) => {
      console.log(`\nQ${index + 1}: ${question.text}`);
      question.answers.forEach((answer, answerIndex) => {
        console.log(`  ${answerIndex + 1}. ${answer.text}`);
      });
    });

    console.log('\n🎯 Step 3: Simulate User Answering Questions');
    // Simulate user selecting random answers (in real app, user would select these)
    const userAnswers = initData.questions.map((_, index) => ({
      questionIndex: index,
      selectedAnswerIndex: Math.floor(Math.random() * 4) // Random answer 0-3
    }));

    console.log('📝 User selected answers:', userAnswers.map(a => a.selectedAnswerIndex + 1));

    console.log('\n✅ Step 4: Submit KBA Answers');
    const submitResponse = await fetch('http://localhost:3000/api/kba/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer your_token_here`
      },
      body: JSON.stringify({
        sessionId: initData.sessionId,
        userId: testUser.userId,
        answers: userAnswers
      })
    });

    const submitData = await submitResponse.json();
    
    if (submitData.success && submitData.passed) {
      console.log('🎉 KBA VERIFICATION SUCCESSFUL!');
      console.log(`📊 Score: ${submitData.score}% (${submitData.correctAnswers}/${submitData.totalQuestions} correct)`);
      console.log('✅ User can now proceed with the notary session');
      
    } else if (submitData.locked) {
      console.log('🔒 ACCOUNT LOCKED FOR 24 HOURS');
      console.log(`📊 Final Score: ${submitData.score}% (${submitData.correctAnswers}/${submitData.totalQuestions} correct)`);
      console.log(`🚫 Locked until: ${submitData.lockedUntil}`);
      console.log('❌ User cannot proceed until lockout expires');
      
    } else {
      console.log('❌ KBA VERIFICATION FAILED');
      console.log(`📊 Score: ${submitData.score}% (${submitData.correctAnswers}/${submitData.totalQuestions} correct)`);
      console.log(`🔄 Attempts remaining: ${submitData.attemptsRemaining}`);
      console.log('⚠️ User can try again');
    }

  } catch (error) {
    console.error('❌ KBA Flow Test Error:', error.message);
  }
};

// Flow explanation
console.log(`
🧠 KBA FLOW IMPLEMENTATION SUMMARY
====================================

✅ WHAT'S IMPLEMENTED:

1. 📋 KBA Status Check (/api/kba/status/:userId)
   - Checks if user is locked, verified, or can attempt
   - Returns attempts used and lockout information

2. 🚀 KBA Session Initialization (/api/kba/initialize) 
   - Calls EVS AssureID API for real KBA questions
   - Selects 5 random questions from the response
   - Creates 10-minute session with unique ID
   - Returns questions without correct answers

3. ✅ KBA Answer Submission (/api/kba/submit)
   - Validates all 5 questions are answered
   - Scores answers (need 4/5 correct = 80% to pass)
   - Updates user verification status on pass
   - Tracks attempts and applies 24-hour lockout after 2 failures

4. 🎨 KBA Popup Component (React)
   - Beautiful UI with progress bar and timer
   - Shows 5 questions with multiple choice answers
   - Real-time validation and submission
   - Handles success, failure, and lockout states

🔄 THE COMPLETE FLOW:

Job Creation → Choose KBA → Popup Opens → 5 EVS Questions → 
Submit Answers → Pass/Fail/Lock → Continue/Retry/Wait 24hrs

🎯 KEY FEATURES:
- Real EVS integration (uses your existing credentials)
- 5 random questions per session  
- 10-minute session timeout
- 80% pass rate (4 out of 5 correct)
- 2 attempts maximum
- 24-hour lockout after failures
- Secure session management
- Beautiful responsive UI

Ready to test! Run: node test-kba-flow.js
`);

// Uncomment to run the test
// testKBAFlow(); 