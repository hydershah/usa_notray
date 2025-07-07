import { pool } from './db';
import { emailService } from './lib/email-service';

import { eq, and, desc } from 'drizzle-orm';

// Define the schema types for our email templates
interface EmailTemplate {
  id: number;
  template_key: string;
  template_name: string;
  template_category: string;
  subject_template: string;
  body_template: string;
  description?: string;
  is_active: boolean;
  use_base_template: boolean;
  variables: string[];
  preview_data: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  created_by?: number;
  last_modified_by?: number;
}

interface EmailTemplateVariable {
  id: number;
  variable_key: string;
  variable_name: string;
  variable_type: string;
  default_value?: string;
  description?: string;
  is_required: boolean;
  validation_pattern?: string;
  created_at: Date;
}

interface EmailLog {
  id: number;
  template_id?: number;
  template_key: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body_html: string;
  body_text?: string;
  status: string;
  error_message?: string;
  message_id?: string;
  variables_used?: Record<string, any>;
  sent_at?: Date;
  opened_at?: Date;
  clicked_at?: Date;
  created_at: Date;
}

interface TemplateRenderOptions {
  template_key: string;
  variables: Record<string, any>;
  recipient_email: string;
  recipient_name?: string;
  log_email?: boolean;
}

interface SendTemplateEmailOptions extends TemplateRenderOptions {
  override_subject?: string;
  reply_to?: string;
  headers?: Record<string, string>;
}

