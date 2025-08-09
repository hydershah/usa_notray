import { Client as PostmarkClient } from 'postmark';
import { db } from '../db';
import { systemSettings } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface PostmarkSettings {
  postmark_api_key: string;
  postmark_from_email: string;
  postmark_from_name: string;
  postmark_reply_to?: string;
  postmark_track_opens?: string;
  postmark_track_links?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  templateId?: string | number;
  templateModel?: Record<string, any>;
  tag?: string;
}

class PostmarkEmailService {
  private client: PostmarkClient | null = null;
  private settings: PostmarkSettings | null = null;

  // Method to clear cache and force reload of settings
  public clearCache(): void {
    this.settings = null;
    this.client = null;
  }

  private async loadSettings(): Promise<PostmarkSettings> {
    if (this.settings) return this.settings;

    try {
      const settingsData = await db.select().from(systemSettings);
      const settings: Partial<PostmarkSettings> = {};
      
      settingsData.forEach(setting => {
        if (setting.key.startsWith('postmark_')) {
          settings[setting.key as keyof PostmarkSettings] = setting.value;
        }
      });

      // Fallback to environment variables if database settings don't exist
      this.settings = {
        postmark_api_key: settings.postmark_api_key || process.env.POSTMARK_API_KEY || '',
        postmark_from_email: settings.postmark_from_email || process.env.POSTMARK_FROM_EMAIL || process.env.FROM_EMAIL || 'noreply@usanotaryservices.com',
        postmark_from_name: settings.postmark_from_name || process.env.POSTMARK_FROM_NAME || process.env.FROM_NAME || 'Sharp Note',
        postmark_reply_to: settings.postmark_reply_to || process.env.POSTMARK_REPLY_TO,
        postmark_track_opens: settings.postmark_track_opens || process.env.POSTMARK_TRACK_OPENS || 'true',
        postmark_track_links: settings.postmark_track_links || process.env.POSTMARK_TRACK_LINKS || 'HtmlAndText'
      };

      return this.settings;
    } catch (error) {
      console.error('Failed to load Postmark settings:', error);
      throw new Error('Postmark configuration not available');
    }
  }

