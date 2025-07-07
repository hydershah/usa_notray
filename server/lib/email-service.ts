import { Client as PostmarkClient } from 'postmark';
import { db } from '../db';
import { systemSettings } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface EmailSettings {
  // Keep SMTP as fallback, add Postmark settings
  postmark_api_key?: string;
  postmark_from_email?: string;
  postmark_from_name?: string;
  postmark_track_opens?: string;
  postmark_track_links?: string;
  postmark_message_stream?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_secure?: string;
  from_email?: string;
  from_name?: string;
  email_provider?: string; // 'postmark' or 'smtp'
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  tag?: string;
}

class EmailService {
  private postmarkClient: PostmarkClient | null = null;
  private settings: EmailSettings | null = null;

  // Method to clear cache and force reload of settings
  public clearCache(): void {
    this.settings = null;
    this.postmarkClient = null;
  }

  private async loadSettings(): Promise<EmailSettings> {
    if (this.settings) return this.settings;

    try {
      const settingsData = await db.select().from(systemSettings);
      const settings: Partial<EmailSettings> = {};
      
      settingsData.forEach(setting => {
        if (setting.key.startsWith('smtp_') || setting.key.startsWith('from_') || setting.key.startsWith('postmark_') || setting.key === 'email_provider') {
          settings[setting.key as keyof EmailSettings] = setting.value;
        }
      });

      // Fallback to environment variables if database settings don't exist
      this.settings = {
        // Postmark settings (preferred)
        postmark_api_key: settings.postmark_api_key || process.env.POSTMARK_API_KEY || '',
        postmark_from_email: settings.postmark_from_email || process.env.POSTMARK_FROM_EMAIL || settings.from_email || process.env.FROM_EMAIL || 'mail@sharpnote.net',
        postmark_from_name: settings.postmark_from_name || process.env.POSTMARK_FROM_NAME || settings.from_name || process.env.FROM_NAME || 'Sharp Note',
        postmark_track_opens: settings.postmark_track_opens || process.env.POSTMARK_TRACK_OPENS || 'true',
        postmark_track_links: settings.postmark_track_links || process.env.POSTMARK_TRACK_LINKS || 'HtmlAndText',
        postmark_message_stream: settings.postmark_message_stream || process.env.POSTMARK_MESSAGE_STREAM || 'sharpnote',
        
        // SMTP fallback settings
        smtp_host: settings.smtp_host || process.env.SMTP_HOST || 'smtp.hostinger.com',
        smtp_port: settings.smtp_port || process.env.SMTP_PORT || '465',
        smtp_user: settings.smtp_user || process.env.SMTP_USER || '',
        smtp_pass: settings.smtp_pass || process.env.SMTP_PASS || '',
        smtp_secure: settings.smtp_secure || (process.env.SMTP_PORT === '465' ? 'true' : 'false'),
        from_email: settings.from_email || process.env.SMTP_USER || 'noreply@usanotaryservices.com',
        from_name: settings.from_name || 'Sharp Note',
        
        // Email provider preference
        email_provider: settings.email_provider || process.env.EMAIL_PROVIDER || 'postmark'
      };

      return this.settings;
    } catch (error) {
      console.error('Failed to load email settings:', error);
      throw new Error('Email configuration not available');
    }
  }

  private async createPostmarkClient(): Promise<PostmarkClient> {
    if (this.postmarkClient) return this.postmarkClient;

    const settings = await this.loadSettings();
    
    if (!settings.postmark_api_key) {
      throw new Error('Postmark API key not configured');
    }

    this.postmarkClient = new PostmarkClient(settings.postmark_api_key);
    return this.postmarkClient;
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const settings = await this.loadSettings();
    
    // Try Postmark first if configured
    if (settings.email_provider === 'postmark' && settings.postmark_api_key) {
      try {
        await this.sendViaPostmark(options);
        return;
      } catch (error) {
        console.error('Postmark failed, falling back to SMTP:', error);
        // Fall back to SMTP if Postmark fails
      }
    }
    
    // Fallback to SMTP (existing implementation)
    await this.sendViaSMTP(options);
  }

