import nodemailer from "nodemailer";

async function testGmailSMTP() {
  console.log("🔍 Testing Gmail SMTP as Alternative...\n");
  console.log("⚠️  To use Gmail SMTP, you need:");
  console.log("   1. A Gmail account");
  console.log("   2. 2-Step Verification enabled");
  console.log("   3. An App Password (not your regular password)");
  console.log("   Get App Password at: https://myaccount.google.com/apppasswords\n");
  
  // Example Gmail configuration
  const gmailConfig = {
    service: 'gmail',
    auth: {
      user: 'your.email@gmail.com', // Replace with your Gmail
      pass: 'your-app-password' // Replace with your App Password
    }
  };
  
  console.log("📝 Example .env configuration for Gmail:");
  console.log("SMTP_HOST=smtp.gmail.com");
  console.log("SMTP_PORT=587");
  console.log("SMTP_USER=your.email@gmail.com");
  console.log("SMTP_PASS=your-app-password");
  console.log("SMTP_SECURE=false\n");
  
  // Alternative: SendGrid configuration
  console.log("📝 Alternative: SendGrid (Free tier available)");
  console.log("SMTP_HOST=smtp.sendgrid.net");
  console.log("SMTP_PORT=587");
  console.log("SMTP_USER=apikey");
  console.log("SMTP_PASS=your-sendgrid-api-key\n");
  
  // Alternative: Local testing with Mailtrap
  console.log("📝 For Testing: Mailtrap (catches all emails)");
  console.log("SMTP_HOST=smtp.mailtrap.io");
  console.log("SMTP_PORT=2525");
  console.log("SMTP_USER=your-mailtrap-username");
  console.log("SMTP_PASS=your-mailtrap-password\n");
  
  console.log("🚀 Quick Fix Steps:");
  console.log("1. Create a Gmail account specifically for your app");
  console.log("2. Enable 2-Step Verification");
  console.log("3. Generate an App Password");
  console.log("4. Update your .env file with Gmail settings");
  console.log("5. Restart your server\n");
  
  console.log("💡 Or use a professional email service:");
  console.log("- SendGrid (free tier: 100 emails/day)");
  console.log("- AWS SES ($0.10 per 1000 emails)");
  console.log("- Mailgun (free tier: 5000 emails/month)");
  console.log("- Postmark (100 emails/month free)\n");
  
  process.exit();
}

testGmailSMTP(); 