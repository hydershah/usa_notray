import { db } from "../server/db";
import { signers } from "../shared/schema";
import crypto from "crypto";


async function repopulateTestSigners() {
  console.log("Repopulating test signers data...");
  
  try {
    // Add test signers for existing jobs
    const testSigners = [
      {
        jobId: 3,
        signerName: "John Doe",
        signerEmail: "john.doe@example.com",
        signerPhoneNumber: "(555) 123-4567",
        signerRole: "borrower",
        invitationToken: crypto.randomUUID(),
        invitationSentAt: new Date(),
        accessType: "guest" as const,
        guestVerificationStatus: "pending" as const,
        signingStatus: "pending" as const,
      },
      {
        jobId: 3,
        signerName: "Jane Smith",
        signerEmail: "jane.smith@example.com",
        signerPhoneNumber: "(555) 987-6543",
        signerRole: "co-borrower",
        invitationToken: crypto.randomUUID(),
        invitationSentAt: new Date(),
        accessType: "guest" as const,
        guestVerificationStatus: "pending" as const,
        signingStatus: "pending" as const,
      }
    ];

    for (const signer of testSigners) {
      const result = await db.insert(signers).values(signer).returning();
      console.log(`Created signer: ${result[0].signerName} with token: ${result[0].invitationToken}`);
    }

    console.log("✅ Test signers repopulated successfully!");
    
    // Display the invitation links
    console.log("\n📧 Test invitation links:");
    const allSigners = await db.select().from(signers);
    allSigners.forEach(signer => {
              console.log(`${signer.signerName}: ${process.env.CLIENT_URL || 'http://localhost:5173'}/sign/${signer.invitationToken}`);
    });
    
  } catch (error) {
    console.error("❌ Error repopulating signers:", error);
  } finally {
    process.exit();
  }
}

repopulateTestSigners(); 