  private async sendViaPostmark(options: EmailOptions): Promise<void> {
    try {
      const client = await this.createPostmarkClient();
      const settings = await this.loadSettings();

      const result = await client.sendEmail({
        From: `${settings.postmark_from_name} <${settings.postmark_from_email}>`,
        To: options.to,
        Subject: options.subject,
        HtmlBody: options.html,
        TextBody: options.text,
        ReplyTo: options.replyTo || settings.postmark_from_email,
        Tag: options.tag || 'system-email',
        TrackOpens: settings.postmark_track_opens === 'true',
        TrackLinks: settings.postmark_track_links as any,
        MessageStream: settings.postmark_message_stream || 'sharpnote',
        Headers: options.headers ? Object.entries(options.headers).map(([Name, Value]) => ({ Name, Value })) : undefined
      });

      console.log(`✅ Postmark email sent successfully: ${result.MessageID}`);
      
    } catch (error) {
      console.error('❌ Postmark email sending failed:', error);
      throw new Error(`Failed to send email via Postmark: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async sendViaSMTP(options: EmailOptions): Promise<void> {
    // Keep existing nodemailer implementation as fallback
    const nodemailer = await import('nodemailer');
    const settings = await this.loadSettings();
    
    if (!settings.smtp_user || !settings.smtp_pass) {
      throw new Error('SMTP credentials not configured');
    }

    const transporter = nodemailer.default.createTransport({
      host: settings.smtp_host,
      port: parseInt(settings.smtp_port || '465'),
      secure: settings.smtp_secure === 'true',
      auth: {
        user: settings.smtp_user,
        pass: settings.smtp_pass
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });

    const mailOptions = {
      from: `"${settings.from_name}" <${settings.from_email}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || settings.from_email,
      headers: options.headers
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ SMTP email sent successfully: ${info.messageId}`);
  }

  // Professional email templates
  private getBaseTemplate(content: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sharp Note</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0; 
                background-color: #f5f5f5;
            }
            .container { 
                max-width: 600px; 
                margin: 20px auto; 
                background: white; 
                border-radius: 8px; 
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
                background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); 
                color: white; 
                padding: 30px 20px; 
                text-align: center; 
            }
            .header h1 { 
                margin: 0; 
                font-size: 24px; 
                font-weight: 600; 
            }
            .content { 
                padding: 30px 20px; 
            }
            .footer { 
                background: #f8fafc; 
                padding: 20px; 
                text-align: center; 
                font-size: 12px; 
                color: #6b7280;
                border-top: 1px solid #e5e7eb;
            }
            .button { 
                display: inline-block; 
                background: #1e40af; 
                color: white; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 6px; 
                font-weight: 600;
                margin: 20px 0;
            }
            .button:hover { 
                background: #1d4ed8; 
            }
            .info-box { 
                background: #f0f9ff; 
                border-left: 4px solid #3b82f6; 
                padding: 15px; 
                margin: 20px 0; 
                border-radius: 4px;
            }
            .warning-box { 
                background: #fef3c7; 
                border-left: 4px solid #f59e0b; 
                padding: 15px; 
                margin: 20px 0; 
                border-radius: 4px;
            }
            .success-box { 
                background: #f0fdf4; 
                border-left: 4px solid #10b981; 
                padding: 15px; 
                margin: 20px 0; 
                border-radius: 4px;
            }
            @media only screen and (max-width: 600px) {
                .container { margin: 10px; }
                .header, .content { padding: 20px 15px; }
                .header h1 { font-size: 20px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 0; text-align: center;">
              <h1>🏛️ Sharp Note</h1>
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
                <p><strong>Sharp Note</strong> | Digital Notarization</p>
                <p>This is an automated message from our secure notarization platform.</p>
                <p>© ${new Date().getFullYear()} Sharp Note. All rights reserved.</p>
                <p style="margin-top: 10px;">
                    <a href="mailto:support@usanotaryservices.com" style="color: #6b7280;">Support</a> | 
                    <a href="#" style="color: #6b7280;">Privacy Policy</a> | 
                    <a href="mailto:unsubscribe@usanotaryservices.com" style="color: #6b7280;">Unsubscribe</a>
                </p>
            </div>
        </div>
    </body>
    </html>`;
  }

  async sendSignerInvitation(data: {
    signerName: string;
    signerEmail: string;
    signerRole: string;
    invitationToken: string;
    jobTitle?: string;
    titleCompany: string;
    closingType: string;
    propertyAddress?: string;
    scheduledDate?: string;
    scheduledTime?: string;
  }): Promise<void> {
    const invitationLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/sign/${data.invitationToken}`;
    
    const content = `
        <h2 style="color: #1f2937; margin-bottom: 16px;">You're Invited to a Document Signing Session</h2>
        
        <div style="background-color: #dbeafe; border: 1px solid #60a5fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #1e40af; font-weight: 600;">📋 Important: ID Verification Required</p>
          <p style="margin: 8px 0 0 0; color: #1e40af; font-size: 14px;">
            Before you can join the signing session, you must complete identity verification using a government-issued ID and selfie photo. This is required for all signers and witnesses.
          </p>
        </div>
        
        <p style="color: #374151; line-height: 1.6;">
          Dear <strong>${data.signerName}</strong>, you have been invited to participate as a <strong>${data.signerRole || 'participant'}</strong> in a notarized document signing session.
        </p>
        
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 16px;">Session Details:</h3>
          <ul style="color: #4b5563; margin: 0; padding-left: 20px;">
            <li><strong>Property:</strong> ${data.propertyAddress || 'Not specified'}</li>
            <li><strong>Closing Type:</strong> ${data.closingType || 'Not specified'}</li>
            <li><strong>Scheduled:</strong> ${data.scheduledDate || 'To be scheduled'}</li>
            <li><strong>Your Role:</strong> ${data.signerRole || 'Participant'}</li>
            <li><strong>Notary:</strong> ${data.notaryName || 'To be assigned'}</li>
          </ul>
        </div>
        
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 16px;">📝 Next Steps:</h3>
          <ol style="color: #92400e; margin: 0; padding-left: 20px; line-height: 1.6;">
            <li><strong>Create Account:</strong> Click the link below to set up your account</li>
            <li><strong>Complete ID Verification:</strong> Upload your government ID and take a selfie</li>
            <li><strong>Complete Profile:</strong> Add your address and contact information</li>
            <li><strong>Wait for Approval:</strong> Your verification will be processed quickly</li>
            <li><strong>Join Session:</strong> You'll receive a notification when the session begins</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${invitationLink}" 
             style="background-color: #2563eb; color: white; padding: 12px 24px; 
                    text-decoration: none; border-radius: 6px; font-weight: 600; 
                    display: inline-block;">
            Set Up Account & Verify Identity
          </a>
        </div>
        
        <div style="background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #047857; margin: 0 0 8px 0; font-size: 14px;">💡 What You'll Need for Verification:</h3>
          <ul style="color: #047857; margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Government-issued photo ID (Driver's License, State ID, or Passport)</li>
            <li>Camera or smartphone to take a clear selfie</li>
            <li>Good lighting for photo quality</li>
          </ul>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          Contact Email: ${data.signerEmail}. ID verification is required before joining sessions. 
          If you have questions, please contact the notary or title company.
        </p>
    `;

    await this.sendEmail({
      to: data.signerEmail,
      subject: `🏛️ Secure Document Signing Required - ${data.titleCompany}`,
      html: this.getBaseTemplate(content),
      text: `Dear ${data.signerName}, You have been invited to sign documents for ${data.titleCompany}. Please visit: ${invitationLink}`
    });
  }

  async sendUserInvitation(data: {
    userEmail: string;
    userName: string;
    role: string;
    inviteToken: string;
    invitedBy: string;
  }): Promise<void> {
    const invitationLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/register?token=${data.inviteToken}`;
    
    const content = `
        <h2 style="color: #1e40af; margin-bottom: 20px;">Platform Access Invitation</h2>
        
        <p>Dear <strong>${data.userName}</strong>,</p>
        
        <p>You have been invited to join Sharp Note platform as a <strong>${data.role}</strong> by ${data.invitedBy}.</p>
        
        <div class="info-box">
            <h3 style="margin-top: 0; color: #1e40af;">Account Details</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Email:</strong> ${data.userEmail}</li>
                <li><strong>Role:</strong> ${data.role}</li>
                <li><strong>Invited By:</strong> ${data.invitedBy}</li>
            </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" class="button">
                🚀 Complete Registration
            </a>
        </div>
        
        <p><strong>Security Note:</strong> This invitation expires in 48 hours for security purposes.</p>
        
        <p>Once registered, you'll have access to our professional notarization platform with all the tools needed for your role.</p>
        
        <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The USA Notary Services Team</strong>
        </p>
    `;

    await this.sendEmail({
      to: data.userEmail,
      subject: `🏛️ Platform Access Invitation - ${data.role}`,
      html: this.getBaseTemplate(content),
              text: `You have been invited to join Sharp Note as ${data.role}. Complete registration: ${invitationLink}`
    });
  }

  async sendAccountSetupInvitation(data: {
    signerName: string;
    signerEmail: string;
    signerRole: string;
    passwordResetToken: string;
    jobTitle?: string;
    titleCompany: string;
    closingType: string;
    propertyAddress?: string;
    scheduledDate?: string;
    scheduledTime?: string;
  }): Promise<void> {
    const accountSetupLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/set-password?token=${data.passwordResetToken}`;
    
    const content = `
        <h2 style="color: #1e40af; margin-bottom: 20px;">Account Setup Required - Document Signing</h2>
        
        <p>Dear <strong>${data.signerName}</strong>,</p>
        
        <p>An account has been created for you at Sharp Note for an upcoming document signing session. Please complete your account setup to participate in the notarization process.</p>
        
        <div class="info-box">
            <h3 style="margin-top: 0; color: #1e40af;">Session Details</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
                <li><strong>Title Company:</strong> ${data.titleCompany}</li>
                <li><strong>Document Type:</strong> ${data.closingType}</li>
                <li><strong>Your Role:</strong> ${data.signerRole}</li>
                ${data.propertyAddress ? `<li><strong>Property:</strong> ${data.propertyAddress}</li>` : ''}
                ${data.scheduledDate ? `<li><strong>Scheduled Date:</strong> ${data.scheduledDate}</li>` : ''}
                ${data.scheduledTime ? `<li><strong>Scheduled Time:</strong> ${data.scheduledTime}</li>` : ''}
            </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${accountSetupLink}" class="button">
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
        
        <p><strong>Security Note:</strong> This account setup link expires in 24 hours. After setting up your account, you'll receive a separate invitation when the signing session is ready.</p>
        
        <p>Your account email is: <strong>${data.signerEmail}</strong></p>
        
        <p>If you have any questions about the account setup or verification process, please contact us at <a href="mailto:support@usanotaryservices.com">support@usanotaryservices.com</a>.</p>
        
        <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The USA Notary Services Team</strong><br>
            <em>Secure. Verified. Professional.</em>
        </p>
    `;

    await this.sendEmail({
      to: data.signerEmail,
      subject: `🏛️ Account Setup Required - ${data.titleCompany} Document Signing`,
      html: this.getBaseTemplate(content),
      text: `Account created for ${data.titleCompany} document signing. Complete setup: ${accountSetupLink}. Email: ${data.signerEmail}. ID verification required before joining sessions.`
    });
  }

  async sendPasswordReset(data: {
    userEmail: string;
    userName: string;
    resetToken: string;
  }): Promise<void> {
    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${data.resetToken}`;
    
    const content = `
        <h2 style="color: #1e40af; margin-bottom: 20px;">Password Reset Request</h2>
        
        <p>Dear <strong>${data.userName}</strong>,</p>
        
        <p>We received a request to reset your password for Sharp Note platform.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" class="button">
                🔑 Reset Password
            </a>
        </div>
        
        <div class="warning-box">
            <p><strong>⚠️ Security Information:</strong></p>
            <ul style="margin: 10px 0;">
                <li>This link expires in 1 hour for security</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password remains unchanged until you complete the reset</li>
            </ul>
        </div>
        
        <p>If you continue to have issues, please contact our support team at <a href="mailto:support@usanotaryservices.com">support@usanotaryservices.com</a>.</p>
        
        <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The USA Notary Services Team</strong>
        </p>
    `;

    await this.sendEmail({
      to: data.userEmail,
      subject: `🔑 Password Reset - Sharp Note`,
      html: this.getBaseTemplate(content),
      text: `Password reset requested for Sharp Note. Reset your password: ${resetLink}`
    });
  }

  // Force refresh settings (useful after database updates)
  public async refreshSettings(): Promise<void> {
    this.clearCache();
    await this.loadSettings();
  }

  async testConfiguration(testEmail: string): Promise<string> {
    // Clear cache to ensure we use the latest settings from database
    this.clearCache();
    
    const content = `
        <h2 style="color: #10b981; margin-bottom: 20px;">✅ Email Configuration Test</h2>
        
        <p>Congratulations! Your email configuration is working perfectly.</p>
        
        <div class="success-box">
            <h3 style="margin-top: 0;">📧 Test Results</h3>
            <p>If you're reading this email, your SMTP configuration is properly set up and ready for:</p>
            <ul style="margin: 10px 0;">
                <li>Signer invitations</li>
                <li>User registrations</li>
                <li>Password resets</li>
                <li>System notifications</li>
            </ul>
        </div>
        
        <p>This test was performed on: <strong>${new Date().toLocaleString()}</strong></p>
        
        <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The USA Notary Services Team</strong>
        </p>
    `;

    await this.sendEmail({
      to: testEmail,
      subject: `✅ Email Test Successful - Sharp Note`,
      html: this.getBaseTemplate(content),
      text: `Email configuration test successful! Your Sharp Note email system is ready.`
    });

    return 'Test email sent successfully';
  }
}

export const emailService = new EmailService(); 