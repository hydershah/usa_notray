import { db } from "../server/db";
import { signers } from "../shared/schema";
import { eq } from "drizzle-orm";
import nodemailer from "nodemailer";

async function resendInvitation() {
  const signerEmail = process.argv[2];
  
  if (!signerEmail) {
    console.log("Usage: npx tsx scripts/resend-invitation.ts <signer-email>");
    process.exit(1);
  }
  
  console.log(`📧 Resending invitation to: ${signerEmail}\n`);
  
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'hello@xymax.co',
      pass: process.env.SMTP_PASS || 'Coaches@1$'
    },
    tls: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // Find the signer
    const [signer] = await db.select().from(signers).where(eq(signers.signerEmail, signerEmail));
    
    if (!signer) {
      console.log(`❌ No signer found with email: ${signerEmail}`);
      process.exit(1);
    }
    
    console.log(`✅ Found signer: ${signer.signerName}`);
    console.log(`   Job ID: ${signer.jobId}`);
    console.log(`   Invitation Token: ${signer.invitationToken}`);
    
    const invitationLink = `http://localhost:3000/sign/${signer.invitationToken}`;
    
    // Send the email
    const emailResult = await transporter.sendMail({
      from: `"USA Notary Services" <${process.env.SMTP_USER || "noreply@usanotaryservices.com"}>`,
      to: signer.signerEmail,
      subject: 'Document Signing Invitation - Action Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #2563eb; text-align: center;">Document Signing Invitation</h2>
          <p>Dear <strong>${signer.signerName}</strong>,</p>
          
          <p>You have been invited to sign important documents.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin: 20px 0;">
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="margin: 8px 0;"><strong>Your Role:</strong> ${signer.signerRole}</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              🔗 Access Signing Session
            </a>
          </div>
          
          <p style="text-align: center; color: #666; font-size: 14px;">
            Or copy this link: ${invitationLink}
          </p>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; font-size: 14px;"><strong>What to expect:</strong></p>
            <ul style="font-size: 14px; margin: 10px 0 0 0;">
              <li>Identity verification (ID + photo required)</li>
              <li>Choose between quick guest signing or full registration</li>
              <li>Digital signature capture</li>
              <li>Live notarization session</li>
            </ul>
          </div>
          
          <p style="margin-top: 30px;">Best regards,<br><strong>USA Notary Team</strong></p>
        </div>
      `
    });
    
    console.log("\n✅ Email sent successfully!");
    console.log(`Message ID: ${emailResult.messageId}`);
    console.log(`\n📌 Please ask ${signer.signerName} to:`);
    console.log("   1. Check their inbox for the email");
    console.log("   2. Check their SPAM/JUNK folder if not in inbox");
    console.log("   3. Look for email from: hello@xymax.co");
    console.log(`   4. Or directly visit: ${invitationLink}`);
    
    // Update invitation sent timestamp
    await db.update(signers)
      .set({ invitationSentAt: new Date() })
      .where(eq(signers.id, signer.id));
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit();
}

resendInvitation(); 