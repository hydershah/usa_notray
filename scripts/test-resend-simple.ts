import { emailService } from '../server/lib/email-service.js';

async function testResend() {
  console.log('🧪 Testing Resend email configuration...');
  
  try {
    await emailService.sendEmail({
      to: 'test@sharpnote.net',
      subject: '✅ Resend Test - Job Creation Email Fix',
      html: '<h2>Email Configuration Test</h2><p>If you receive this, job creation emails should now work!</p>',
      text: 'Email Configuration Test - If you receive this, job creation emails should now work!'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('✅ Job creation emails should now work!');
    
  } catch (error) {
    console.log('❌ Email failed:', error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.message.includes('450')) {
      console.log('\n🔍 Error 450 usually means:');
      console.log('1. Domain "sharpnote.net" is not verified in Resend');
      console.log('2. Go to https://resend.com/domains and verify sharpnote.net');
      console.log('3. Or use a verified domain for FROM_EMAIL');
    }
  }
}

testResend();
