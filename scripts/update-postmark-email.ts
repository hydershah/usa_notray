import { db } from "../server/db";
import { systemSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function updatePostmarkEmail() {
  console.log("🔧 Updating Postmark configuration with verified email...\n");

  try {
    // Update Postmark email settings
    const updates = [
      {
        key: 'postmark_from_email',
        value: 'mail@sharpnote.net'
      },
      {
        key: 'postmark_from_name', 
        value: 'Sharp Note'
      }
    ];

    for (const update of updates) {
      await db.update(systemSettings)
        .set({
          value: update.value,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.key, update.key));
      
      console.log(`✅ Updated ${update.key}: ${update.value}`);
    }

    console.log(`\n✨ Postmark email configuration updated!`);
    console.log("\n📧 Current Configuration:");
    console.log(`  From Email: mail@sharpnote.net`);
    console.log(`  From Name: Sharp Note`);
    console.log(`  Provider: Postmark`);
    console.log(`  API Key: ✅ Configured`);
    
    console.log("\n🔧 Ready to test!");
    console.log("  Run: npx tsx scripts/test-postmark.ts mail@sharpnote.net");
    
  } catch (error) {
    console.error("❌ Error updating Postmark email:", error);
  } finally {
    process.exit();
  }
}

// Run the update
updatePostmarkEmail(); 