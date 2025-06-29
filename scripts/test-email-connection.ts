import { db } from "../server/db";
import { signers } from "../shared/schema";
import nodemailer from "nodemailer";
import { desc } from "drizzle-orm";

async function testEmailConnection() {
  console.log("🔍 Testing email connection and signer creation...\n");
  
  // Test 1: Email Configuration
  console.log("📧 Testing Email Configuration:");
  const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465');
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  
  console.log(`Host: ${smtpHost}`);
  console.log(`Port: ${smtpPort}`);
  console.log(`User: ${smtpUser}`);
  console.log(`Has Password: ${!!smtpPass}`);
  
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      rejectUnauthorized: false // For development
    }
  });
  
  // Test SMTP connection
  console.log("\n🔌 Testing SMTP Connection:");
  try {
    await transporter.verify();
    console.log("✅ SMTP connection successful!");
  } catch (error) {
    console.error("❌ SMTP connection failed:", error);
  }
  
  // Test 2: Check recent signers
  console.log("\n👥 Checking Recent Signers:");
  try {
    const recentSigners = await db.select().from(signers).orderBy(desc(signers.createdAt)).limit(5);
    
    if (recentSigners.length === 0) {
      console.log("No signers found in the database.");
    } else {
      console.log(`Found ${recentSigners.length} recent signers:`);
      recentSigners.forEach((signer, index) => {
        console.log(`\n${index + 1}. ${signer.signerName} (${signer.signerEmail})`);
        console.log(`   Job ID: ${signer.jobId}`);
        console.log(`   Invitation Token: ${signer.invitationToken || 'NOT GENERATED'}`);
        console.log(`   Invitation Sent: ${signer.invitationSentAt || 'NOT SENT'}`);
        console.log(`   Status: ${signer.signingStatus}`);
      });
    }
  } catch (error) {
    console.error("❌ Error fetching signers:", error);
  }
  
  // Test 3: Send test email
  console.log("\n📨 Sending Test Email:");
  try {
    const testEmail = await transporter.sendMail({
      from: smtpUser,
      to: 'test@example.com', // Change this to your email
      subject: 'Test Email from NotaryPro',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Test Email</h2>
          <p>This is a test email to verify SMTP configuration.</p>
          <p>If you receive this, your email configuration is working correctly!</p>
        </div>
      `
    });
    console.log("✅ Test email sent successfully!");
    console.log("Message ID:", testEmail.messageId);
  } catch (error) {
    console.error("❌ Failed to send test email:", error);
  }
  
  process.exit();
}

testEmailConnection(); 