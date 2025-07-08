import dotenv from 'dotenv';
import { db } from '../server/db';
import { systemSettings } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config();

async function syncEmailSettings() {
  console.log('🔄 Syncing Email Settings from Environment to Database\n');

  try {
    // Get current environment variables
    const envSettings = {
      email_provider: 'postmark', // Using postmark as primary with SMTP fallback
      smtp_host: process.env.SMTP_HOST || 'smtp.resend.com',
      smtp_port: process.env.SMTP_PORT || '587',
      smtp_user: process.env.SMTP_USER || 'resend',
      smtp_pass: process.env.SMTP_PASS || '',
      smtp_secure: 'false', // Resend uses STARTTLS on 587
      from_email: process.env.SMTP_FROM_EMAIL || 'mail@sharpnote.net',
      from_name: process.env.SMTP_FROM_NAME || 'Sharp Note',
      // Postmark settings (empty since we're using SMTP)
      postmark_api_key: '',
      postmark_from_email: process.env.SMTP_FROM_EMAIL || 'mail@sharpnote.net',
      postmark_from_name: process.env.SMTP_FROM_NAME || 'Sharp Note',
      postmark_track_opens: 'true',
      postmark_track_links: 'HtmlAndText',
      postmark_message_stream: 'sharpnote'
    };

    console.log('📧 Environment Settings to Sync:');
    console.log(`   Email Provider: smtp (fallback from postmark)`);
    console.log(`   SMTP Host: ${envSettings.smtp_host}`);
    console.log(`   SMTP Port: ${envSettings.smtp_port}`);
    console.log(`   SMTP User: ${envSettings.smtp_user}`);
    console.log(`   SMTP Pass: ${envSettings.smtp_pass ? envSettings.smtp_pass.substring(0, 10) + '...' : 'NOT SET'}`);
    console.log(`   From Email: ${envSettings.from_email}`);
    console.log(`   From Name: ${envSettings.from_name}`);

    // Check for missing critical settings
    if (!envSettings.smtp_pass) {
      console.log('\n❌ Error: SMTP_PASS is not set in environment variables');
      console.log('   Please set SMTP_PASS with your Resend API key');
      return;
    }

    if (!envSettings.from_email) {
      console.log('\n❌ Error: SMTP_FROM_EMAIL is not set in environment variables');
      console.log('   Please set SMTP_FROM_EMAIL to your verified domain email');
      return;
    }

    console.log('\n🔄 Updating Database Settings...');

    // Update each setting in the database
    const settingsToUpdate = [
      { key: 'email_provider', value: envSettings.email_provider, description: 'Email provider preference' },
      { key: 'smtp_host', value: envSettings.smtp_host, description: 'SMTP server hostname' },
      { key: 'smtp_port', value: envSettings.smtp_port, description: 'SMTP server port' },
      { key: 'smtp_user', value: envSettings.smtp_user, description: 'SMTP username/email' },
      { key: 'smtp_pass', value: envSettings.smtp_pass, description: 'SMTP password' },
      { key: 'smtp_secure', value: envSettings.smtp_secure, description: 'Use SSL/TLS for SMTP' },
      { key: 'from_email', value: envSettings.from_email, description: 'From email address' },
      { key: 'from_name', value: envSettings.from_name, description: 'From display name' },
      { key: 'postmark_api_key', value: envSettings.postmark_api_key, description: 'Postmark API key' },
      { key: 'postmark_from_email', value: envSettings.postmark_from_email, description: 'Postmark from email address' },
      { key: 'postmark_from_name', value: envSettings.postmark_from_name, description: 'Postmark from display name' },
      { key: 'postmark_track_opens', value: envSettings.postmark_track_opens, description: 'Postmark track email opens' },
      { key: 'postmark_track_links', value: envSettings.postmark_track_links, description: 'Postmark track links' },
      { key: 'postmark_message_stream', value: envSettings.postmark_message_stream, description: 'Postmark message stream' }
    ];

    for (const setting of settingsToUpdate) {
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
            description: setting.description,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, setting.key));
        
        console.log(`   ✅ Updated: ${setting.key}`);
      } else {
        // Insert new setting
        await db.insert(systemSettings).values({
          key: setting.key,
          value: setting.value,
          type: 'string',
          description: setting.description,
          isProtected: setting.key.includes('pass') || setting.key.includes('key')
        });
        
        console.log(`   ✅ Created: ${setting.key}`);
      }
    }

    console.log('\n🎉 Email settings synced successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Test the email configuration in your admin dashboard');
    console.log('2. Go to /admin/email-settings');
    console.log('3. Click "Test" to verify everything works');
    console.log('4. The application will now use these database settings');

  } catch (error) {
    console.error('\n❌ Error syncing email settings:', error);
    throw error;
  }
}

// Run the sync
syncEmailSettings().then(() => {
  console.log('\n🏁 Email settings sync completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Sync failed:', error);
  process.exit(1);
}); 