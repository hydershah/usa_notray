import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmailConfiguration() {
  console.log('🧪 Testing Email Configuration...\n');

  // Display current configuration
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: smtpPort,
    secure: smtpPort === 465,
    user: process.env.SMTP_USER || 'your-email@gmail.com',
    hasPassword: !!process.env.SMTP_PASS
  };

  console.log('📧 Current Email Configuration:');
  console.log('  Host:', config.host);
  console.log('  Port:', config.port);
  console.log('  Secure (SSL):', config.secure);
  console.log('  User:', config.user);
  console.log('  Has Password:', config.hasPassword);
  console.log('');

  // Create transporter
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  });

  try {
    // Test connection
    console.log('🔌 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    const testEmail = process.env.TEST_EMAIL || process.env.SMTP_USER;
    if (!testEmail) {
      console.log('⚠️  No test email specified. Set TEST_EMAIL environment variable to send a test email.');
      return;
    }

    console.log(`📨 Sending test email to ${testEmail}...`);
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: testEmail,
      subject: 'Sharp Note - Email Configuration Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #2563eb; text-align: center;">📧 Email Test Successful!</h2>
          <p>Congratulations! Your email configuration is working correctly.</p>
          
          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #0369a1;">Configuration Details:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><strong>SMTP Host:</strong> ${config.host}</li>
              <li><strong>Port:</strong> ${config.port}</li>
              <li><strong>Security:</strong> ${config.secure ? 'SSL' : 'STARTTLS'}</li>
              <li><strong>From:</strong> ${process.env.SMTP_USER}</li>
            </ul>
          </div>
          
          <p style="color: #16a34a;">✅ Your Sharp Note system is ready to send:</p>
          <ul>
            <li>Guest signer invitations</li>
            <li>User registration invites</li>
            <li>Password reset emails</li>
          </ul>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            This test was sent at: ${new Date().toISOString()}
          </p>
        </div>
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log(`📧 Message ID: ${info.messageId}`);
    console.log('📬 Check your email inbox to confirm delivery.\n');

  } catch (error) {
    console.error('❌ Email configuration test failed:');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.log('\n💡 Troubleshooting Tips:');
    console.log('1. Check your .env file contains correct SMTP settings');
    console.log('2. Verify your email credentials are correct');
    console.log('3. Ensure your email provider allows SMTP access');
    console.log('4. Check if you need to use an app password instead of regular password');
    console.log('5. Try different port (465 for SSL, 587 for STARTTLS)');
    console.log('\n📖 See EMAIL_SETUP.md for detailed configuration guide');
  }
}

// Run the test
testEmailConfiguration().then(() => {
  console.log('🏁 Email configuration test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
}); 