  private async createClient(): Promise<PostmarkClient> {
    if (this.client) return this.client;

    const settings = await this.loadSettings();
    
    if (!settings.postmark_api_key) {
      throw new Error('Postmark API key not configured');
    }

    this.client = new PostmarkClient(settings.postmark_api_key);
    return this.client;
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const client = await this.createClient();
      const settings = await this.loadSettings();

      // Use Postmark template if templateId is provided
      if (options.templateId) {
        const result = await client.sendEmailWithTemplate({
          TemplateId: options.templateId,
          TemplateModel: options.templateModel || {},
          From: `${settings.postmark_from_name} <${settings.postmark_from_email}>`,
          To: options.to,
          ReplyTo: options.replyTo || settings.postmark_reply_to || settings.postmark_from_email,
          Tag: options.tag || 'system-email',
          TrackOpens: settings.postmark_track_opens === 'true',
          TrackLinks: settings.postmark_track_links as any,
          Headers: options.headers ? Object.entries(options.headers).map(([Name, Value]) => ({ Name, Value })) : undefined
        });

        console.log(`Postmark template email sent successfully: ${result.MessageID}`);
      } else {
        // Send regular email
        const result = await client.sendEmail({
          From: `${settings.postmark_from_name} <${settings.postmark_from_email}>`,
          To: options.to,
          Subject: options.subject,
          HtmlBody: options.html,
          TextBody: options.text,
          ReplyTo: options.replyTo || settings.postmark_reply_to || settings.postmark_from_email,
          Tag: options.tag || 'system-email',
          TrackOpens: settings.postmark_track_opens === 'true',
          TrackLinks: settings.postmark_track_links as any,
          Headers: options.headers ? Object.entries(options.headers).map(([Name, Value]) => ({ Name, Value })) : undefined
        });

        console.log(`Postmark email sent successfully: ${result.MessageID}`);
      }
      
    } catch (error) {
      console.error('Postmark email sending failed:', error);
      throw new Error(`Failed to send email via Postmark: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Professional email templates (keeping same structure as existing service)
  private getBaseTemplate(content: string): string {
    const brandName = process.env.BRAND_NAME || 'USA Notary Services';
    const brandLogoUrl = process.env.BRAND_LOGO_URL;
    const brandColor = process.env.BRAND_PRIMARY_COLOR || '#1e40af';
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${brandName}</title>
        <style>
            :root { --brand: ${brandColor}; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                line-height: 1.6; 
                color: #111827; 
                margin: 0; 
                padding: 0; 
                background-color: #f9fafb;
            }
            .container { 
                max-width: 640px; 
                margin: 24px auto; 
                background: #ffffff; 
                border-radius: 10px; 
                overflow: hidden;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.1);
                border: 1px solid #e5e7eb;
            }
            .header { 
                background: #ffffff; 
                padding: 20px; 
                border-bottom: 1px solid #e5e7eb; 
                text-align: center; 
            }
            .brand { display: inline-flex; align-items: center; gap: 12px; }
            .brand img { height: 36px; width: auto; display: block; }
            .brand-name { font-size: 18px; font-weight: 700; color: #111827; letter-spacing: 0.2px; }
            .content { padding: 28px 24px; }
            .button { 
                display: inline-block; 
                background: var(--brand); 
                color: #ffffff; 
                padding: 12px 22px; 
                text-decoration: none; 
                border-radius: 8px; 
                font-weight: 600;
                margin: 20px 0;
            }
            .button:hover { filter: brightness(0.95); }
            .footer { 
                background: #f9fafb; 
                padding: 18px; 
                text-align: center; 
                font-size: 12px; 
                color: #6b7280;
                border-top: 1px solid #e5e7eb;
            }
            @media only screen and (max-width: 600px) {
                .container { margin: 12px; }
                .content { padding: 22px 18px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="brand">
                  ${brandLogoUrl ? `<img src="${brandLogoUrl}" alt="${brandName} logo" />` : ''}
                  <span class="brand-name">${brandName}</span>
                </div>
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
                <p><strong>${brandName}</strong> • Secure Online Notarization</p>
                <p>Questions? Email <a href="mailto:support@usanotaryservices.com" style="color: inherit; text-decoration: underline;">support@usanotaryservices.com</a></p>
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
        <p>Hi ${data.signerName},</p>
        <p>You're invited to sign documents${data.titleCompany ? ` for <strong>${data.titleCompany}</strong>` : ''} as a <strong>${data.signerRole || 'participant'}</strong>.</p>
        ${data.propertyAddress ? `<p><strong>Property:</strong> ${data.propertyAddress}</p>` : ''}
        ${(data.scheduledDate && data.scheduledTime) ? `<p><strong>Scheduled:</strong> ${data.scheduledDate} at ${data.scheduledTime}</p>` : ''}
        <p>To get ready, please set up your account. It takes just a few minutes.</p>
        <div style="text-align: center;">
          <a href="${invitationLink}" class="button">Complete Account Setup</a>
        </div>
        <p style="font-size: 13px; color: #6b7280;">If the button doesn't work, copy and paste this link into your browser:<br />${invitationLink}</p>
        <p>Thank you,<br/>${process.env.BRAND_NAME || 'USA Notary Services'}</p>
    `;

    await this.sendEmail({
      to: data.signerEmail,
      subject: `You're invited to sign${data.titleCompany ? ` – ${data.titleCompany}` : ''}`,
      html: this.getBaseTemplate(content),
      text: `Hi ${data.signerName}, you're invited to sign${data.titleCompany ? ` for ${data.titleCompany}` : ''}. Complete your setup: ${invitationLink}`,
      tag: 'signer-invitation'
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
    `;

    await this.sendEmail({
      to: data.userEmail,
      subject: `🏛️ Platform Access Invitation - ${data.role}`,
      html: this.getBaseTemplate(content),
      text: `You have been invited to join Sharp Note as ${data.role}. Complete registration: ${invitationLink}`,
      tag: 'user-invitation'
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
            <a href="${resetLink}" class="button" target="_blank" rel="noopener noreferrer">
                🔑 Reset Password
            </a>
        </div>
        
        <div class="warning-box">
            <p><strong>⚠️ Security Information:</strong></p>
            <ul style="margin: 10px 0;">
                <li>This link expires in 24 hours for security</li>
                <li>If you didn't request this reset, please ignore this email</li>
                <li>Your password remains unchanged until you complete the reset</li>
            </ul>
        </div>
    `;

    await this.sendEmail({
      to: data.userEmail,
      subject: `🔑 Password Reset - Sharp Note`,
      html: this.getBaseTemplate(content),
      text: `Password reset requested for Sharp Note. Reset your password: ${resetLink}`,
      tag: 'password-reset'
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
        <h2 style="color: #3b82f6; margin-bottom: 20px;">✅ Postmark Configuration Test</h2>
        
        <p>Congratulations! Your Postmark configuration is working perfectly.</p>
        
        <div class="success-box">
            <h3 style="margin-top: 0;">📧 Test Results</h3>
            <p>If you're reading this email, your Postmark configuration is properly set up and ready for:</p>
            <ul style="margin: 10px 0;">
                <li>Signer invitations</li>
                <li>User registrations</li>
                <li>Password resets</li>
                <li>System notifications</li>
            </ul>
        </div>
        
        <p>This test was performed on: <strong>${new Date().toLocaleString()}</strong></p>
        
        <p>✨ <strong>Postmark Benefits:</strong></p>
        <ul>
            <li>High deliverability rates</li>
            <li>Email tracking and analytics</li>
            <li>Professional templates</li>
            <li>Reliable infrastructure</li>
        </ul>
    `;

    await this.sendEmail({
      to: testEmail,
      subject: `✅ Postmark Test Successful - Sharp Note`,
      html: this.getBaseTemplate(content),
      text: `Postmark configuration test successful! Your Sharp Note email system is ready.`,
      tag: 'test-email'
    });

    return 'Postmark test email sent successfully';
  }

  // Get delivery statistics (Postmark specific feature)
  async getDeliveryStats(tag?: string): Promise<any> {
    try {
      const client = await this.createClient();
      const stats = await client.getDeliveryStats({
        tag: tag
      });
      return stats;
    } catch (error) {
      console.error('Failed to get Postmark delivery stats:', error);
      throw error;
    }
  }

  // Get email bounces (Postmark specific feature)
  async getBounces(count: number = 100): Promise<any> {
    try {
      const client = await this.createClient();
      const bounces = await client.getBounces({
        count: count
      });
      return bounces;
    } catch (error) {
      console.error('Failed to get Postmark bounces:', error);
      throw error;
    }
  }
}

export const postmarkEmailService = new PostmarkEmailService(); 