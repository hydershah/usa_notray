const fetch = require('node-fetch');

async function testSigningAssignments() {
  try {
    // First, let's try to login (you'll need to replace these with actual credentials)
    console.log('Testing signing-assignments endpoint...');
    
    // For now, let's just test the endpoint with a dummy token to see the validation
    const response = await fetch('http://localhost:3000/api/jobs/signing-assignments', {
      headers: {
        'Authorization': 'Bearer dummy-token'
      }
    });
    
    console.log('Response status:', response.status);
    const data = await response.text();
    console.log('Response:', data);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSigningAssignments();
