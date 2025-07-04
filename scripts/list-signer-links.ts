import { db } from "../server/db";
import { signers, jobs } from "../shared/schema";
import { desc, eq } from "drizzle-orm";


async function listSignerLinks() {
  console.log("📋 Listing All Signers and Their Invitation Links\n");
  console.log("=" .repeat(80));
  
  try {
    // Get all signers with their job info
    const allSigners = await db
      .select({
        signer: signers,
        job: jobs
      })
      .from(signers)
      .leftJoin(jobs, eq(signers.jobId, jobs.id))
      .orderBy(desc(signers.createdAt));
    
    if (allSigners.length === 0) {
      console.log("No signers found in the database.");
      return;
    }
    
    console.log(`Found ${allSigners.length} signers:\n`);
    
    allSigners.forEach((row, index) => {
      const { signer, job } = row;
              const invitationLink = signer.invitationToken 
        ? `${process.env.CLIENT_URL || 'http://localhost:5173'}/sign/${signer.invitationToken}`
          : 'No invitation token';
      
      console.log(`${index + 1}. ${signer.signerName}`);
      console.log(`   📧 Email: ${signer.signerEmail}`);
      console.log(`   📱 Phone: ${signer.signerPhoneNumber}`);
      console.log(`   👤 Role: ${signer.signerRole}`);
      console.log(`   🏢 Company: ${job?.titleCompany || 'N/A'}`);
      console.log(`   📄 Job Type: ${job?.closingType || 'N/A'}`);
      console.log(`   🔗 Invitation Link: ${invitationLink}`);
      console.log(`   📅 Invitation Sent: ${signer.invitationSentAt ? new Date(signer.invitationSentAt).toLocaleString() : 'Not sent'}`);
      console.log(`   ✅ Status: ${signer.signingStatus}`);
      console.log(`   ${"-".repeat(76)}`);
    });
    
    console.log("\n💡 Tips:");
    console.log("   - Share the invitation link directly with signers if email issues persist");
    console.log("   - Use 'npx tsx scripts/resend-invitation.ts <email>' to resend an invitation");
    console.log("   - Signers should check SPAM folder if they don't see the email");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
  
  process.exit();
}

listSignerLinks(); 