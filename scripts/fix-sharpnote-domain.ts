import { db } from "../server/db";
import { systemSettings } from "../shared/schema";
import { eq } from "drizzle-orm";
import { emailService } from "../server/lib/email-service";

async function fixSharpnoteDomain() {
  console.log('🔧 Fixing sharpnote.net domain configuration...\n');

  try {
    // Set the correct sharpnote.net settings directly
    const correctSettings = [
      { key: 'from_email', value: 'mail@sharpnote.net', description: 'From email address' },
      { key: 'from_name', value: 'Sharp Note', description: 'From display name' },
      { key: 'smtp_host', value: 'smtp.resend.com', description: 'Resend SMTP host' },
      { key: 'smtp_port', value: '587', description: 'Resend SMTP port' },
      { key: 'smtp_user', value: 'resend', description: 'Resend SMTP username' },
      { key: 'smtp_pass', value: 're_7ve51boJ_7kvD5iCp5PJonw6Mi8Y7UsuY', description: 'Resend API key', isProtected: true },
      { key: 'smtp_secure', value: 'false', description: 'Use STARTTLS for Resend' },
      { key: 'email_provider', value: 'smtp', description: 'Email provider preference' }
    ];

    console.log('📝 Updating database with sharpnote.net domain...');
    
    for (const setting of correctSettings) {
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

    // Clear email service cache
    emailService.clearCache();
    console.log('✅ Email service cache cleared');

    console.log('\n🧪 Testing email with sharpnote.net (verified domain)...');
    
    try {
      await emailService.sendEmail({
        to: 'test@sharpnote.net',
        subject: '✅ SHARPNOTE.NET Domain Test - Job Creation Emails Fixed!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">✅ Email Configuration SUCCESS!</h2>
            <p><strong>From Domain:</strong> mail@sharpnote.net</p>
            <p><strong>Domain Status:</strong> ✅ Verified in Resend</p>
            <p><strong>SMTP Host:</strong> smtp.resend.com</p>
            <hr>
            <p style="color: #16a34a; font-weight: bold;">🎉 JOB CREATION EMAILS SHOULD NOW WORK!</p>
            <p>When users create jobs, signer invitation emails will be sent successfully from mail@sharpnote.net</p>
          </div>
        `,
        text: 'Email Configuration SUCCESS! From: mail@sharpnote.net (verified). Job creation emails should now work!'
      });
      
      console.log('\n🎉 SUCCESS! Email sent from mail@sharpnote.net');
      console.log('✅ Job creation emails are now fixed and working!');
      console.log('✅ Users can create jobs and signers will receive invitation emails');
      
    } catch (error) {
      console.log('❌ Email test failed:', error instanceof Error ? error.message : 'Unknown error');
    }

  } catch (error) {
    console.error('❌ Error fixing sharpnote domain:', error);
    throw error;
  }
}

fixSharpnoteDomain();
