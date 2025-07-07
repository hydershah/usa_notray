import { Pool } from 'pg';

async function updateEmailTemplatesForSharpnote() {
  console.log("🎨 Updating email templates to use Sharp Note branding...\n");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    // Update platform name and branding in email template variables
    console.log("1️⃣ Updating email template variables...");
    
    // Update platform_name variable
    await pool.query(`
      UPDATE email_template_variables 
      SET default_value = 'Sharp Note' 
      WHERE variable_key = 'platform_name'
    `);
    
    console.log("✅ Updated platform_name variable to 'Sharp Note'");

    // Update all email templates to use Sharp Note branding
    console.log("\n2️⃣ Updating email templates...");

    const templates = [
      {
        key: 'signer_invitation',
        subject: '📋 Secure Document Signing Required - {{title_company}}',
        body: `<h2 style="color: #1e40af; margin-bottom: 20px;">Document Signing Invitation</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>You have been invited to participate in a professional notarization session with <strong>Sharp Note</strong>. Your secure digital signing portal is now ready.</p>

<div class="info-box">
    <h3 style="margin-top: 0; color: #1e40af;">Session Details</h3>
    <ul style="margin: 10px 0; padding-left: 20px;">
        <li><strong>Title Company:</strong> {{title_company}}</li>
        <li><strong>Document Type:</strong> {{closing_type}}</li>
        <li><strong>Your Role:</strong> {{signer_role}}</li>
        {{#if property_address}}<li><strong>Property:</strong> {{property_address}}</li>{{/if}}
        {{#if scheduled_date}}<li><strong>Scheduled Date:</strong> {{scheduled_date}}</li>{{/if}}
        {{#if scheduled_time}}<li><strong>Scheduled Time:</strong> {{scheduled_time}}</li>{{/if}}
    </ul>
</div>

<div style="text-align: center; margin: 30px 0;">
    <a href="{{invitation_link}}" class="button">
        🔐 Access Secure Signing Portal
    </a>
</div>

<div class="warning-box">
    <h4 style="margin-top: 0;">🆔 What You'll Need:</h4>
    <ul style="margin: 10px 0;">
        <li>Government-issued photo ID (Driver's License, Passport, etc.)</li>
        <li>Good lighting for identity verification</li>
        <li>Stable internet connection</li>
        <li>Computer or mobile device with camera</li>
    </ul>
</div>

<div class="success-box">
    <h4 style="margin-top: 0;">✅ Process Overview:</h4>
    <ol style="margin: 10px 0;">
        <li>Identity verification with your ID document</li>
        <li>Review documents in our secure viewer</li>
        <li>Digital signature capture</li>
        <li>Live notarization with certified notary</li>
        <li>Receive completed documents instantly</li>
    </ol>
</div>

<p><strong>Security Note:</strong> This invitation link is unique to you and expires in {{expiration_time}} for security. Please do not share this link with others.</p>

<p>If you experience any issues or have questions, please contact us immediately at <a href="mailto:{{support_email}}">{{support_email}}</a> or call our support line.</p>

<p style="margin-top: 30px;">
    Best regards,<br>
    <strong>The Sharp Note Team</strong><br>
    <em>Trusted. Secure. Professional.</em>
</p>`
      },
      {
        key: 'password_reset',
        subject: '🔑 Password Reset - Sharp Note',
        body: `<h2 style="color: #1e40af; margin-bottom: 20px;">Password Reset Request</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>We received a request to reset your password for your <strong>Sharp Note</strong> account.</p>

<div style="text-align: center; margin: 30px 0;">
    <a href="{{reset_link}}" class="button">
        🔑 Reset Password
    </a>
</div>

<div class="warning-box">
    <p><strong>⚠️ Security Information:</strong></p>
    <ul style="margin: 10px 0;">
        <li>This link expires in {{expiration_time}} for security</li>
        <li>If you didn't request this reset, please ignore this email</li>
        <li>Your password remains unchanged until you complete the reset</li>
    </ul>
</div>

<p>If you continue to have issues, please contact our support team at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>

<p style="margin-top: 30px;">
    Best regards,<br>
    <strong>The Sharp Note Team</strong>
</p>`
      },
      {
        key: 'account_setup',
        subject: '🏛️ Account Setup Required - {{title_company}} Document Signing',
        body: `<h2 style="color: #1e40af; margin-bottom: 20px;">Account Setup Required - Document Signing</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>An account has been created for you at <strong>Sharp Note</strong> for an upcoming document signing session. Please complete your account setup to participate in the notarization process.</p>

<div class="info-box">
    <h3 style="margin-top: 0; color: #1e40af;">Session Details</h3>
    <ul style="margin: 10px 0; padding-left: 20px;">
        <li><strong>Title Company:</strong> {{title_company}}</li>
        <li><strong>Document Type:</strong> {{closing_type}}</li>
        <li><strong>Your Role:</strong> {{signer_role}}</li>
        {{#if property_address}}<li><strong>Property:</strong> {{property_address}}</li>{{/if}}
        {{#if scheduled_date}}<li><strong>Scheduled Date:</strong> {{scheduled_date}}</li>{{/if}}
        {{#if scheduled_time}}<li><strong>Scheduled Time:</strong> {{scheduled_time}}</li>{{/if}}
    </ul>
</div>

<div style="text-align: center; margin: 30px 0;">
    <a href="{{verification_link}}" class="button">
        🔐 Complete Account Setup
    </a>
</div>

<div class="warning-box">
    <h4 style="margin-top: 0;">📋 Next Steps:</h4>
    <ol style="margin: 10px 0;">
        <li><strong>Set Your Password:</strong> Click the link above to create your password</li>
        <li><strong>Access Your Dashboard:</strong> Log in with your new credentials</li>
        <li><strong>Complete ID Verification:</strong> Upload your government ID for verification</li>
        <li><strong>Wait for Approval:</strong> Account verification is required before joining sessions</li>
        <li><strong>Join Signing Session:</strong> Once verified, you'll be able to participate</li>
    </ol>
</div>

<div class="success-box">
    <h4 style="margin-top: 0;">🆔 ID Verification Process:</h4>
    <p>Before you can participate in any signing sessions, you'll need to complete identity verification in your dashboard using:</p>
    <ul style="margin: 10px 0;">
        <li>Government-issued photo ID (Driver's License, Passport, etc.)</li>
        <li>Selfie verification for face matching</li>
        <li>Professional verification through EVS Solutions</li>
    </ul>
    <p><strong>Important:</strong> You cannot join any signing sessions until your identity is verified and approved.</p>
</div>

<p><strong>Security Note:</strong> This account setup link expires in {{expiration_time}}. After setting up your account, you'll receive a separate invitation when the signing session is ready.</p>

<p>Your account email is: <strong>{{user_email}}</strong></p>

<p>If you have any questions about the account setup or verification process, please contact us at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>

<p style="margin-top: 30px;">
    Best regards,<br>
    <strong>The Sharp Note Team</strong><br>
    <em>Secure. Verified. Professional.</em>
</p>`
      },
      {
        key: 'user_invitation',
        subject: '🏛️ Platform Access Invitation - {{signer_role}}',
        body: `<h2 style="color: #1e40af; margin-bottom: 20px;">Platform Access Invitation</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>You have been invited to join the <strong>Sharp Note</strong> platform as a <strong>{{signer_role}}</strong> by {{invited_by}}.</p>

<div class="info-box">
    <h3 style="margin-top: 0; color: #1e40af;">Account Details</h3>
    <ul style="margin: 10px 0; padding-left: 20px;">
        <li><strong>Email:</strong> {{user_email}}</li>
        <li><strong>Role:</strong> {{signer_role}}</li>
        <li><strong>Invited By:</strong> {{invited_by}}</li>
    </ul>
</div>

<div style="text-align: center; margin: 30px 0;">
    <a href="{{invitation_link}}" class="button">
        🚀 Complete Registration
    </a>
</div>

<p><strong>Security Note:</strong> This invitation expires in {{expiration_time}} for security purposes.</p>

<p>Once registered, you'll have access to our professional notarization platform with all the tools needed for your role.</p>

<p style="margin-top: 30px;">
    Best regards,<br>
    <strong>The Sharp Note Team</strong>
</p>`
      },
      {
        key: 'job_assignment',
        subject: '📋 New Job Assignment - Job #{{job_id}}',
        body: `<h2 style="color: #1e40af; margin-bottom: 20px;">New Job Assignment</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>You have been assigned to a new notarization job on the <strong>Sharp Note</strong> platform. Please review the details below and respond promptly.</p>

<div class="info-box">
    <h3 style="margin-top: 0; color: #1e40af;">Job Details</h3>
    <ul style="margin: 10px 0; padding-left: 20px;">
        <li><strong>Job ID:</strong> #{{job_id}}</li>
        <li><strong>Title Company:</strong> {{title_company}}</li>
        <li><strong>Document Type:</strong> {{closing_type}}</li>
        <li><strong>Priority:</strong> {{priority}}</li>
        {{#if property_address}}<li><strong>Property:</strong> {{property_address}}</li>{{/if}}
        {{#if scheduled_date}}<li><strong>Scheduled Date:</strong> {{scheduled_date}}</li>{{/if}}
        {{#if scheduled_time}}<li><strong>Scheduled Time:</strong> {{scheduled_time}}</li>{{/if}}
        {{#if deadline}}<li><strong>Deadline:</strong> {{deadline}}</li>{{/if}}
    </ul>
</div>

<div style="text-align: center; margin: 30px 0;">
    <a href="{{invitation_link}}" class="button">
        📋 Review Job Assignment
    </a>
</div>

<div class="warning-box">
    <h4 style="margin-top: 0;">⏰ Action Required:</h4>
    <p>Please respond to this assignment within 2 hours. If you cannot accept this job, please decline so it can be reassigned to another qualified notary.</p>
</div>

<p>If you have any questions about this assignment, please contact us at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>

<p style="margin-top: 30px;">
    Best regards,<br>
    <strong>The Sharp Note Team</strong>
</p>`
      }
    ];

    // Update each template
    for (const template of templates) {
      await pool.query(`
        UPDATE email_templates 
        SET 
          subject_template = $1,
          body_template = $2,
          updated_at = NOW()
        WHERE template_key = $3
      `, [template.subject, template.body, template.key]);
      
      console.log(`✅ Updated ${template.key} template`);
    }

    // Update preview data to use Sharp Note
    console.log("\n3️⃣ Updating preview data...");
    
    await pool.query(`
      UPDATE email_templates 
      SET preview_data = jsonb_set(
        preview_data, 
        '{platform_name}', 
        '"Sharp Note"'
      )
      WHERE preview_data ? 'platform_name'
    `);

    console.log("✅ Updated preview data to use Sharp Note");

    // Update default variables
    console.log("\n4️⃣ Updating default variables...");
    
    await pool.query(`
      UPDATE email_template_variables 
      SET default_value = 'support@sharpnote.net' 
      WHERE variable_key = 'support_email'
    `);

    console.log("✅ Updated support_email to support@sharpnote.net");

    console.log("\n✨ Email templates successfully updated with Sharp Note branding!");
    console.log("\n📧 Templates updated:");
    templates.forEach(template => {
      console.log(`  • ${template.key}: ${template.subject}`);
    });

    console.log("\n🔧 Next steps:");
    console.log("  1. Test email templates via admin dashboard");
    console.log("  2. Send test emails to verify branding");
    console.log("  3. All future emails will use Sharp Note branding");

  } catch (error) {
    console.error("❌ Error updating email templates:", error);
  } finally {
    await pool.end();
    process.exit();
  }
}

updateEmailTemplatesForSharpnote(); 