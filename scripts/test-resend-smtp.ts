import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

async function testResendSMTP() {
  console.log('🧪 Testing Resend SMTP Configuration...\n');

  // Check environment variables
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.log('❌ Missing environment variables:', missing.join(', '));
    return;
  }

  console.log('✅ Environment variables found');
  console.log(`   SMTP_HOST: ${process.env.SMTP_HOST}`);
  console.log(`   SMTP_PORT: ${process.env.SMTP_PORT}`);
  console.log(`   SMTP_USER: ${process.env.SMTP_USER}`);
  console.log(`   SMTP_PASS: ${process.env.SMTP_PASS?.substring(0, 10)}...`);

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  try {
    // Test connection
    console.log('\n🔗 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');

    // Send test email
    const testEmail = {
      from: `${process.env.SMTP_FROM_NAME || 'Sharp Note'} <${process.env.SMTP_FROM_EMAIL || 'mail@sharpnote.net'}>`,
      to: 'test@sharpnote.net',
      subject: '🧪 Test Email - Sharp Note',
      html: `
        <h2 style="color: #1e40af;">Sharp Note Test Email</h2>
        <p>This is a test email to verify that your SMTP configuration is working correctly.</p>
        <p><strong>Sender Name:</strong> Sharp Note</p>
        <p><strong>Configuration:</strong> Resend SMTP</p>
        <p><em>If you received this email, your configuration is working! 🎉</em></p>
      `
    };

    console.log('\n📧 Sending test email...');
    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   To: ${testEmail.to}`);
    console.log(`   From: ${testEmail.from}`);

  } catch (error: any) {
    console.log('❌ SMTP test failed:');
    console.log(`   Error: ${error.message}`);
  }

  process.exit();
}

testResendSMTP(); 