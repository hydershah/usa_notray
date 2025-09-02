import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Send, 
  Copy, 
  Settings, 
  FileText, 
  Clock, 
  Search,
  Filter,
  Download,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Info
} from 'lucide-react';

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
  created_at: string;
  updated_at: string;
  created_by?: number;
  last_modified_by?: number;
}

interface EmailVariable {
  id: number;
  variable_key: string;
  variable_name: string;
  variable_type: string;
  default_value?: string;
  description?: string;
  is_required: boolean;
  validation_pattern?: string;
  created_at: string;
}

interface EmailLog {
  id: number;
  template_id?: number;
  template_key: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  status: string;
  error_message?: string;
  variables_used?: Record<string, any>;
  sent_at?: string;
  created_at: string;
}

interface Category {
  value: string;
  label: string;
  description: string;
}

export default function EmailTemplateManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [variables, setVariables] = useState<EmailVariable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [testEmail, setTestEmail] = useState('');
  const [testVariables, setTestVariables] = useState<Record<string, any>>({});

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [templatesRes, variablesRes, categoriesRes, logsRes] = await Promise.all([
        fetch('/api/email-templates', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}),
        fetch('/api/email-templates/variables/all', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}),
        fetch('/api/email-templates/categories/all', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }}),
        fetch('/api/email-templates/logs/all?limit=100', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }})
      ]);

      const templatesData = await templatesRes.json();
      const variablesData = await variablesRes.json();
      const categoriesData = await categoriesRes.json();
      const logsData = await logsRes.json();

      if (templatesData.success) setTemplates(templatesData.templates);
      if (variablesData.success) setVariables(variablesData.variables);
      if (categoriesData.success) setCategories(categoriesData.categories);
      if (logsData.success) setEmailLogs(logsData.logs);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load email template data"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = 
      template.template_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.template_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || template.template_category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && template.is_active) ||
      (statusFilter === 'inactive' && !template.is_active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Save template
  const saveTemplate = async (templateData: Partial<EmailTemplate>) => {
    try {
      const isUpdate = templateData.id;
      const url = isUpdate ? `/api/email-templates/${templateData.id}` : '/api/email-templates';
      const method = isUpdate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(templateData)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: isUpdate ? 'Template updated successfully' : 'Template created successfully'
        });
        setShowTemplateDialog(false);
        setEditingTemplate(null);
        loadData();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || 'Failed to save template'
        });
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save template"
      });
    }
  };

  // Delete template
  const deleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const response = await fetch(`/api/email-templates/${templateId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Template deleted successfully"
        });
        loadData();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || 'Failed to delete template'
        });
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete template"
      });
    }
  };

  // Preview template
  const previewTemplate = async (templateKey: string, vars?: Record<string, any>) => {
    try {
      const response = await fetch(`/api/email-templates/${templateKey}/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ variables: vars })
      });

      const result = await response.json();

      if (result.success) {
        setPreviewData(result.preview);
        setShowPreviewDialog(true);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || 'Failed to preview template'
        });
      }
    } catch (error) {
      console.error('Error previewing template:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to preview template"
      });
    }
  };

  // Send test email
  const sendTestEmail = async () => {
    if (!selectedTemplate || !testEmail) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a template and enter a test email"
      });
      return;
    }

    try {
      const response = await fetch('/api/email-templates/send-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template_key: selectedTemplate.template_key,
          test_email: testEmail,
          variables: testVariables
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: result.message
        });
        setShowTestEmailDialog(false);
        setTestEmail('');
        setTestVariables({});
        loadData(); // Reload to show new log entry
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.error || 'Failed to send test email'
        });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to send test email"
      });
    }
  };

  // Get category badge color
  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      notification: 'bg-blue-100 text-blue-800',
      invitation: 'bg-green-100 text-green-800',
      system: 'bg-gray-100 text-gray-800',
             marketing: 'bg-blue-100 text-blue-800',
      reminder: 'bg-orange-100 text-orange-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      sent: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      bounced: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading email templates...</span>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Email Template Management
          </h1>
          <p className="text-gray-600 mt-1">
            Customize email notification templates, variables, and view delivery logs
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates">Email Templates</TabsTrigger>
            <TabsTrigger value="variables">Template Variables</TabsTrigger>
            <TabsTrigger value="logs">Email Logs</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => {
                setEditingTemplate({ 
                  is_active: true, 
                  use_base_template: true, 
                  variables: [],
                  preview_data: {}
                });
                setShowTemplateDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>

            <div className="grid gap-4">
              {filteredTemplates.map(template => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {template.template_name}
                          <Badge className={getCategoryColor(template.template_category)}>
                            {template.template_category}
                          </Badge>
                          {template.is_active ? (
                            <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                            {template.template_key}
                          </span>
                          {template.description && (
                            <span className="ml-2">{template.description}</span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => previewTemplate(template.template_key)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowTestEmailDialog(true);
                          }}
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowTemplateDialog(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteTemplate(template.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-sm font-medium">Subject:</Label>
                        <p className="text-sm text-gray-700 font-mono bg-gray-50 p-2 rounded">
                          {template.subject_template}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-sm text-gray-600">Variables:</span>
                        {template.variables.map(variable => (
                          <Badge key={variable} variant="outline" className="text-xs">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500">
                        Last updated: {new Date(template.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Variables Tab */}
          <TabsContent value="variables" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Template Variables</CardTitle>
                <CardDescription>
                  Available variables that can be used in email templates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {variables.map(variable => (
                    <Card key={variable.id} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {`{{${variable.variable_key}}}`}
                          </code>
                          {variable.is_required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <h4 className="font-medium">{variable.variable_name}</h4>
                        <p className="text-sm text-gray-600">{variable.description}</p>
                        <div className="text-xs text-gray-500">
                          Type: {variable.variable_type}
                          {variable.default_value && (
                            <span className="block">Default: {variable.default_value}</span>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Delivery Logs</CardTitle>
                    <CardDescription>
                      Track email delivery status and history
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={loadData}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {emailLogs.map(log => (
                    <Card key={log.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(log.status)}>
                            {log.status}
                          </Badge>
                          <span className="font-medium">{log.template_key}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm">
                          <span className="font-medium">To:</span> {log.recipient_email}
                          {log.recipient_name && <span> ({log.recipient_name})</span>}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Subject:</span> {log.subject}
                        </div>
                        {log.error_message && (
                          <div className="text-sm text-red-600">
                            <span className="font-medium">Error:</span> {log.error_message}
                          </div>
                        )}
                        {log.sent_at && (
                          <div className="text-sm text-blue-600">
                            <span className="font-medium">Sent:</span> {new Date(log.sent_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Template Settings</CardTitle>
                <CardDescription>
                  Configure global email template settings and behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Template Variables</span>
                    </div>
                    <p className="text-sm text-blue-800">
                      Use `{"{"}{"{"} variable_name {"}"}{"}"}` syntax for variable substitution in templates.
                      Conditional blocks are supported with `{"{"}{"{"} #if variable {"}"}{"}"}content{"{"}{"{"} /if {"}"}{"}"}` syntax.
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-green-900">Base Template</span>
                    </div>
                    <p className="text-sm text-green-800">
                      Templates with "Use Base Template" enabled will be automatically wrapped in the professional 
                      email layout with header, footer, and styling.
                    </p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="font-medium text-yellow-900">Testing</span>
                    </div>
                    <p className="text-sm text-yellow-800">
                      Always test email templates before activating them. Test emails are marked with [TEST] 
                      prefix and logged separately.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Template Editor Dialog */}
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate?.id ? 'Edit Template' : 'Create Template'}
              </DialogTitle>
              <DialogDescription>
                Configure email template settings and content
              </DialogDescription>
            </DialogHeader>
            
            {editingTemplate && (
              <TemplateEditor
                template={editingTemplate}
                categories={categories}
                variables={variables}
                onSave={saveTemplate}
                onCancel={() => {
                  setShowTemplateDialog(false);
                  setEditingTemplate(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email Template Preview</DialogTitle>
            </DialogHeader>
            
            {previewData && (
              <EmailPreview preview={previewData} />
            )}
          </DialogContent>
        </Dialog>

        {/* Test Email Dialog */}
        <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send Test Email</DialogTitle>
              <DialogDescription>
                Send a test email using the selected template
              </DialogDescription>
            </DialogHeader>
            
            {selectedTemplate && (
              <TestEmailForm
                template={selectedTemplate}
                variables={variables}
                testEmail={testEmail}
                setTestEmail={setTestEmail}
                testVariables={testVariables}
                setTestVariables={setTestVariables}
                onSend={sendTestEmail}
                onCancel={() => setShowTestEmailDialog(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

// Template Editor Component
function TemplateEditor({ 
  template, 
  categories, 
  variables, 
  onSave, 
  onCancel 
}: {
  template: Partial<EmailTemplate>;
  categories: Category[];
  variables: EmailVariable[];
  onSave: (template: Partial<EmailTemplate>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState(template);

  const handleSave = () => {
    if (!formData.template_name || !formData.template_category || !formData.subject_template || !formData.body_template) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields"
      });
      return;
    }

    if (!formData.id && !formData.template_key) {
      // Generate template key from name for new templates
      const key = formData.template_name!.toLowerCase().replace(/[^a-z0-9]/g, '_');
      formData.template_key = key;
    }

    onSave(formData);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="template_name">Template Name *</Label>
          <Input
            id="template_name"
            value={formData.template_name || ''}
            onChange={(e) => setFormData({...formData, template_name: e.target.value})}
            placeholder="Enter template name"
          />
        </div>
        <div>
          <Label htmlFor="template_category">Category *</Label>
          <Select value={formData.template_category} onValueChange={(value) => setFormData({...formData, template_category: value})}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(category => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.id && (
        <div>
          <Label htmlFor="template_key">Template Key</Label>
          <Input
            id="template_key"
            value={formData.template_key || ''}
            disabled
            className="bg-gray-100"
          />
        </div>
      )}

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={formData.description || ''}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          placeholder="Brief description of when this template is used"
        />
      </div>

      <div>
        <Label htmlFor="subject_template">Subject Template *</Label>
        <Input
          id="subject_template"
          value={formData.subject_template || ''}
          onChange={(e) => setFormData({...formData, subject_template: e.target.value})}
          placeholder="Email subject with variables like {{user_name}}"
        />
      </div>

      <div>
        <Label htmlFor="body_template">Body Template *</Label>
        <Textarea
          id="body_template"
          value={formData.body_template || ''}
          onChange={(e) => setFormData({...formData, body_template: e.target.value})}
          placeholder="Email body content with HTML and variables"
          rows={12}
          className="font-mono text-sm"
        />
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_active"
            checked={formData.is_active || false}
            onCheckedChange={(checked) => setFormData({...formData, is_active: checked as boolean})}
          />
          <Label htmlFor="is_active">Active</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="use_base_template"
            checked={formData.use_base_template !== false}
            onCheckedChange={(checked) => setFormData({...formData, use_base_template: checked as boolean})}
          />
          <Label htmlFor="use_base_template">Use Base Template</Label>
        </div>
      </div>

      <div className="border-t pt-4 flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          {formData.id ? 'Update' : 'Create'} Template
        </Button>
      </div>
    </div>
  );
}

// Email Preview Component
function EmailPreview({ preview }: { preview: any }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Subject:</Label>
        <div className="p-3 bg-gray-50 rounded border">
          {preview.subject}
        </div>
      </div>
      
      <Tabs defaultValue="html" className="w-full">
        <TabsList>
          <TabsTrigger value="html">HTML Preview</TabsTrigger>
          <TabsTrigger value="text">Plain Text</TabsTrigger>
          <TabsTrigger value="variables">Variables Used</TabsTrigger>
        </TabsList>
        
        <TabsContent value="html" className="mt-4">
          <div className="border rounded-lg overflow-hidden">
            <iframe
              srcDoc={preview.html}
              className="w-full h-96"
              title="Email Preview"
            />
          </div>
        </TabsContent>
        
        <TabsContent value="text" className="mt-4">
          <div className="p-4 bg-gray-50 rounded border font-mono text-sm whitespace-pre-wrap">
            {preview.text}
          </div>
        </TabsContent>
        
        <TabsContent value="variables" className="mt-4">
          <div className="space-y-2">
            {Object.entries(preview.variables_used).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <code className="text-sm">{key}</code>
                <span className="text-sm text-gray-600">{String(value)}</span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Test Email Form Component
function TestEmailForm({
  template,
  variables,
  testEmail,
  setTestEmail,
  testVariables,
  setTestVariables,
  onSend,
  onCancel
}: {
  template: EmailTemplate;
  variables: EmailVariable[];
  testEmail: string;
  setTestEmail: (email: string) => void;
  testVariables: Record<string, any>;
  setTestVariables: (vars: Record<string, any>) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  const templateVars = variables.filter(v => template.variables.includes(v.variable_key));

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="test_email">Test Email Address *</Label>
        <Input
          id="test_email"
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Enter email address to send test"
        />
      </div>

      {templateVars.length > 0 && (
        <div>
          <Label>Template Variables</Label>
          <div className="space-y-2">
            {templateVars.map(variable => (
              <div key={variable.variable_key}>
                <Label htmlFor={variable.variable_key} className="text-sm">
                  {variable.variable_name}
                  {variable.is_required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                <Input
                  id={variable.variable_key}
                  value={testVariables[variable.variable_key] || variable.default_value || ''}
                  onChange={(e) => setTestVariables({
                    ...testVariables,
                    [variable.variable_key]: e.target.value
                  })}
                  placeholder={variable.description}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t pt-4 flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSend}>
          <Send className="h-4 w-4 mr-2" />
          Send Test Email
        </Button>
      </div>
    </div>
  );
} 