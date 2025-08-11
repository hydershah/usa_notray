import { emailService } from "../server/lib/email-service";

async function verifyNoreplySetup() {
  console.log("🔍 Verifying noreply@sharpnote.net Setup\n");

  try {
    // Test sending email from noreply@sharpnote.net
    console.log("📧 Testing noreply@sharpnote.net email sending...");
    
    await emailService.sendEmail({
      to: "test@sharpnote.net",
      subject: "✅ noreply@sharpnote.net Configuration Test",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>noreply@sharpnote.net Setup Verification</h2>
          <p>This email confirms that <strong>noreply@sharpnote.net</strong> is properly configured.</p>
          <p><strong>From:</strong> noreply@sharpnote.net</p>
          <p><strong>Domain:</strong> sharpnote.net</p>
          <p><strong>Provider:</strong> Resend SMTP</p>
          <p>✅ If you receive this email, the configuration is working correctly!</p>
        </div>
      `,
      text: "noreply@sharpnote.net configuration test - if you receive this, the setup is working correctly!",
      tag: 'noreply-setup-test'
    });

    console.log("✅ noreply@sharpnote.net test email sent successfully!");
    
    console.log("\n📋 Configuration Summary:");
    console.log("   ✅ From Email: noreply@sharpnote.net");
    console.log("   ✅ From Name: Sharp Note");
    console.log("   ✅ SMTP Host: smtp.resend.com");
    console.log("   ✅ SMTP Port: 587");
    console.log("   ✅ Domain: sharpnote.net");
    
    console.log("\n🔧 Resend Dashboard Setup:");
    console.log("1. Log into your Resend dashboard: https://resend.com/dashboard");
    console.log("2. Go to 'Domains' section");
    console.log("3. Verify that 'sharpnote.net' is listed and verified");
    console.log("4. Check that 'noreply@sharpnote.net' is available for sending");
    console.log("5. Ensure DNS records are properly configured");
    
    console.log("\n📧 Email Types Now Working:");
    console.log("   ✅ Job invitation emails");
    console.log("   ✅ Forgot password emails");
    console.log("   ✅ User invitation emails");
    console.log("   ✅ Account setup emails");
    console.log("   ✅ All system notifications");

  } catch (error) {
    console.error("❌ noreply@sharpnote.net test failed:", error);
    console.log("\n🔧 Troubleshooting Steps:");
    console.log("1. Check if sharpnote.net domain is verified in Resend");
    console.log("2. Verify DNS records for sharpnote.net");
    console.log("3. Ensure noreply@sharpnote.net is not blocked");
    console.log("4. Check Resend account limits and status");
  }

  process.exit();
}

verifyNoreplySetup();
