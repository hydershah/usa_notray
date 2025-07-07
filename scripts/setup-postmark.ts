import { db } from "../server/db";
import { systemSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function setupPostmark() {
  console.log("🚀 Setting up Postmark email configuration...\n");

  try {
    // Postmark settings
    const postmarkSettings = [
      {
        key: 'email_provider',
        value: 'postmark',
        type: 'string',
        description: 'Email provider preference (postmark or smtp)',
        isProtected: false
      },
      {
        key: 'postmark_api_key',
        value: 'a22553c8-6da3-4b42-844c-168adeec4031',
        type: 'string',
        description: 'Postmark API key',
        isProtected: true
      },
      {
        key: 'postmark_from_email',
        value: 'noreply@usanotaryservices.com',
        type: 'string',
        description: 'From email address for Postmark',
        isProtected: false
      },
      {
        key: 'postmark_from_name',
        value: 'Sharp Note',
        type: 'string',
        description: 'From display name for Postmark',
        isProtected: false
      },
      {
        key: 'postmark_track_opens',
        value: 'true',
        type: 'string',
        description: 'Enable email open tracking',
        isProtected: false
      },
      {
        key: 'postmark_track_links',
        value: 'HtmlAndText',
        type: 'string',
        description: 'Link tracking setting (None, HtmlAndText, HtmlOnly, TextOnly)',
        isProtected: false
      }
    ];

    let updatedCount = 0;
    let createdCount = 0;

    // Insert or update each setting
    for (const setting of postmarkSettings) {
      // Check if setting exists
      const existing = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.key, setting.key))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing setting
        await db.update(systemSettings)
          .set({
            value: setting.value,
            type: setting.type,
            description: setting.description,
            isProtected: setting.isProtected,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, setting.key));
        console.log(`✅ Updated setting: ${setting.key}`);
        updatedCount++;
      } else {
        // Insert new setting
        await db.insert(systemSettings)
          .values(setting);
        console.log(`✅ Created setting: ${setting.key}`);
        createdCount++;
      }
    }

    console.log(`\n✨ Postmark configuration completed!`);
    console.log(`   📝 Created: ${createdCount} settings`);
    console.log(`   🔄 Updated: ${updatedCount} settings`);
    
    // Display configuration summary
    console.log("\n📧 Postmark Configuration Summary:");
    console.log(`  🔑 API Key: ✅ Configured`);
    console.log(`  📧 From Email: noreply@usanotaryservices.com`);
    console.log(`  👤 From Name: Sharp Note`);
    console.log(`  📊 Track Opens: Enabled`);
    console.log(`  🔗 Track Links: HtmlAndText`);
    
    console.log("\n🔧 Next Steps:");
    console.log("  1. Test Postmark configuration: npm run test:postmark");
    console.log("  2. Or test via admin dashboard: /admin/email-settings");
    console.log("  3. Send test emails to verify setup");
    
    console.log("\n✨ Postmark Benefits:");
    console.log("  • High deliverability rates (99%+)");
    console.log("  • Real-time email tracking");
    console.log("  • Professional templates");
    console.log("  • Reliable infrastructure");
    console.log("  • No SMTP configuration needed");
    
  } catch (error) {
    console.error("❌ Error setting up Postmark:", error);
  } finally {
    process.exit();
  }
}

// Run the setup
setupPostmark(); 