import React, { useState, useEffect } from 'react';
import {
  adminEmailTemplateService,
  type EmailTemplate,
  type UpdateEmailTemplateData,
} from '@/services/adminEmailTemplateService';
import { EmailTemplateList } from './EmailTemplateList';
import { EmailTemplateEditor } from './EmailTemplateEditor';
import { toast } from 'sonner';

export const EmailTemplatesManager: React.FC = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await adminEmailTemplateService.getAllTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      toast.error('Failed to load email templates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template);
  };

  const handleCancel = () => {
    setSelectedTemplate(null);
  };

  const handleSave = async (data: UpdateEmailTemplateData) => {
    if (!selectedTemplate) return;

    setIsSaving(true);
    try {
      const updatedTemplate = await adminEmailTemplateService.updateTemplate(
        selectedTemplate.name,
        data
      );
      
      setTemplates((prev) =>
        prev.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t))
      );
      setSelectedTemplate(null);
      toast.success('Email template updated successfully');
    } catch (error) {
      console.error('Failed to update template:', error);
      toast.error('Failed to update email template');
    } finally {
      setIsSaving(false);
    }
  };

  if (selectedTemplate) {
    return (
      <EmailTemplateEditor
        template={selectedTemplate}
        onSave={handleSave}
        onCancel={handleCancel}
        isSaving={isSaving}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Templates</h2>
        <p className="text-muted-foreground">
          Manage and customize system email templates.
        </p>
      </div>
      <EmailTemplateList
        templates={templates}
        onEdit={handleEdit}
        isLoading={isLoading}
      />
    </div>
  );
};
