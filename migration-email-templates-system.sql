-- Migration to add Email Templates Management System
-- This migration adds email template customization, variables, and template management

-- Create Email Templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id SERIAL PRIMARY KEY,
  template_key TEXT NOT NULL UNIQUE, -- Unique identifier for the template
  template_name TEXT NOT NULL, -- Human-readable name
  template_category TEXT NOT NULL, -- Category: 'notification', 'invitation', 'system', 'marketing'
  subject_template TEXT NOT NULL, -- Subject line with variable placeholders
  body_template TEXT NOT NULL, -- Email body content with variable placeholders
  description TEXT, -- Description of when this template is used
  is_active BOOLEAN DEFAULT true, -- Whether this template is active
  use_base_template BOOLEAN DEFAULT true, -- Whether to wrap content in base template
  variables JSONB DEFAULT '[]', -- Available variables for this template
  preview_data JSONB DEFAULT '{}', -- Sample data for previewing template
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by INTEGER REFERENCES users(id),
  last_modified_by INTEGER REFERENCES users(id)
);

-- Create Email Template Variables table (for dynamic variables)
CREATE TABLE IF NOT EXISTS email_template_variables (
  id SERIAL PRIMARY KEY,
  variable_key TEXT NOT NULL UNIQUE, -- Variable key like 'user_name', 'company_name'
  variable_name TEXT NOT NULL, -- Human-readable name
  variable_type TEXT NOT NULL, -- 'text', 'email', 'url', 'date', 'number', 'boolean'
  default_value TEXT, -- Default value if not provided
  description TEXT, -- Description of the variable
  is_required BOOLEAN DEFAULT false, -- Whether this variable is required
  validation_pattern TEXT, -- Regex pattern for validation
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create Email Template History table (for tracking changes)
CREATE TABLE IF NOT EXISTS email_template_history (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES email_templates(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create Email Logs table (for tracking sent emails)
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  template_id INTEGER REFERENCES email_templates(id),
  template_key TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'sent', 'failed', 'bounced'
  error_message TEXT,
  message_id TEXT, -- From email service
  variables_used JSONB, -- Variables that were used for this email
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Insert default email template variables
INSERT INTO email_template_variables (variable_key, variable_name, variable_type, description, is_required) VALUES 
('user_name', 'User Name', 'text', 'Full name of the user', true),
('user_email', 'User Email', 'email', 'Email address of the user', true),
('user_first_name', 'User First Name', 'text', 'First name of the user', false),
('user_last_name', 'User Last Name', 'text', 'Last name of the user', false),
('company_name', 'Company Name', 'text', 'Name of the company', false),
('title_company', 'Title Company', 'text', 'Name of the title company', false),
('job_id', 'Job ID', 'number', 'Job identification number', false),
('closing_type', 'Closing Type', 'text', 'Type of closing or document', false),
('property_address', 'Property Address', 'text', 'Full property address', false),
('scheduled_date', 'Scheduled Date', 'date', 'Scheduled date for appointment', false),
('scheduled_time', 'Scheduled Time', 'text', 'Scheduled time for appointment', false),
('signer_role', 'Signer Role', 'text', 'Role of the signer (borrower, seller, etc.)', false),
('invitation_link', 'Invitation Link', 'url', 'Secure invitation or access link', false),
('reset_link', 'Reset Link', 'url', 'Password reset link', false),
('verification_link', 'Verification Link', 'url', 'Account verification link', false),
('deadline', 'Deadline', 'date', 'Deadline for action', false),
('priority', 'Priority', 'text', 'Priority level (low, normal, high, urgent)', false),
('support_email', 'Support Email', 'email', 'Support contact email', false),
('platform_name', 'Platform Name', 'text', 'Name of the platform', false),
('current_year', 'Current Year', 'number', 'Current year', false),
('current_date', 'Current Date', 'date', 'Current date', false),
('expiration_time', 'Expiration Time', 'text', 'Link or token expiration time', false),
('commission_number', 'Commission Number', 'text', 'Notary commission number', false),
('commission_state', 'Commission State', 'text', 'State of notary commission', false);

-- Insert default email templates
INSERT INTO email_templates (template_key, template_name, template_category, subject_template, body_template, description, variables, preview_data) VALUES 

-- Signer Invitation Template
('signer_invitation', 'Signer Invitation', 'invitation', 
'🏛️ Secure Document Signing Required - {{title_company}}',
'<h2 style="color: #1e40af; margin-bottom: 20px;">Document Signing Invitation</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>You have been invited to participate in a professional notarization session. Your secure digital signing portal is now ready.</p>

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
    <h4 style="margin-top: 0;">🆔 What You''ll Need:</h4>
    <ul style="margin: 10px 0;">
        <li>Government-issued photo ID (Driver''s License, Passport, etc.)</li>
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
    <strong>The {{platform_name}} Team</strong><br>
    <em>Trusted. Secure. Professional.</em>
</p>',
'Email template for inviting signers to participate in document signing sessions',
'["user_name", "title_company", "closing_type", "signer_role", "property_address", "scheduled_date", "scheduled_time", "invitation_link", "expiration_time", "support_email", "platform_name"]',
'{"user_name": "John Smith", "title_company": "ABC Title Company", "closing_type": "Real Estate Purchase", "signer_role": "Buyer", "property_address": "123 Main St, City, State 12345", "scheduled_date": "December 15, 2024", "scheduled_time": "2:00 PM EST", "invitation_link": "https://example.com/sign/token123", "expiration_time": "7 days", "support_email": "support@usanotaryservices.com", "platform_name": "USA Notary Services"}'),

-- Password Reset Template  
('password_reset', 'Password Reset', 'system',
'🔑 Password Reset - {{platform_name}}',
'<h2 style="color: #1e40af; margin-bottom: 20px;">Password Reset Request</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>We received a request to reset your password for {{platform_name}} platform.</p>

<div style="text-align: center; margin: 30px 0;">
    <a href="{{reset_link}}" class="button">
        🔑 Reset Password
    </a>
</div>

<div class="warning-box">
    <p><strong>⚠️ Security Information:</strong></p>
    <ul style="margin: 10px 0;">
        <li>This link expires in {{expiration_time}} for security</li>
        <li>If you didn''t request this reset, please ignore this email</li>
        <li>Your password remains unchanged until you complete the reset</li>
    </ul>
</div>

<p>If you continue to have issues, please contact our support team at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>

<p style="margin-top: 30px;">
    Best regards,<br>
    <strong>The {{platform_name}} Team</strong>
</p>',
'Email template for password reset requests',
'["user_name", "reset_link", "expiration_time", "support_email", "platform_name"]',
'{"user_name": "John Smith", "reset_link": "https://example.com/reset/token123", "expiration_time": "1 hour", "support_email": "support@usanotaryservices.com", "platform_name": "USA Notary Services"}'),

-- Job Assignment Notification
('job_assignment', 'Job Assignment Notification', 'notification',
'📋 New Job Assignment - Job #{{job_id}}',
'<h2 style="color: #1e40af; margin-bottom: 20px;">New Job Assignment</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>You have been assigned to a new notarization job. Please review the details below and respond promptly.</p>

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
    <strong>The {{platform_name}} Team</strong>
</p>',
'Email template for notifying notaries of job assignments',
'["user_name", "job_id", "title_company", "closing_type", "priority", "property_address", "scheduled_date", "scheduled_time", "deadline", "invitation_link", "support_email", "platform_name"]',
'{"user_name": "Jane Notary", "job_id": "12345", "title_company": "ABC Title Company", "closing_type": "Real Estate Purchase", "priority": "High", "property_address": "123 Main St, City, State 12345", "scheduled_date": "December 15, 2024", "scheduled_time": "2:00 PM EST", "deadline": "December 14, 2024 5:00 PM", "invitation_link": "https://example.com/job/12345", "support_email": "support@usanotaryservices.com", "platform_name": "USA Notary Services"}'),

-- Account Setup Invitation
('account_setup', 'Account Setup Required', 'invitation',
'🏛️ Account Setup Required - {{title_company}} Document Signing',
'<h2 style="color: #1e40af; margin-bottom: 20px;">Account Setup Required - Document Signing</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>An account has been created for you at {{platform_name}} for an upcoming document signing session. Please complete your account setup to participate in the notarization process.</p>

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
        <li><strong>Join Signing Session:</strong> Once verified, you''ll be able to participate</li>
    </ol>
</div>

<div class="success-box">
    <h4 style="margin-top: 0;">🆔 ID Verification Process:</h4>
    <p>Before you can participate in any signing sessions, you''ll need to complete identity verification in your dashboard using:</p>
    <ul style="margin: 10px 0;">
        <li>Government-issued photo ID (Driver''s License, Passport, etc.)</li>
        <li>Selfie verification for face matching</li>
        <li>Professional verification through EVS Solutions</li>
    </ul>
    <p><strong>Important:</strong> You cannot join any signing sessions until your identity is verified and approved.</p>
</div>

<p><strong>Security Note:</strong> This account setup link expires in {{expiration_time}}. After setting up your account, you''ll receive a separate invitation when the signing session is ready.</p>

<p>Your account email is: <strong>{{user_email}}</strong></p>

<p>If you have any questions about the account setup or verification process, please contact us at <a href="mailto:{{support_email}}">{{support_email}}</a>.</p>

<p style="margin-top: 30px;">
    Best regards,<br>
    <strong>The {{platform_name}} Team</strong><br>
    <em>Secure. Verified. Professional.</em>
</p>',
'Email template for account setup invitations for new signers',
'["user_name", "user_email", "title_company", "closing_type", "signer_role", "property_address", "scheduled_date", "scheduled_time", "verification_link", "expiration_time", "support_email", "platform_name"]',
'{"user_name": "John Smith", "user_email": "john@example.com", "title_company": "ABC Title Company", "closing_type": "Real Estate Purchase", "signer_role": "Buyer", "property_address": "123 Main St, City, State 12345", "scheduled_date": "December 15, 2024", "scheduled_time": "2:00 PM EST", "verification_link": "https://example.com/setup/token123", "expiration_time": "24 hours", "support_email": "support@usanotaryservices.com", "platform_name": "USA Notary Services"}'),

-- User Invitation Template
('user_invitation', 'Platform Access Invitation', 'invitation',
'🏛️ Platform Access Invitation - {{signer_role}}',
'<h2 style="color: #1e40af; margin-bottom: 20px;">Platform Access Invitation</h2>

<p>Dear <strong>{{user_name}}</strong>,</p>

<p>You have been invited to join {{platform_name}} platform as a <strong>{{signer_role}}</strong> by {{invited_by}}.</p>

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

<p>Once registered, you''ll have access to our professional notarization platform with all the tools needed for your role.</p>

<p style="margin-top: 30px;">
    Best regards,<br>
    <strong>The {{platform_name}} Team</strong>
</p>',
'Email template for inviting new users to the platform',
'["user_name", "user_email", "signer_role", "invited_by", "invitation_link", "expiration_time", "platform_name"]',
'{"user_name": "John Smith", "user_email": "john@example.com", "signer_role": "Notary", "invited_by": "Admin User", "invitation_link": "https://example.com/register/token123", "expiration_time": "48 hours", "platform_name": "USA Notary Services"}');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON email_templates(template_category);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_template_variables_key ON email_template_variables(variable_key);
CREATE INDEX IF NOT EXISTS idx_email_template_history_template ON email_template_history(template_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);

-- Add constraints
ALTER TABLE email_templates ADD CONSTRAINT check_template_category 
  CHECK (template_category IN ('notification', 'invitation', 'system', 'marketing', 'reminder'));

ALTER TABLE email_template_variables ADD CONSTRAINT check_variable_type 
  CHECK (variable_type IN ('text', 'email', 'url', 'date', 'number', 'boolean', 'json'));

ALTER TABLE email_logs ADD CONSTRAINT check_email_status 
  CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'delivered', 'opened', 'clicked'));

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS trigger_update_email_template_timestamp ON email_templates;
CREATE TRIGGER trigger_update_email_template_timestamp
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_timestamp();

-- Create function to track template changes in history
CREATE OR REPLACE FUNCTION track_email_template_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO email_template_history (
        template_id, 
        template_key, 
        subject_template, 
        body_template, 
        changed_by, 
        change_reason
    ) VALUES (
        OLD.id, 
        OLD.template_key, 
        OLD.subject_template, 
        OLD.body_template, 
        NEW.last_modified_by, 
        'Template updated'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for template change tracking
DROP TRIGGER IF EXISTS trigger_track_email_template_changes ON email_templates;
CREATE TRIGGER trigger_track_email_template_changes
  AFTER UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION track_email_template_changes();

-- Migration completed - email templates system ready 