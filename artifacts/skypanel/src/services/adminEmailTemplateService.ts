import api from '@/lib/api';

export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
  use_default_theme?: boolean;
  variables?: string[];
  created_at: string;
  updated_at: string;
}

export interface UpdateEmailTemplateData {
  subject: string;
  html_body: string;
  text_body: string;
  use_default_theme?: boolean;
}

export interface PreviewEmailTemplateData {
  name?: string;
  subject?: string;
  html?: string;
  text?: string;
  data?: Record<string, any>;
  use_default_theme?: boolean;
}

export const adminEmailTemplateService = {
  getAllTemplates: async (): Promise<EmailTemplate[]> => {
    const response = await api.get<EmailTemplate[]>('/admin/email-templates');
    // If the response is wrapped in an object with a 'templates' key (future proofing/safety)
    if (response && 'templates' in (response as any)) {
        return (response as any).templates;
    }
    // Otherwise assume it's the array directly
    return Array.isArray(response) ? response : [];
  },

  getTemplate: async (name: string): Promise<EmailTemplate> => {
    const response = await api.get<EmailTemplate>(`/admin/email-templates/${name}`);
    return response;
  },

  updateTemplate: async (name: string, data: UpdateEmailTemplateData): Promise<EmailTemplate> => {
    const response = await api.put<EmailTemplate>(`/admin/email-templates/${name}`, data);
    return response;
  },

  previewTemplate: async (data: PreviewEmailTemplateData): Promise<{ subject: string; html: string; text: string }> => {
    const response = await api.post<{ subject: string; html: string; text: string }>('/admin/email-templates/preview', data);
    return response;
  }
};
