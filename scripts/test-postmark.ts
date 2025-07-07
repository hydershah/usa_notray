import { emailService } from "../server/lib/email-service";

async function testPostmark() {
  console.log("🧪 Testing Postmark Email Configuration...\n");

  const testEmail = process.env.TEST_EMAIL || 'your-email@example.com';
  
  if (testEmail === 'your-email@example.com') {
    console.log("❌ Please set TEST_EMAIL environment variable or provide email as argument");
    console.log("   Usage: TEST_EMAIL=your@email.com npx tsx scripts/test-postmark.ts");
    console.log("   Or: npx tsx scripts/test-postmark.ts your@email.com");
    process.exit(1);
  }

  // Use command line argument if provided
  const emailToTest = process.argv[2] || testEmail;

  console.log(`📧 Testing Postmark with email: ${emailToTest}\n`);

  try {
    // Test 1: Configuration test
    console.log("1️⃣ Testing Postmark configuration...");
    const result = await emailService.testConfiguration(emailToTest);
    console.log(`✅ ${result}\n`);

    // Test 2: Signer invitation email
    console.log("2️⃣ Testing signer invitation email...");
    await emailService.sendSignerInvitation({
      signerName: "Test Signer",
      signerEmail: emailToTest,
      signerRole: "Buyer",
      invitationToken: "test-token-123",
      titleCompany: "Test Title Company",
      closingType: "Purchase Agreement",
      propertyAddress: "123 Test Street, Test City, TX 12345",
      scheduledDate: "January 15, 2025",
      scheduledTime: "2:00 PM"
    });
    console.log("✅ Signer invitation sent successfully\n");

    // Test 3: Password reset email
    console.log("3️⃣ Testing password reset email...");
    await emailService.sendPasswordReset({
      userEmail: emailToTest,
      userName: "Test User",
      resetToken: "test-reset-token-456"
    });
    console.log("✅ Password reset email sent successfully\n");

    console.log("🎉 All Postmark tests completed successfully!");
    console.log("\n📊 What to check:");
    console.log("  • Check your email inbox for 3 test emails");
    console.log("  • Verify emails are not in spam folder");
    console.log("  • Check email formatting and links");
    console.log("  • Notice faster delivery compared to SMTP");
    
    console.log("\n📈 Postmark Benefits You'll See:");
    console.log("  • Instant delivery (usually < 5 seconds)");
    console.log("  • Professional delivery reputation");
    console.log("  • Email tracking and analytics");
    console.log("  • High inbox placement rates");

  } catch (error) {
    console.error("❌ Postmark test failed:");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    
    console.log("\n💡 Troubleshooting Tips:");
    console.log("1. Verify your Postmark API key is correct");
    console.log("2. Check that your sender email is verified in Postmark");
    console.log("3. Ensure you have Postmark credits available");
    console.log("4. Check Postmark activity log for detailed error messages");
    console.log("5. Verify your domain is properly configured");
    
    process.exit(1);
  }
}

// Get email from command line argument or environment
const email = process.argv[2];
if (email) {
  process.env.TEST_EMAIL = email;
}

// Run the test
testPostmark().then(() => {
  console.log('\n🏁 Postmark test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test script failed:', error);
  process.exit(1);
}); 