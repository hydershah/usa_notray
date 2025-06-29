import { db } from "../server/db";
import { systemSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function initializeEmailSettings() {
  console.log("🚀 Initializing email settings...\n");

  try {
    // Professional email settings - secure configuration without hardcoded credentials
    const settings = [
      {
        key: 'smtp_host',
        value: process.env.SMTP_HOST || 'smtp.hostinger.com',
        type: 'string',
        description: 'SMTP server hostname',
        isProtected: false
      },
      {
        key: 'smtp_port',
        value: process.env.SMTP_PORT || '465',
        type: 'string',
        description: 'SMTP server port',
        isProtected: false
      },
      {
        key: 'smtp_user',
        value: process.env.SMTP_USER || '',
        type: 'string',
        description: 'SMTP username/email',
        isProtected: false
      },
      {
        key: 'smtp_pass',
        value: process.env.SMTP_PASS || '',
        type: 'string',
        description: 'SMTP password',
        isProtected: true
      },
      {
        key: 'smtp_secure',
        value: process.env.SMTP_SECURE || 'true',
        type: 'string',
        description: 'Use SSL/TLS for SMTP',
        isProtected: false
      },
      {
        key: 'from_email',
        value: process.env.FROM_EMAIL || process.env.SMTP_USER || 'noreply@usanotaryservices.com',
        type: 'string',
        description: 'From email address',
        isProtected: false
      },
      {
        key: 'from_name',
        value: process.env.FROM_NAME || 'USA Notary Services',
        type: 'string',
        description: 'From display name',
        isProtected: false
      }
    ];

    let updatedCount = 0;
    let createdCount = 0;

    // Insert or update each setting
    for (const setting of settings) {
      // Skip empty values to avoid overwriting existing settings
      if (!setting.value && setting.key !== 'from_name') {
        console.log(`⚠️ Skipping ${setting.key} - no value provided`);
        continue;
      }

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

    console.log(`\n✨ Email settings initialization completed!`);
    console.log(`   📝 Created: ${createdCount} settings`);
    console.log(`   🔄 Updated: ${updatedCount} settings`);
    
    // Display configuration summary (without exposing credentials)
    console.log("\n📧 Configuration Summary:");
    const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
    const port = process.env.SMTP_PORT || '465';
    const secure = (process.env.SMTP_PORT === '465' || process.env.SMTP_SECURE === 'true') ? 'SSL' : 'STARTTLS';
    const fromName = process.env.FROM_NAME || 'USA Notary Services';
    
    console.log(`  📧 Host: ${host}`);
    console.log(`  🔌 Port: ${port} (${secure})`);
    console.log(`  👤 From: ${fromName}`);
    console.log(`  🔑 User: ${process.env.SMTP_USER ? '✅ Configured' : '❌ Not set'}`);
    console.log(`  🔒 Pass: ${process.env.SMTP_PASS ? '✅ Configured' : '❌ Not set'}`);
    
    console.log("\n🔧 Next Steps:");
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("  1. Set SMTP_USER and SMTP_PASS environment variables");
      console.log("  2. Or configure via admin dashboard: /admin/email-settings");
    } else {
      console.log("  1. Test configuration via admin dashboard: /admin/email-settings");
      console.log("  2. Send test emails to verify setup");
    }
    console.log("  3. Professional email templates are ready for:");
    console.log("     • Signer invitations");
    console.log("     • User registrations");
    console.log("     • Password resets");
    
  } catch (error) {
    console.error("❌ Error initializing email settings:", error);
  } finally {
    process.exit();
  }
}

initializeEmailSettings(); 