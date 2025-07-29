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

  // Helper function to get the client URL dynamically
  private getClientUrl(): string {
    // Priority order for determining client URL:
    // 1. CLIENT_URL environment variable (highest priority)
    // 2. Detect from common deployment environment variables
    // 3. Build from HOST and PORT if available
    // 4. Default to localhost for development
    
    if (process.env.CLIENT_URL) {
      console.log(`✅ Using configured CLIENT_URL: ${process.env.CLIENT_URL}`);
      return process.env.CLIENT_URL;
    }
    
    // Enhanced Railway.com detection with multiple domain support
    if (process.env.RAILWAY_STATIC_URL) {
      console.log(`✅ Using Railway static URL: ${process.env.RAILWAY_STATIC_URL}`);
      return process.env.RAILWAY_STATIC_URL;
    }
    
    // Railway Public URL (custom domains)
    if (process.env.RAILWAY_PUBLIC_URL) {
      console.log(`✅ Using Railway public URL: ${process.env.RAILWAY_PUBLIC_URL}`);
      return process.env.RAILWAY_PUBLIC_URL;
    }
    
    // Railway Service URL (auto-generated)
    if (process.env.RAILWAY_SERVICE_URL) {
      console.log(`✅ Using Railway service URL: ${process.env.RAILWAY_SERVICE_URL}`);
      return process.env.RAILWAY_SERVICE_URL;
    }
    
    // Railway Environment-specific URL construction
    if (process.env.RAILWAY_ENVIRONMENT_NAME && process.env.RAILWAY_PROJECT_NAME) {
      const envName = process.env.RAILWAY_ENVIRONMENT_NAME;
      const projectName = process.env.RAILWAY_PROJECT_NAME;
      
      // Handle different environment patterns
      let constructedUrl;
      if (envName === 'production') {
        constructedUrl = `https://${projectName}.up.railway.app`;
      } else {
        constructedUrl = `https://${projectName}-${envName}.up.railway.app`;
      }
      console.log(`✅ Using constructed Railway URL: ${constructedUrl}`);
      return constructedUrl;
    }
    
    // Auto-detect from common deployment platforms
    if (process.env.VERCEL_URL) {
      const vercelUrl = `https://${process.env.VERCEL_URL}`;
      console.log(`✅ Using Vercel URL: ${vercelUrl}`);
      return vercelUrl;
    }
    
    if (process.env.NETLIFY_URL) {
      console.log(`✅ Using Netlify URL: ${process.env.NETLIFY_URL}`);
      return process.env.NETLIFY_URL;
    }
    
    if (process.env.RENDER_EXTERNAL_URL) {
      console.log(`✅ Using Render URL: ${process.env.RENDER_EXTERNAL_URL}`);
      return process.env.RENDER_EXTERNAL_URL;
    }
    
    // Heroku detection
    if (process.env.HEROKU_APP_NAME) {
      const herokuUrl = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
      console.log(`✅ Using Heroku URL: ${herokuUrl}`);
      return herokuUrl;
    }
    
    // Generic environment detection
    if (process.env.APP_URL) {
      console.log(`✅ Using APP_URL: ${process.env.APP_URL}`);
      return process.env.APP_URL;
    }
    
    if (process.env.FRONTEND_URL) {
      console.log(`✅ Using FRONTEND_URL: ${process.env.FRONTEND_URL}`);
      return process.env.FRONTEND_URL;
    }
    
    // Build from HOST and PORT if available
    if (process.env.HOST && process.env.PORT) {
      const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
      const hostUrl = `${protocol}://${process.env.HOST}:${process.env.PORT}`;
      console.log(`✅ Using HOST:PORT URL: ${hostUrl}`);
      return hostUrl;
    }
    
    // Development fallback
    const isProduction = process.env.NODE_ENV === 'production';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isProduction) {
      // Log warning for production without proper URL configuration
      console.warn('⚠️ CRITICAL: CLIENT_URL not configured for production environment!');
      console.warn('⚠️ Please set CLIENT_URL environment variable to your production domain');
      console.warn('⚠️ Email links may not work correctly without proper URL configuration');
      return 'https://localhost:3000'; // HTTPS for production
    }
    
    // Development default - using port 3002 as specified by user
    console.log(`✅ Using development default: http://localhost:3002`);
    return 'http://localhost:3002'; // Frontend runs on port 3002
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
    notaryName?: string;
  }): Promise<void> {
    // CRITICAL FIX: Check if user already exists to send appropriate email
    const { db } = await import('../db');
    const { users } = await import('../../shared/schema');
    const { eq } = await import('drizzle-orm');
    
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.signerEmail))
      .limit(1);
    
    const isNewUser = !existingUser;
    console.log(`📧 Sending ${isNewUser ? 'NEW USER' : 'EXISTING USER'} invitation to ${data.signerEmail}`);
    
    if (isNewUser) {
      // NEW USER: Send account setup email
      await this.sendNewUserSignerInvitation(data);
    } else {
      // EXISTING USER: Send job notification email  
      await this.sendExistingUserJobNotification(data, existingUser);
    }
  }

  async sendNewUserSignerInvitation(data: {
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
    notaryName?: string;
  }): Promise<void> {
    // NEW USER: Goes to account setup page with invitation token
    const setupLink = `${this.getClientUrl()}/setup-account/${data.invitationToken}`;
    
    const content = `
        <h2 style="color: #1f2937; margin-bottom: 16px;">Welcome! You're Invited to Sign Documents</h2>
        
        <div style="background-color: #dbeafe; border: 1px solid #60a5fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #1e40af; font-weight: 600;">👋 New to our platform? Let's get you set up!</p>
          <p style="margin: 8px 0 0 0; color: #1e40af; font-size: 14px;">
            We'll guide you through creating your account and completing identity verification in just a few minutes.
          </p>
        </div>
        
        <p style="color: #374151; line-height: 1.6;">
          Dear <strong>${data.signerName}</strong>, you have been invited to participate as a <strong>${data.signerRole || 'participant'}</strong> in a notarized document signing session for <strong>${data.titleCompany}</strong>.
        </p>
        
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 16px;">📋 Session Details:</h3>
          <ul style="color: #4b5563; margin: 0; padding-left: 20px;">
            <li><strong>Title Company:</strong> ${data.titleCompany}</li>
            <li><strong>Closing Type:</strong> ${data.closingType || 'Document Signing'}</li>
            <li><strong>Property:</strong> ${data.propertyAddress || 'Not specified'}</li>
            <li><strong>Scheduled:</strong> ${data.scheduledDate && data.scheduledTime ? `${data.scheduledDate} at ${data.scheduledTime}` : 'To be scheduled'}</li>
            <li><strong>Your Role:</strong> ${data.signerRole || 'Participant'}</li>
            ${data.notaryName ? `<li><strong>Notary:</strong> ${data.notaryName}</li>` : ''}
          </ul>
        </div>
        
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 16px;">🚀 Get Started - 4 Easy Steps:</h3>
          <ol style="color: #92400e; margin: 0; padding-left: 20px; line-height: 1.6;">
            <li><strong>Create Account:</strong> Click the link below to set up your secure account</li>
            <li><strong>Complete ID Verification:</strong> Upload your government ID and take a selfie</li>
            <li><strong>Complete Profile:</strong> Add your address and contact information</li>
            <li><strong>Wait for Session:</strong> You'll be notified when the notary is ready to begin</li>
          </ol>
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${setupLink}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; font-weight: 600; 
                    display: inline-block; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-size: 16px;">
            🏛️ Set Up Account & Verify Identity
          </a>
        </div>
        
        <div style="background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #047857; margin: 0 0 8px 0; font-size: 14px;">📄 What You'll Need for Verification:</h3>
          <ul style="color: #047857; margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Government-issued photo ID (Driver's License, State ID, or Passport)</li>
            <li>Camera or smartphone to take a clear selfie</li>
            <li>Good lighting for photo quality</li>
            <li>Valid email address and phone number</li>
          </ul>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          Contact Email: ${data.signerEmail}. Identity verification is required before joining sessions. 
          If you have questions, please contact ${data.titleCompany} or reply to this email.
        </p>
    `;

    await this.sendEmail({
      to: data.signerEmail,
      subject: `🏛️ Account Setup Required - Document Signing for ${data.titleCompany}`,
      html: this.getBaseTemplate(content),
      text: `Welcome ${data.signerName}! You've been invited to sign documents for ${data.titleCompany}. Please set up your account: ${setupLink}`,
      tag: 'signer-invitation-new-user'
    });
  }

  async sendExistingUserJobNotification(data: {
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
    notaryName?: string;
  }, existingUser: any): Promise<void> {
    // EXISTING USER: Goes to dashboard to see new job, or job details page
    const dashboardLink = `${this.getClientUrl()}/dashboard`;
    const jobDetailsLink = `${this.getClientUrl()}/jobs/invited`; // Shows invited jobs
    
    const needsVerification = !existingUser.isVerified && !existingUser.isVerificationBypassed && !existingUser.notaryVerificationBypassed;
    const needsAccountSetup = !existingUser.accountSetupComplete;
    
    let actionRequired = '';
    let actionButton = '';
    let primaryLink = dashboardLink;
    
    if (needsAccountSetup) {
      actionRequired = `
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">⚠️ Action Required: Complete Account Setup</p>
          <p style="margin: 8px 0 0 0; color: #92400e; font-size: 14px;">
            Please complete your account setup before joining the signing session.
          </p>
        </div>`;
      actionButton = '🔧 Complete Account Setup';
      primaryLink = `${this.getClientUrl()}/setup-account/${data.invitationToken}`;
    } else if (needsVerification) {
      actionRequired = `
        <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #92400e; font-weight: 600;">🆔 Action Required: Complete ID Verification</p>
          <p style="margin: 8px 0 0 0; color: #92400e; font-size: 14px;">
            Please complete identity verification before joining the signing session.
          </p>
        </div>`;
      actionButton = '🆔 Complete Verification';
      primaryLink = `${this.getClientUrl()}/verification`;
    } else {
      actionRequired = `
        <div style="background-color: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #047857; font-weight: 600;">✅ Ready to Sign</p>
          <p style="margin: 8px 0 0 0; color: #047857; font-size: 14px;">
            Your account is ready. You can view the job details and wait for the notary to start the session.
          </p>
        </div>`;
      actionButton = '📋 View Job Details';
      primaryLink = jobDetailsLink;
    }
    
    const content = `
        <h2 style="color: #1f2937; margin-bottom: 16px;">New Document Signing Job Assigned</h2>
        
        <p style="color: #374151; line-height: 1.6;">
          Hello <strong>${data.signerName}</strong>, you have been assigned to a new document signing job as a <strong>${data.signerRole || 'participant'}</strong> for <strong>${data.titleCompany}</strong>.
        </p>
        
        ${actionRequired}
        
        <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #1f2937; margin: 0 0 12px 0; font-size: 16px;">📋 Job Details:</h3>
          <ul style="color: #4b5563; margin: 0; padding-left: 20px;">
            <li><strong>Title Company:</strong> ${data.titleCompany}</li>
            <li><strong>Closing Type:</strong> ${data.closingType || 'Document Signing'}</li>
            <li><strong>Property:</strong> ${data.propertyAddress || 'Not specified'}</li>
            <li><strong>Scheduled:</strong> ${data.scheduledDate && data.scheduledTime ? `${data.scheduledDate} at ${data.scheduledTime}` : 'To be scheduled'}</li>
            <li><strong>Your Role:</strong> ${data.signerRole || 'Participant'}</li>
            ${data.notaryName ? `<li><strong>Notary:</strong> ${data.notaryName}</li>` : ''}
          </ul>
        </div>
        
        <div style="text-align: center; margin: 24px 0;">
          <a href="${primaryLink}" 
             style="background-color: #2563eb; color: white; padding: 14px 28px; 
                    text-decoration: none; border-radius: 8px; font-weight: 600; 
                    display: inline-block; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-size: 16px;">
            ${actionButton}
          </a>
        </div>
        
        <div style="background-color: #f0f9ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <h3 style="color: #1e40af; margin: 0 0 8px 0; font-size: 14px;">📌 Next Steps:</h3>
          <ul style="color: #1e40af; margin: 0; padding-left: 20px; font-size: 14px;">
            <li>Complete any required verification steps</li>
            <li>Review the job details in your dashboard</li>
            <li>Wait for the notary to start the live signing session</li>
            <li>You'll receive a notification when the session begins</li>
          </ul>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          You can always access your jobs by logging into your <a href="${dashboardLink}" style="color: #2563eb;">dashboard</a>. 
          If you have questions, please contact ${data.titleCompany} or reply to this email.
        </p>
    `;

    await this.sendEmail({
      to: data.signerEmail,
      subject: `📋 New Signing Job - ${data.titleCompany} (${data.closingType})`,
      html: this.getBaseTemplate(content),
      text: `Hello ${data.signerName}, you have a new document signing job for ${data.titleCompany}. View details: ${primaryLink}`,
      tag: 'signer-invitation-existing-user'
    });
  }

  async sendUserInvitation(data: {
    userEmail: string;
    userName: string;
    role: string;
    inviteToken: string;
    invitedBy: string;
  }): Promise<void> {
    const invitationLink = `${this.getClientUrl()}/register?token=${data.inviteToken}`;
    
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
            <a href="${invitationLink}" 
               style="display: inline-block; 
                      background: #1e40af; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: 600;
                      margin: 20px 0;
                      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
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
    const accountSetupLink = `${this.getClientUrl()}/set-password?token=${data.passwordResetToken}`;
    
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
            <a href="${accountSetupLink}" 
               style="display: inline-block; 
                      background: #1e40af; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: 600;
                      margin: 20px 0;
                      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
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
    const resetLink = `${this.getClientUrl()}/reset-password?token=${data.resetToken}`;
    
    const content = `
        <h2 style="color: #1e40af; margin-bottom: 20px;">Password Reset Request</h2>
        
        <p>Dear <strong>${data.userName}</strong>,</p>
        
        <p>We received a request to reset your password for Sharp Note platform.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="display: inline-block; 
                      background: #1e40af; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: 600;
                      margin: 20px 0;
                      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
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

  async sendEmailVerificationOtp(data: {
    userEmail: string;
    otpCode: string;
    expirationMinutes: number;
  }): Promise<void> {
    const content = `
        <h2 style="color: #1e40af; margin-bottom: 20px;">🔐 Email Verification Required</h2>
        
        <p>Welcome to Sharp Note! To complete your account registration, please verify your email address using the code below:</p>
        
        <div style="text-align: center; 
                    background: #f8fafc; 
                    border: 2px solid #e2e8f0; 
                    border-radius: 12px; 
                    padding: 30px; 
                    margin: 30px 0;
                    font-family: 'Courier New', monospace;">
            <p style="font-size: 14px; color: #64748b; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">
                Your Verification Code
            </p>
            <div style="font-size: 36px; 
                        font-weight: bold; 
                        color: #1e40af; 
                        letter-spacing: 8px; 
                        margin: 15px 0;
                        text-shadow: 0 2px 4px rgba(30, 64, 175, 0.1);">
                ${data.otpCode}
            </div>
            <p style="font-size: 12px; color: #64748b; margin: 10px 0 0 0;">
                This code expires in ${data.expirationMinutes} minutes
            </p>
        </div>
        
        <div class="warning-box">
            <h4 style="margin-top: 0;">📋 Next Steps:</h4>
            <ol style="margin: 10px 0;">
                <li><strong>Enter the code above</strong> in the verification form</li>
                <li><strong>Complete your registration</strong> to access your account</li>
                <li><strong>Start using Sharp Note</strong> for professional notarization</li>
            </ol>
        </div>
        
        <div class="info-box">
            <h4 style="margin-top: 0;">🔒 Security Information:</h4>
            <p>For your security:</p>
            <ul style="margin: 10px 0;">
                <li>This verification code expires in ${data.expirationMinutes} minutes</li>
                <li>Never share this code with anyone</li>
                <li>If you didn't create this account, please ignore this email</li>
                <li>You can request a new code if this one expires</li>
            </ul>
        </div>
        
        <p>Having trouble? Contact our support team at <a href="mailto:support@sharpnote.com">support@sharpnote.com</a> for assistance.</p>
        
        <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The Sharp Note Team</strong><br>
            <em>Professional Digital Notarization</em>
        </p>
    `;

    await this.sendEmail({
      to: data.userEmail,
      subject: `🔐 Verify Your Email - Sharp Note (Code: ${data.otpCode})`,
      html: this.getBaseTemplate(content),
      text: `Verify your Sharp Note account with this code: ${data.otpCode}. This code expires in ${data.expirationMinutes} minutes.`
    });
  }

  async sendEmailVerificationLink(data: {
    userEmail: string;
    verificationToken: string;
    userName: string;
  }): Promise<void> {
    const verificationLink = `${this.getClientUrl()}/api/auth/verify-email/${data.verificationToken}`;
    
    const content = `
        <h2 style="color: #1e40af; margin-bottom: 20px;">🎉 Welcome to Sharp Note!</h2>
        
        <p>Hi ${data.userName},</p>
        
        <p>Thank you for registering with Sharp Note. To complete your account setup and start using our professional notarization services, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" 
               style="display: inline-block; 
                      background: #1e40af; 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: 600;
                      font-size: 16px;
                      margin: 20px 0;
                      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                ✅ Verify My Email Address
            </a>
        </div>
        
        <div class="info-box">
            <h4 style="margin-top: 0;">🚀 What happens next?</h4>
            <ol style="margin: 10px 0;">
                <li><strong>Click the verification button above</strong></li>
                <li><strong>Your account will be instantly activated</strong></li>
                <li><strong>You'll be redirected to your dashboard</strong></li>
                <li><strong>Start using Sharp Note for professional notarization</strong></li>
            </ol>
        </div>
        
        <div class="warning-box">
            <h4 style="margin-top: 0;">🔒 Security Information:</h4>
            <p>For your security:</p>
            <ul style="margin: 10px 0;">
                <li>This verification link expires in 24 hours</li>
                <li>This link can only be used once</li>
                <li>If you didn't create this account, please ignore this email</li>
                <li>Never share this verification link with anyone</li>
            </ul>
        </div>
        
        <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
        <p style="word-break: break-all; font-family: monospace; background: #f1f5f9; padding: 10px; border-radius: 4px; font-size: 12px;">
            ${verificationLink}
        </p>
        
        <p>Having trouble? Contact our support team at <a href="mailto:support@sharpnote.com">support@sharpnote.com</a> for assistance.</p>
        
        <p style="margin-top: 30px;">
            Best regards,<br>
            <strong>The Sharp Note Team</strong><br>
            <em>Professional Digital Notarization</em>
        </p>
    `;

    await this.sendEmail({
      to: data.userEmail,
      subject: `🎉 Welcome to Sharp Note - Verify Your Email`,
      html: this.getBaseTemplate(content),
      text: `Welcome to Sharp Note! Please verify your email by visiting: ${verificationLink}`
    });
  }

  async testConfiguration(testEmail: string): Promise<string> {
    try {
      await this.sendEmail({
        to: testEmail,
        subject: 'Email Configuration Test - USA Notary Platform',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">✅ Email Configuration Test Successful</h2>
            <p>This is a test email to verify that your email configuration is working correctly.</p>
            <p><strong>Test Details:</strong></p>
            <ul>
              <li>Timestamp: ${new Date().toLocaleString()}</li>
              <li>Provider: ${this.settings?.email_provider || 'Unknown'}</li>
              <li>From: ${this.settings?.from_email || 'Not configured'}</li>
            </ul>
            <p>If you received this email, your email service is properly configured!</p>
          </div>
        `
      });
      return 'Email sent successfully';
    } catch (error) {
      console.error('Email test failed:', error);
      throw new Error(`Email test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Job Request Email Methods
  async sendJobRequestNotification(data: {
    to: string;
    adminName: string;
    requestTitle: string;
    requestorEmail: string;
    urgency: string;
    description: string;
  }): Promise<void> {
    const urgencyColor = data.urgency === 'urgent' ? '#dc2626' : 
                        data.urgency === 'high' ? '#ea580c' : 
                        data.urgency === 'normal' ? '#2563eb' : '#16a34a';

    await this.sendEmail({
      to: data.to,
      subject: `New Job Request: ${data.requestTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Job Request Submitted</h2>
          <p>Hello ${data.adminName},</p>
          <p>A new job request has been submitted and requires your review.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e293b;">Request Details</h3>
            <p><strong>Title:</strong> ${data.requestTitle}</p>
            <p><strong>Requestor:</strong> ${data.requestorEmail}</p>
            <p><strong>Urgency:</strong> <span style="color: ${urgencyColor}; font-weight: bold;">${data.urgency.toUpperCase()}</span></p>
            <p><strong>Description:</strong></p>
            <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #2563eb;">
              ${data.description}
            </div>
          </div>
          
          <p>Please review this request and take appropriate action.</p>
          <p>Best regards,<br>USA Notary Platform</p>
        </div>
      `
    });
  }

  async sendJobRequestReviewNotification(data: {
    to: string;
    requestTitle: string;
    status: string;
    reviewNotes?: string;
    assignedNotary: string;
  }): Promise<void> {
    const statusColor = data.status === 'approved' ? '#16a34a' : '#dc2626';
    const statusText = data.status === 'approved' ? 'APPROVED' : 'REJECTED';

    await this.sendEmail({
      to: data.to,
      subject: `Job Request ${statusText}: ${data.requestTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${statusColor};">Job Request ${statusText}</h2>
          <p>Your job request has been reviewed by our admin team.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e293b;">Request Details</h3>
            <p><strong>Title:</strong> ${data.requestTitle}</p>
            <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${statusText}</span></p>
            <p><strong>Notary Assigned:</strong> ${data.assignedNotary}</p>
            ${data.reviewNotes ? `
              <p><strong>Admin Notes:</strong></p>
              <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid ${statusColor};">
                ${data.reviewNotes}
              </div>
            ` : ''}
          </div>
          
          ${data.status === 'approved' ? `
            <p>Your request has been approved! A notary will be in touch with you soon to schedule your notarization.</p>
          ` : `
            <p>Unfortunately, your request has been rejected. Please review the admin notes above for more details.</p>
          `}
          
          <p>Best regards,<br>USA Notary Platform</p>
        </div>
      `
    });
  }

  async sendNotaryAssignmentNotification(data: {
    to: string;
    notaryName: string;
    requestTitle: string;
    requestorEmail: string;
    description: string;
    preferredDate?: string;
    preferredTime?: string;
    location?: string;
  }): Promise<void> {
    await this.sendEmail({
      to: data.to,
      subject: `New Assignment: ${data.requestTitle}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Job Assignment</h2>
          <p>Hello ${data.notaryName},</p>
          <p>You have been assigned a new job request that requires your attention.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1e293b;">Assignment Details</h3>
            <p><strong>Request Title:</strong> ${data.requestTitle}</p>
            <p><strong>Requestor:</strong> ${data.requestorEmail}</p>
            <p><strong>Description:</strong></p>
            <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #2563eb;">
              ${data.description}
            </div>
            ${data.preferredDate ? `<p><strong>Preferred Date:</strong> ${data.preferredDate}</p>` : ''}
            ${data.preferredTime ? `<p><strong>Preferred Time:</strong> ${data.preferredTime}</p>` : ''}
            ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
          </div>
          
          <p>Please contact the requestor to schedule the notarization session.</p>
          <p>Best regards,<br>USA Notary Platform</p>
        </div>
      `
    });
  }
}

export const emailService = new EmailService(); 