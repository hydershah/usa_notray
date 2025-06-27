import { db } from "../server/db";
import { systemSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

async function initializeEmailSettings() {
  console.log("🚀 Initializing email settings...\n");

  try {
    // Email settings with Hostinger SSL configuration
    const settings = [
      {
        key: 'smtp_host',
        value: 'smtp.hostinger.com',
        type: 'string',
        description: 'SMTP server hostname',
        isProtected: false
      },
      {
        key: 'smtp_port',
        value: '465',
        type: 'string',
        description: 'SMTP server port',
        isProtected: false
      },
      {
        key: 'smtp_user',
        value: 'mail@digitalexpert.agency',
        type: 'string',
        description: 'SMTP username/email',
        isProtected: false
      },
      {
        key: 'smtp_pass',
        value: 'Coaches@1$',
        type: 'string',
        description: 'SMTP password',
        isProtected: false
      },
      {
        key: 'smtp_secure',
        value: 'true',
        type: 'string',
        description: 'Use SSL/TLS for SMTP',
        isProtected: false
      },
      {
        key: 'from_email',
        value: 'mail@digitalexpert.agency',
        type: 'string',
        description: 'From email address',
        isProtected: false
      },
      {
        key: 'from_name',
        value: 'USA Notary System',
        type: 'string',
        description: 'From display name',
        isProtected: false
      }
    ];

    // Insert or update each setting
    for (const setting of settings) {
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
      } else {
        // Insert new setting
        await db.insert(systemSettings)
          .values(setting);
        console.log(`✅ Created setting: ${setting.key}`);
      }
    }

    console.log("\n✨ Email settings initialized successfully!");
    console.log("\n📧 Configuration Summary:");
    console.log("  Host: smtp.hostinger.com");
    console.log("  Port: 465 (SSL)");
    console.log("  User: mail@digitalexpert.agency");
    console.log("  From: USA Notary System <mail@digitalexpert.agency>");
    console.log("\n🔒 Settings can be managed from the admin dashboard: /email-settings");
    
  } catch (error) {
    console.error("❌ Error initializing email settings:", error);
  } finally {
    process.exit();
  }
}

initializeEmailSettings(); 