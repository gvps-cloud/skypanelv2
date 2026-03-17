import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminEmailTemplateService,
  type EmailTemplate,
  type UpdateEmailTemplateData,
} from "@/services/adminEmailTemplateService";
import { toast } from "sonner";
import { Eye, Save, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailTemplateEditorProps {
  template: EmailTemplate;
  onSave: (data: UpdateEmailTemplateData) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export const EmailTemplateEditor: React.FC<EmailTemplateEditorProps> = ({
  template,
  onSave,
  onCancel,
  isSaving,
}) => {
  const [formData, setFormData] = useState<UpdateEmailTemplateData>({
    subject: template.subject,
    html_body: template.html_body,
    text_body: template.text_body,
    use_default_theme: template.use_default_theme ?? true,
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<{
    subject: string;
    html: string;
    text: string;
  } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    setFormData({
      subject: template.subject,
      html_body: template.html_body,
      text_body: template.text_body,
      use_default_theme: template.use_default_theme ?? true,
    });
  }, [template]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    try {
      const result = await adminEmailTemplateService.previewTemplate({
        name: template.name,
        subject: formData.subject,
        html: formData.html_body,
        text: formData.text_body,
        use_default_theme: formData.use_default_theme,
        // We could add a way to provide sample data here
      });
      setPreviewContent(result);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Failed to generate preview:", error);
      toast.error("Failed to generate preview");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Edit Template: {template.name}
          </h2>
          <p className="text-muted-foreground">
            Make changes to the email template below.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handlePreview}
            disabled={isPreviewLoading}
          >
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Email subject line..."
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
                <div className="space-y-1">
                  <Label className="text-sm">Use default email theme</Label>
                  <p className="text-xs text-muted-foreground">
                    Wraps the HTML body with the platform theme from{" "}
                    <span className="font-medium">Admin → Theme</span>.
                  </p>
                </div>
                <Switch
                  checked={formData.use_default_theme ?? true}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      use_default_theme: Boolean(checked),
                    }))
                  }
                />
              </div>

              <Tabs defaultValue="html" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="html">HTML Body</TabsTrigger>
                  <TabsTrigger value="text">Text Body</TabsTrigger>
                </TabsList>
                <TabsContent value="html" className="mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="html_body">HTML Content (Handlebars)</Label>
                    <Textarea
                      id="html_body"
                      name="html_body"
                      value={formData.html_body}
                      onChange={handleChange}
                      className="min-h-[400px] font-mono text-sm"
                      placeholder="<html>...</html>"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="text" className="mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="text_body">Text Content (Handlebars)</Label>
                    <Textarea
                      id="text_body"
                      name="text_body"
                      value={formData.text_body}
                      onChange={handleChange}
                      className="min-h-[400px] font-mono text-sm"
                      placeholder="Plain text content..."
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Variables</CardTitle>
              <CardDescription>
                Click to copy variable to clipboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              {template.variables && template.variables.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {template.variables.map((variable) => (
                    <Button
                      key={variable}
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${variable}}}`);
                        toast.success(`Copied {{${variable}}} to clipboard`);
                      }}
                    >
                      {variable}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No specific variables defined for this template.
                </p>
              )}
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              Standard Handlebars syntax is supported.
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-muted-foreground">
              <p>
                • Use <code>{"{{variable}}"}</code> to insert dynamic content.
              </p>
              <p>
                • Use <code>{"{{#if variable}}...{{/if}}"}</code> for
                conditional content.
              </p>
              <p>
                • Use <code>{"{{#each list}}...{{/each}}"}</code> to loop over
                lists.
              </p>
              <p>• HTML content should include basic styling inline.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          {previewContent && (
            <div className="space-y-4">
              <div className="border-b pb-4">
                <p className="text-sm font-medium text-muted-foreground">
                  Subject
                </p>
                <p className="text-lg font-semibold">{previewContent.subject}</p>
              </div>
              <Tabs defaultValue="preview-html">
                <TabsList>
                  <TabsTrigger value="preview-html">HTML Preview</TabsTrigger>
                  <TabsTrigger value="preview-text">Text Preview</TabsTrigger>
                </TabsList>
                <TabsContent
                  value="preview-html"
                  className="mt-4 border rounded-md p-0 bg-background min-h-[300px]"
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: previewContent.html }}
                  />
                </TabsContent>
                <TabsContent
                  value="preview-text"
                  className="mt-4 border rounded-md p-4 bg-slate-50 min-h-[300px] whitespace-pre-wrap font-mono text-sm"
                >
                  {previewContent.text}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
