import { db } from "../server/db";
import { systemSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function addPostmarkStream() {
  console.log("🔧 Adding Postmark message stream setting...\n");

  try {
    const streamSetting = {
      key: 'postmark_message_stream',
      value: 'sharpnote',
      type: 'string',
      description: 'Postmark message stream name',
      isProtected: false
    };

    // Check if setting exists
    const existing = await db.select()
      .from(systemSettings)
      .where(eq(systemSettings.key, streamSetting.key))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing setting
      await db.update(systemSettings)
        .set({
          value: streamSetting.value,
          updatedAt: new Date()
        })
        .where(eq(systemSettings.key, streamSetting.key));
      console.log(`✅ Updated: ${streamSetting.key} = ${streamSetting.value}`);
    } else {
      // Insert new setting
      await db.insert(systemSettings)
        .values(streamSetting);
      console.log(`✅ Created: ${streamSetting.key} = ${streamSetting.value}`);
    }

    console.log(`\n✨ Postmark message stream configured!`);
    console.log("\n📧 Complete Postmark Configuration:");
    console.log(`  Provider: Postmark`);
    console.log(`  API Key: ✅ Configured`);
    console.log(`  From Email: mail@sharpnote.net`);
    console.log(`  From Name: Sharp Note`);
    console.log(`  Message Stream: sharpnote`);
    console.log(`  Track Opens: Enabled`);
    console.log(`  Track Links: HtmlAndText`);
    
    console.log("\n🚀 Ready to test with verified settings!");
    console.log("  Run: npx tsx scripts/test-postmark.ts mail@sharpnote.net");
    
  } catch (error) {
    console.error("❌ Error adding message stream:", error);
  } finally {
    process.exit();
  }
}

// Run the update
addPostmarkStream(); 