class EmailTemplateService {
  // Template rendering with Handlebars-like syntax
  private renderTemplate(template: string, variables: Record<string, any>): string {
    let rendered = template;
    
    // Handle {{variable}} replacements
    rendered = rendered.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmedVar = varName.trim();
      
      // Handle conditional blocks {{#if variable}}content{{/if}}
      if (trimmedVar.startsWith('#if ')) {
        return match; // Will be processed by conditional handler
      }
      
      // Handle regular variables
      const value = variables[trimmedVar];
      if (value !== undefined && value !== null) {
        return String(value);
      }
      
      // Return empty string for undefined variables
      return '';
    });
    
    // Handle conditional blocks {{#if variable}}content{{/if}}
    rendered = rendered.replace(/\{\{#if\s+([^}]+)\}\}(.*?)\{\{\/if\}\}/gs, (match, condition, content) => {
      const variable = condition.trim();
      const value = variables[variable];
      
      // Show content if variable exists and is truthy
      if (value && value !== '' && value !== null && value !== undefined) {
        return content;
      }
      
      return '';
    });
    
    return rendered;
  }

  // Get default variables with current values
  private getDefaultVariables(): Record<string, any> {
    return {
      platform_name: 'Sharp Note',
      support_email: 'support@sharpnote.net',
      current_year: new Date().getFullYear(),
      current_date: new Date().toLocaleDateString(),
      expiration_time: '24 hours',
      client_url: process.env.CLIENT_URL || 'http://localhost:5173'
    };
  }

  // Validate template variables
  private async validateVariables(template_key: string, variables: Record<string, any>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      // Get template
      const template = await this.getTemplate(template_key);
      if (!template) {
        errors.push(`Template '${template_key}' not found`);
        return { valid: false, errors };
      }

      // Get required variables for this template
      const templateVariables = template.variables || [];
      
      // Get variable definitions
      const variableDefsResult = await pool.query(`
        SELECT variable_key, variable_name, variable_type, is_required, validation_pattern, default_value
        FROM email_template_variables 
        WHERE variable_key = ANY($1)
      `, [templateVariables]);

      const variableDefs = variableDefsResult.rows;

      // Check each required variable
      for (const varDef of variableDefs) {
        const varKey = varDef.variable_key;
        const value = variables[varKey];
        
        // Check required variables
        if (varDef.is_required && (value === undefined || value === null || value === '')) {
          errors.push(`Required variable '${varDef.variable_name}' (${varKey}) is missing`);
          continue;
        }

        // Validate variable types and patterns
        if (value !== undefined && value !== null && value !== '') {
          const stringValue = String(value);
          
          // Type validation
          switch (varDef.variable_type) {
            case 'email':
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(stringValue)) {
                errors.push(`Variable '${varDef.variable_name}' must be a valid email address`);
              }
              break;
              
            case 'url':
              try {
                new URL(stringValue);
              } catch {
                errors.push(`Variable '${varDef.variable_name}' must be a valid URL`);
              }
              break;
              
            case 'number':
              if (isNaN(Number(stringValue))) {
                errors.push(`Variable '${varDef.variable_name}' must be a number`);
              }
              break;
              
            case 'boolean':
              if (!['true', 'false', '1', '0'].includes(stringValue.toLowerCase())) {
                errors.push(`Variable '${varDef.variable_name}' must be a boolean value`);
              }
              break;
          }

          // Pattern validation
          if (varDef.validation_pattern) {
            const regex = new RegExp(varDef.validation_pattern);
            if (!regex.test(stringValue)) {
              errors.push(`Variable '${varDef.variable_name}' does not match required format`);
            }
          }
        }
      }

    } catch (error) {
      errors.push(`Variable validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { valid: errors.length === 0, errors };
  }

  // Get template by key
  async getTemplate(template_key: string): Promise<EmailTemplate | null> {
    try {
      const result = await pool.query(`
        SELECT * FROM email_templates 
        WHERE template_key = $1 AND is_active = true
      `, [template_key]);

      const template = result.rows[0];
      if (!template) return null;

      return {
        id: template.id,
        template_key: template.template_key,
        template_name: template.template_name,
        template_category: template.template_category,
        subject_template: template.subject_template,
        body_template: template.body_template,
        description: template.description,
        is_active: template.is_active,
        use_base_template: template.use_base_template,
        variables: template.variables || [],
        preview_data: template.preview_data || {},
        created_at: template.created_at,
        updated_at: template.updated_at,
        created_by: template.created_by,
        last_modified_by: template.last_modified_by
      };
    } catch (error) {
      console.error('Error getting template:', error);
      return null;
    }
  }

  // Get all templates
  async getAllTemplates(): Promise<EmailTemplate[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM email_templates 
        ORDER BY template_category, template_name
      `);

      return result.rows.map(template => ({
        id: template.id,
        template_key: template.template_key,
        template_name: template.template_name,
        template_category: template.template_category,
        subject_template: template.subject_template,
        body_template: template.body_template,
        description: template.description,
        is_active: template.is_active,
        use_base_template: template.use_base_template,
        variables: template.variables || [],
        preview_data: template.preview_data || {},
        created_at: template.created_at,
        updated_at: template.updated_at,
        created_by: template.created_by,
        last_modified_by: template.last_modified_by
      }));
    } catch (error) {
      console.error('Error getting all templates:', error);
      return [];
    }
  }

  // Get template variables
  async getTemplateVariables(): Promise<EmailTemplateVariable[]> {
    try {
      const result = await pool.query(`
        SELECT * FROM email_template_variables 
        ORDER BY variable_name
      `);

      return result.rows.map(variable => ({
        id: variable.id,
        variable_key: variable.variable_key,
        variable_name: variable.variable_name,
        variable_type: variable.variable_type,
        default_value: variable.default_value,
        description: variable.description,
        is_required: variable.is_required,
        validation_pattern: variable.validation_pattern,
        created_at: variable.created_at
      }));
    } catch (error) {
      console.error('Error getting template variables:', error);
      return [];
    }
  }

  // Render template with variables
  async renderEmailTemplate(options: TemplateRenderOptions): Promise<{
    subject: string;
    html: string;
    text: string;
    template: EmailTemplate;
  } | null> {
    try {
      const template = await this.getTemplate(options.template_key);
      if (!template || !template.is_active) {
        throw new Error(`Template '${options.template_key}' not found or inactive`);
      }

      // Merge with default variables
      const allVariables = {
        ...this.getDefaultVariables(),
        ...options.variables
      };

      // Validate variables
      const validation = await this.validateVariables(options.template_key, allVariables);
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      // Render subject and body
      const subject = this.renderTemplate(template.subject_template, allVariables);
      const bodyContent = this.renderTemplate(template.body_template, allVariables);
      
      // Wrap in base template if requested
      const html = template.use_base_template 
        ? this.getBaseTemplate(bodyContent)
        : bodyContent;

      // Generate plain text version
      const text = this.generatePlainText(bodyContent, allVariables);

      // Log the email if requested
      if (options.log_email !== false) {
        await this.logEmail({
          template_id: template.id,
          template_key: template.template_key,
          recipient_email: options.recipient_email,
          recipient_name: options.recipient_name,
          subject,
          body_html: html,
          body_text: text,
          status: 'pending',
          variables_used: allVariables
        });
      }

      return { subject, html, text, template };
    } catch (error) {
      console.error('Error rendering template:', error);
      return null;
    }
  }

  // Send email using template
  async sendTemplateEmail(options: SendTemplateEmailOptions): Promise<void> {
    try {
      const rendered = await this.renderEmailTemplate(options);
      if (!rendered) {
        throw new Error(`Failed to render template '${options.template_key}'`);
      }

      const emailOptions = {
        to: options.recipient_email,
        subject: options.override_subject || rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: options.reply_to,
        headers: options.headers
      };

      // Send email through existing email service
      await emailService.sendEmail(emailOptions);

      // Update email log status
      await this.updateEmailLogStatus(options.template_key, options.recipient_email, 'sent');

    } catch (error) {
      // Update email log with error
      await this.updateEmailLogStatus(options.template_key, options.recipient_email, 'failed', 
        error instanceof Error ? error.message : 'Unknown error');
      
      throw error;
    }
  }

  // Preview template
  async previewTemplate(template_key: string, variables?: Record<string, any>): Promise<{
    subject: string;
    html: string;
    text: string;
    variables_used: Record<string, any>;
  } | null> {
    try {
      const template = await this.getTemplate(template_key);
      if (!template) return null;

      // Use preview data or provided variables
      const previewVariables = variables || template.preview_data || {};
      const allVariables = {
        ...this.getDefaultVariables(),
        ...previewVariables
      };

      const subject = this.renderTemplate(template.subject_template, allVariables);
      const bodyContent = this.renderTemplate(template.body_template, allVariables);
      const html = template.use_base_template 
        ? this.getBaseTemplate(bodyContent)
        : bodyContent;
      const text = this.generatePlainText(bodyContent, allVariables);

      return { subject, html, text, variables_used: allVariables };
    } catch (error) {
      console.error('Error previewing template:', error);
      return null;
    }
  }

  // Create or update template
  async saveTemplate(template: Partial<EmailTemplate>, user_id?: number): Promise<EmailTemplate | null> {
    try {
      const now = new Date();
      
      if (template.id) {
        // Update existing template
        const result = await pool.query(`
          UPDATE email_templates 
          SET template_name = $1, template_category = $2, subject_template = $3, 
              body_template = $4, description = $5, is_active = $6, 
              use_base_template = $7, variables = $8, preview_data = $9,
              updated_at = $10, last_modified_by = $11
          WHERE id = $12
          RETURNING *
        `, [
          template.template_name,
          template.template_category,
          template.subject_template,
          template.body_template,
          template.description,
          template.is_active,
          template.use_base_template,
          JSON.stringify(template.variables),
          JSON.stringify(template.preview_data),
          now,
          user_id,
          template.id
        ]);

        return result.rows[0] as EmailTemplate;
      } else {
        // Create new template
        const result = await pool.query(`
          INSERT INTO email_templates (
            template_key, template_name, template_category, subject_template,
            body_template, description, is_active, use_base_template,
            variables, preview_data, created_at, updated_at, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          template.template_key,
          template.template_name,
          template.template_category,
          template.subject_template,
          template.body_template,
          template.description,
          template.is_active !== false, // Default to true
          template.use_base_template !== false, // Default to true
          JSON.stringify(template.variables || []),
          JSON.stringify(template.preview_data || {}),
          now,
          now,
          user_id
        ]);

        return result.rows[0] as EmailTemplate;
      }
    } catch (error) {
      console.error('Error saving template:', error);
      return null;
    }
  }

  // Delete template
  async deleteTemplate(id: number): Promise<boolean> {
    try {
      const result = await pool.query(`
        DELETE FROM email_templates WHERE id = $1
      `, [id]);

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting template:', error);
      return false;
    }
  }

  // Get email logs
  async getEmailLogs(limit = 100, offset = 0): Promise<{
    logs: EmailLog[];
    total: number;
  }> {
    try {
      const [logsResult, countResult] = await Promise.all([
        pool.query(`
          SELECT * FROM email_logs 
          ORDER BY created_at DESC 
          LIMIT $1 OFFSET $2
        `, [limit, offset]),
        
        pool.query(`SELECT COUNT(*) as total FROM email_logs`)
      ]);

      const logs = logsResult.rows.map(log => ({
        id: log.id,
        template_id: log.template_id,
        template_key: log.template_key,
        recipient_email: log.recipient_email,
        recipient_name: log.recipient_name,
        subject: log.subject,
        body_html: log.body_html,
        body_text: log.body_text,
        status: log.status,
        error_message: log.error_message,
        message_id: log.message_id,
        variables_used: log.variables_used,
        sent_at: log.sent_at,
        opened_at: log.opened_at,
        clicked_at: log.clicked_at,
        created_at: log.created_at
      }));

      const total = countResult.rows[0]?.total || 0;

      return { logs, total };
    } catch (error) {
      console.error('Error getting email logs:', error);
      return { logs: [], total: 0 };
    }
  }

  // Private helper methods
  private async logEmail(logData: Partial<EmailLog>): Promise<void> {
    try {
      await pool.query(`
        INSERT INTO email_logs (
          template_id, template_key, recipient_email, recipient_name,
          subject, body_html, body_text, status, variables_used, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        logData.template_id,
        logData.template_key,
        logData.recipient_email,
        logData.recipient_name,
        logData.subject,
        logData.body_html,
        logData.body_text,
        logData.status,
        JSON.stringify(logData.variables_used),
        new Date()
      ]);
    } catch (error) {
      console.error('Error logging email:', error);
    }
  }

  private async updateEmailLogStatus(template_key: string, recipient_email: string, status: string, error_message?: string): Promise<void> {
    try {
      await pool.query(`
        UPDATE email_logs 
        SET status = $1, error_message = $2, sent_at = $3
        WHERE template_key = $4 AND recipient_email = $5 
        AND created_at = (
          SELECT MAX(created_at) FROM email_logs 
          WHERE template_key = $4 AND recipient_email = $5
        )
      `, [
        status,
        error_message,
        status === 'sent' ? new Date() : null,
        template_key,
        recipient_email
      ]);
    } catch (error) {
      console.error('Error updating email log status:', error);
    }
  }

  private getBaseTemplate(content: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>sharpnote</title>
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
            <div class="header">
                <h1>🏛️ Sharp Note</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Digital Notarization</p>
            </div>
            <div class="content">
                ${content}
            </div>
            <div class="footer">
                <p><strong>Sharp Note</strong> | Digital Notarization</p>
                <p>This is an automated message from our secure notarization platform.</p>
                <p>© ${new Date().getFullYear()} Sharp Note. All rights reserved.</p>
                <p style="margin-top: 10px;">
                    <a href="mailto:support@sharpnote.net" style="color: #6b7280;">Support</a> | 
                    <a href="#" style="color: #6b7280;">Privacy Policy</a> | 
                    <a href="mailto:unsubscribe@sharpnote.net" style="color: #6b7280;">Unsubscribe</a>
                </p>
            </div>
        </div>
    </body>
    </html>`;
  }

  private generatePlainText(html: string, variables: Record<string, any>): string {
    // Simple HTML to text conversion
    let text = html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Add footer
    text += `\n\n---\nSharp Note | Digital Notarization\n© ${new Date().getFullYear()} Sharp Note. All rights reserved.\nSupport: support@sharpnote.net`;

    return text;
  }
}

export const emailTemplateService = new EmailTemplateService(); 