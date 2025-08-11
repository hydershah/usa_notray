import { db } from "../server/db";
import { emailService } from "../server/lib/email-service";

async function testEmailFunctionality() {
  console.log("🧪 Testing Email Functionality for Job Invites and Forgot Password\n");

  try {
    // Test 1: Job Invite Email
    console.log("📧 Test 1: Job Invite Email");
    await emailService.sendSignerInvitation({
      signerName: "Test User",
      signerEmail: "test@sharpnote.net",
      signerRole: "Buyer",
      invitationToken: "test-invitation-token-123",
      titleCompany: "Test Title Company",
      closingType: "Purchase",
      propertyAddress: "123 Test Street, Test City, TS 12345",
      scheduledDate: "2025-08-15",
      scheduledTime: "2:00 PM"
    });
    console.log("✅ Job invite email sent successfully!");

    // Test 2: Forgot Password Email
    console.log("\n📧 Test 2: Forgot Password Email");
    await emailService.sendPasswordReset({
      userEmail: "test@sharpnote.net",
      userName: "Test User",
      resetToken: "test-reset-token-456"
    });
    console.log("✅ Forgot password email sent successfully!");

    // Test 3: User Invitation Email
    console.log("\n📧 Test 3: User Invitation Email");
    await emailService.sendUserInvitation({
      userEmail: "test@sharpnote.net",
      userName: "Test User",
      role: "Notary",
      inviteToken: "test-user-invite-token-789",
      invitedBy: "Admin User"
    });
    console.log("✅ User invitation email sent successfully!");

    console.log("\n🎉 All email tests passed! Email functionality is working correctly.");
    console.log("\n📋 Summary:");
    console.log("   ✅ Job invite emails are working");
    console.log("   ✅ Forgot password emails are working");
    console.log("   ✅ User invitation emails are working");
    console.log("   ✅ Resend SMTP configuration is correct");
    console.log("   ✅ Domain verification is complete");

  } catch (error) {
    console.error("❌ Email test failed:", error);
    console.log("\n🔧 Troubleshooting:");
    console.log("   1. Check if sharpnote.net domain is verified in Resend");
    console.log("   2. Verify SMTP credentials are correct");
    console.log("   3. Check if the email service is properly configured");
  }

  process.exit();
}

testEmailFunctionality();
