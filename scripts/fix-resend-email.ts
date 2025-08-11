#!/usr/bin/env npx tsx

import { db } from "../server/db";
import { systemSettings } from "../shared/schema";
import { eq } from "drizzle-orm";
import { emailService } from "../server/lib/email-service";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function fixResendEmail() {
  console.log('🔧 Fixing Resend Email Configuration...\n');

  try {
    // Check if Resend API key is provided
    const resendApiKey = process.env.SMTP_PASS;
    
    if (!resendApiKey || resendApiKey === 're_YOUR_RESEND_API_KEY_HERE') {
      console.log('❌ RESEND API KEY REQUIRED');
      console.log('');
      console.log('Please update your .env file with your actual Resend API key:');
      console.log('');
      console.log('1. Go to https://resend.com/api-keys');
      console.log('2. Create a new API key');
      console.log('3. Replace "re_YOUR_RESEND_API_KEY_HERE" in .env with your actual key');
      console.log('');
      console.log('Example:');
      console.log('SMTP_PASS="re_abcd1234..."');
      console.log('');
      return;
    }

    // Resend SMTP configuration
    const resendSettings = [
      { key: 'email_provider', value: 'smtp', description: 'Email provider preference' },
      { key: 'smtp_host', value: 'smtp.resend.com', description: 'Resend SMTP host' },
      { key: 'smtp_port', value: '587', description: 'Resend SMTP port' },
      { key: 'smtp_user', value: 'resend', description: 'Resend SMTP username' },
      { key: 'smtp_pass', value: resendApiKey, description: 'Resend API key', isProtected: true },
      { key: 'smtp_secure', value: 'false', description: 'Use STARTTLS for Resend' },
      { key: 'from_email', value: process.env.FROM_EMAIL || 'noreply@yourdomain.com', description: 'From email address' },
      { key: 'from_name', value: process.env.FROM_NAME || 'Sharp Note', description: 'From display name' }
    ];

    console.log('📧 Updating database with Resend settings...');
    
    let updatedCount = 0;
    let createdCount = 0;

    // Update database settings
    for (const setting of resendSettings) {
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
        console.log(`✅ Updated: ${setting.key}`);
        updatedCount++;
      } else {
        await db.insert(systemSettings)
          .values({
            key: setting.key,
            value: setting.value,
            type: 'string',
            description: setting.description,
            isProtected: setting.isProtected || false
          });
        console.log(`✅ Created: ${setting.key}`);
        createdCount++;
      }
    }

    // Clear email service cache
    emailService.clearCache();
    console.log('✅ Email service cache cleared');

    console.log(`\n🎉 Resend email configuration updated!`);
    console.log(`   📝 Created: ${createdCount} settings`);
    console.log(`   🔄 Updated: ${updatedCount} settings`);

    // Test email sending
    console.log('\n🧪 Testing email configuration...');
    const testEmail = 'test@example.com'; // You can replace with your email
    
    try {
      await emailService.testConfiguration(testEmail);
      console.log('✅ Email test completed successfully!');
    } catch (error) {
      console.log('❌ Email test failed:', error instanceof Error ? error.message : 'Unknown error');
      console.log('\nPossible issues:');
      console.log('1. Invalid Resend API key');
      console.log('2. Domain not verified in Resend');
      console.log('3. API key lacks sending permissions');
    }

    console.log('\n📋 Configuration Summary:');
    console.log('   📧 Provider: Resend SMTP');
    console.log('   🏠 Host: smtp.resend.com');
    console.log('   🔌 Port: 587 (STARTTLS)');
    console.log('   🔑 API Key: ' + (resendApiKey ? '✅ Configured' : '❌ Missing'));
    console.log('   📨 From: ' + (process.env.FROM_EMAIL || 'noreply@yourdomain.com'));

  } catch (error) {
    console.error('❌ Error fixing Resend configuration:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixResendEmail()
    .then(() => {
      console.log('\n✅ Resend email fix completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Resend email fix failed:', error);
      process.exit(1);
    });
}

export { fixResendEmail };
