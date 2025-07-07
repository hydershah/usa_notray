import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

// Load environment variables
dotenv.config();

async function testResendAuth() {
  console.log('🔍 Testing Resend Authentication After Domain Change\n');

  // Check environment variables
  const config = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    fromName: process.env.SMTP_FROM_NAME,
    fromEmail: process.env.SMTP_FROM_EMAIL
  };

  console.log('📧 Current Configuration:');
  console.log(`   Host: ${config.host}`);
  console.log(`   Port: ${config.port}`);
  console.log(`   User: ${config.user}`);
  console.log(`   API Key: ${config.pass?.substring(0, 10)}...`);
  console.log(`   From Name: ${config.fromName}`);
  console.log(`   From Email: ${config.fromEmail}`);

  // Validate configuration
  const missing = [];
  if (!config.host) missing.push('SMTP_HOST');
  if (!config.port) missing.push('SMTP_PORT');
  if (!config.user) missing.push('SMTP_USER');
  if (!config.pass) missing.push('SMTP_PASS');
  if (!config.fromEmail) missing.push('SMTP_FROM_EMAIL');

  if (missing.length > 0) {
    console.log(`\n❌ Missing configuration: ${missing.join(', ')}`);
    console.log('\n💡 Please update your .env file with the new Resend settings');
    return;
  }

  // Check API key format
  if (!config.pass?.startsWith('re_')) {
    console.log('\n⚠️  Warning: API key doesn\'t start with "re_" - this might not be a valid Resend API key');
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: parseInt(config.port || '587'),
    secure: false,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });

  try {
    // Test 1: SMTP connection
    console.log('\n🔗 Testing SMTP Authentication...');
    await transporter.verify();
    console.log('✅ SMTP authentication successful!');

    // Test 2: Send test email
    console.log('\n📧 Sending test email...');
    const testEmail = {
      from: `${config.fromName} <${config.fromEmail}>`,
      to: 'delivered@resend.dev', // Resend's test email
      subject: '🧪 Resend Domain Test - Sharp Note',
      html: `
        <h2 style="color: #1e40af;">Resend Domain Configuration Test</h2>
        <p>This is a test email to verify your new Resend domain configuration.</p>
        <p><strong>From Domain:</strong> ${config.fromEmail?.split('@')[1]}</p>
        <p><strong>API Key:</strong> ${config.pass?.substring(0, 10)}...</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <p style="color: #16a34a;">✅ If you receive this email, your configuration is working!</p>
      `
    };

    const info = await transporter.sendMail(testEmail);
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   From: ${testEmail.from}`);
    console.log(`   To: ${testEmail.to}`);

    console.log('\n🎉 All tests passed! Your Resend configuration is working correctly.');

  } catch (error: any) {
    console.log('\n❌ Test failed:');
    console.log(`   Error: ${error.message}`);
    
    console.log('\n💡 Troubleshooting Steps:');
    console.log('1. Verify your API key is correct in Resend dashboard');
    console.log('2. Check that your from email domain is verified in Resend');
    console.log('3. Ensure the domain in SMTP_FROM_EMAIL matches your verified domain');
    console.log('4. Make sure you copied the API key correctly (should start with "re_")');
    
    if (error.code === 'EAUTH') {
      console.log('\n🔐 Authentication Failed:');
      console.log('   - Double-check your API key in Resend dashboard');
      console.log('   - Make sure you copied it correctly to SMTP_PASS');
    }
    
    if (error.message.includes('Invalid `from` field')) {
      console.log('\n📧 From Email Issue:');
      console.log('   - Verify your domain is added and verified in Resend');
      console.log('   - Update SMTP_FROM_EMAIL to use your verified domain');
    }
  }

  process.exit();
}

testResendAuth(); 