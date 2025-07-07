import { Pool } from 'pg';

async function fixResendSenderName() {
  console.log("🎯 Fixing Resend sender name configuration...\n");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Update database settings to ensure Sharp Note is used
    console.log("1️⃣ Updating database SMTP settings...");
    
    const smtpSettings = [
      { key: 'from_name', value: 'Sharp Note' },
      { key: 'from_email', value: process.env.SMTP_USER || 'mail@sharpnote.net' },
      { key: 'smtp_host', value: process.env.SMTP_HOST || 'smtp.resend.com' },
      { key: 'smtp_port', value: process.env.SMTP_PORT || '587' },
      { key: 'smtp_user', value: process.env.SMTP_USER || 'resend' },
      { key: 'smtp_secure', value: 'false' }
    ];

    for (const setting of smtpSettings) {
      await pool.query(`
        INSERT INTO system_settings (key, value, type, description, is_protected)
        VALUES ($1, $2, 'string', $3, false)
        ON CONFLICT (key) 
        DO UPDATE SET value = $2, updated_at = NOW()
      `, [
        setting.key, 
        setting.value, 
        `SMTP setting for ${setting.key}`
      ]);
      
      console.log(`✅ Updated ${setting.key}: ${setting.value}`);
    }

    console.log("\n2️⃣ Environment Variables Status:");
    console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || '❌ Not set'}`);
    console.log(`   SMTP_USER: ${process.env.SMTP_USER || '❌ Not set'}`);
    console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? '✅ Set' : '❌ Not set'}`);

    console.log("\n✨ Database settings updated with Sharp Note branding!");
    
    console.log("\n🚨 IMPORTANT: Resend Account Configuration");
    console.log("If you're using Resend as your SMTP provider, you need to:");
    console.log("1. Log into your Resend dashboard (https://resend.com/dashboard)");
    console.log("2. Go to 'Domains' section");
    console.log("3. Find your domain configuration");
    console.log("4. Update the 'From Name' to 'Sharp Note'");
    console.log("5. Or add/verify a domain with Sharp Note as the sender name");
    
    console.log("\n🔧 Alternative Solutions:");
    console.log("Option 1: Update Resend Domain Settings");
    console.log("  • Visit: https://resend.com/domains");
    console.log("  • Update sender name for your domain");
    
    console.log("\nOption 2: Use Direct Resend API (Recommended)");
    console.log("  • Add RESEND_API_KEY to your environment");
    console.log("  • The system will use Resend's native API with proper sender names");
    
    console.log("\nOption 3: Switch to Different SMTP Provider");
    console.log("  • Gmail: Set SMTP_HOST=smtp.gmail.com, use App Password");
    console.log("  • SendGrid: Set SMTP_HOST=smtp.sendgrid.net");
    console.log("  • Your Domain: Use your hosting provider's SMTP");

    console.log("\n📧 Next Steps:");
    console.log("1. Update your Resend account settings OR");
    console.log("2. Set RESEND_API_KEY environment variable OR");
    console.log("3. Switch to a different email provider");
    console.log("4. Test emails to verify the sender name shows 'Sharp Note'");

  } catch (error) {
    console.error("❌ Error fixing Resend sender name:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

fixResendSenderName(); 