import { db } from "../server/db";
import { systemSettings } from "../shared/schema";
import { eq } from "drizzle-orm";
import { emailService } from "../server/lib/email-service";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function updateEmailDomain() {
  console.log('🔧 Updating email domain configuration...\n');

  try {
    // Get the correct domain from .env
    const fromEmail = process.env.FROM_EMAIL;
    const emailFrom = process.env.EMAIL_FROM;
    
    console.log('📧 Environment variables:');
    console.log(`FROM_EMAIL: ${fromEmail}`);
    console.log(`EMAIL_FROM: ${emailFrom}`);
    
    if (!fromEmail) {
      console.log('❌ FROM_EMAIL not found in .env file');
      return;
    }

    // Update the database settings with correct domain
    const settingsToUpdate = [
      { key: 'from_email', value: fromEmail, description: 'From email address' },
      { key: 'smtp_host', value: 'smtp.resend.com', description: 'Resend SMTP host' },
      { key: 'smtp_port', value: '587', description: 'Resend SMTP port' },
      { key: 'smtp_user', value: 'resend', description: 'Resend SMTP username' },
      { key: 'smtp_pass', value: process.env.SMTP_PASS, description: 'Resend API key', isProtected: true },
      { key: 'smtp_secure', value: 'false', description: 'Use STARTTLS for Resend' },
      { key: 'from_name', value: process.env.FROM_NAME || 'Sharp Note', description: 'From display name' },
      { key: 'email_provider', value: 'smtp', description: 'Email provider preference' }
    ];

    console.log('\n📝 Updating database settings...');
    
    for (const setting of settingsToUpdate) {
      if (!setting.value && setting.key !== 'from_name') continue;
      
      const existing = await db.select()
        .from(systemSettings)
        .where(eq(systemSettings.key, setting.key))
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(systemSettings)
          .set({
            value: setting.value,
            description: setting.description,
            isProtected: setting.isProtected || false,
            updatedAt: new Date()
          })
          .where(eq(systemSettings.key, setting.key));
        console.log(`✅ Updated ${setting.key}: ${setting.key === 'smtp_pass' ? '***' : setting.value}`);
      } else {
        await db.insert(systemSettings)
          .values({
            key: setting.key,
            value: setting.value,
            type: 'string',
            description: setting.description,
            isProtected: setting.isProtected || false
          });
        console.log(`✅ Created ${setting.key}: ${setting.key === 'smtp_pass' ? '***' : setting.value}`);
      }
    }

    // Clear email service cache to force reload
    emailService.clearCache();
    console.log('✅ Email service cache cleared');

    console.log('\n🧪 Testing email with correct domain...');
    
    try {
      await emailService.sendEmail({
        to: 'test@sharpnote.net', // Use your domain for testing
        subject: '✅ Domain Fix Test - Job Creation Emails',
        html: `
          <h2>✅ Email Configuration Fixed!</h2>
          <p>From: ${fromEmail}</p>
          <p>If you receive this email, job creation emails should now work correctly.</p>
          <p>Domain: sharpnote.net</p>
        `,
        text: `Email Configuration Fixed! From: ${fromEmail}. Job creation emails should now work.`
      });
      
      console.log('✅ EMAIL SENT SUCCESSFULLY!');
      console.log('✅ Job creation emails should now work!');
      
    } catch (error) {
      console.log('❌ Email test failed:', error instanceof Error ? error.message : 'Unknown error');
      
      if (error instanceof Error && error.message.includes('450')) {
        console.log('\n🔍 Domain verification needed:');
        console.log('1. Go to https://resend.com/domains');
        console.log('2. Add and verify "sharpnote.net"');
        console.log('3. Or use a verified domain in FROM_EMAIL');
      }
    }

  } catch (error) {
    console.error('❌ Error updating email domain:', error);
    throw error;
  }
}

updateEmailDomain();
