import { Request, Response } from 'express';
import { emailTemplateService } from './email-template-service';

// Get all email templates
export const getAllTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await emailTemplateService.getAllTemplates();
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      error: 'Failed to retrieve templates',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get template by key
export const getTemplate = async (req: Request, res: Response) => {
  try {
    const { template_key } = req.params;
    
    if (!template_key) {
      return res.status(400).json({ error: 'Template key is required' });
    }

    const template = await emailTemplateService.getTemplate(template_key);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({
      error: 'Failed to retrieve template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get all template variables
export const getTemplateVariables = async (req: Request, res: Response) => {
  try {
    const variables = await emailTemplateService.getTemplateVariables();
    res.json({
      success: true,
      variables
    });
  } catch (error) {
    console.error('Error getting template variables:', error);
    res.status(500).json({
      error: 'Failed to retrieve template variables',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Create new template
export const createTemplate = async (req: Request, res: Response) => {
  try {
    const {
      template_key,
      template_name,
      template_category,
      subject_template,
      body_template,
      description,
      is_active,
      use_base_template,
      variables,
      preview_data
    } = req.body;

    // Validation
    if (!template_key || !template_name || !template_category || !subject_template || !body_template) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['template_key', 'template_name', 'template_category', 'subject_template', 'body_template']
      });
    }

    // Check if template key already exists
    const existingTemplate = await emailTemplateService.getTemplate(template_key);
    if (existingTemplate) {
      return res.status(409).json({ error: 'Template key already exists' });
    }

    const template = await emailTemplateService.saveTemplate({
      template_key,
      template_name,
      template_category,
      subject_template,
      body_template,
      description,
      is_active: is_active !== false, // Default to true
      use_base_template: use_base_template !== false, // Default to true
      variables: variables || [],
      preview_data: preview_data || {}
    }, req.session?.user?.id);

    if (!template) {
      return res.status(500).json({ error: 'Failed to create template' });
    }

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      error: 'Failed to create template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update existing template
export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      template_name,
      template_category,
      subject_template,
      body_template,
      description,
      is_active,
      use_base_template,
      variables,
      preview_data
    } = req.body;

    const templateId = parseInt(id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    // Validation
    if (!template_name || !template_category || !subject_template || !body_template) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['template_name', 'template_category', 'subject_template', 'body_template']
      });
    }

    const template = await emailTemplateService.saveTemplate({
      id: templateId,
      template_name,
      template_category,
      subject_template,
      body_template,
      description,
      is_active,
      use_base_template,
      variables,
      preview_data
    }, req.session?.user?.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found or failed to update' });
    }

    res.json({
      success: true,
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      error: 'Failed to update template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Delete template
export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const templateId = parseInt(id);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template ID' });
    }

    const success = await emailTemplateService.deleteTemplate(templateId);
    
    if (!success) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      error: 'Failed to delete template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Preview template
export const previewTemplate = async (req: Request, res: Response) => {
  try {
    const { template_key } = req.params;
    const { variables } = req.body;

    if (!template_key) {
      return res.status(400).json({ error: 'Template key is required' });
    }

    const preview = await emailTemplateService.previewTemplate(template_key, variables);
    
    if (!preview) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      success: true,
      preview
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({
      error: 'Failed to preview template',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Send test email using template
export const sendTestEmail = async (req: Request, res: Response) => {
  try {
    const { template_key, test_email, variables, override_subject } = req.body;

    if (!template_key || !test_email) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['template_key', 'test_email']
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(test_email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    await emailTemplateService.sendTemplateEmail({
      template_key,
      variables: variables || {},
      recipient_email: test_email,
      recipient_name: 'Test Recipient',
      override_subject: override_subject ? `[TEST] ${override_subject}` : undefined,
      log_email: true
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${test_email}`
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get email logs
export const getEmailLogs = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const result = await emailTemplateService.getEmailLogs(limit, offset);

    res.json({
      success: true,
      logs: result.logs,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting email logs:', error);
    res.status(500).json({
      error: 'Failed to retrieve email logs',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get template categories
export const getTemplateCategories = async (req: Request, res: Response) => {
  try {
    const categories = [
      { value: 'notification', label: 'Notification', description: 'System notifications and alerts' },
      { value: 'invitation', label: 'Invitation', description: 'User invitations and account setup' },
      { value: 'system', label: 'System', description: 'System-generated emails (password reset, etc.)' },
      { value: 'marketing', label: 'Marketing', description: 'Marketing and promotional emails' },
      { value: 'reminder', label: 'Reminder', description: 'Reminder and follow-up emails' }
    ];

    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Error getting template categories:', error);
    res.status(500).json({
      error: 'Failed to retrieve template categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
