import React, { useState, useEffect } from 'react';
import { Mail, Ticket, Phone, MapPin, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { apiClient } from '@/lib/api';
import type { ContactMethod, EmailConfig, TicketConfig, PhoneConfig, OfficeConfig } from '@/types/contact';

// Validation schemas for each method type
const emailSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  is_active: z.boolean(),
  config: z.object({
    email_address: z.string().email('Invalid email address'),
    response_time: z.string().min(1, 'Response time is required'),
  }),
});

const ticketSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  is_active: z.boolean(),
  config: z.object({
    dashboard_link: z.string()
      .regex(/^\/[a-zA-Z0-9\-_/]*$/, 'Must be a valid internal route starting with /'),
    priority_queues: z.array(z.object({
      label: z.string().min(1, 'Label is required'),
      response_time: z.string().min(1, 'Response time is required'),
    })).min(1, 'At least one priority queue is required'),
  }),
});

const phoneSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  is_active: z.boolean(),
  config: z.object({
    phone_number: z.string()
      .regex(/^\+?[0-9\s().-]+$/, 'Invalid phone number format'),
    availability_text: z.string().min(1, 'Availability text is required'),
  }),
});

const officeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional(),
  is_active: z.boolean(),
  config: z.object({
    address_line1: z.string().min(1, 'Address line 1 is required'),
    address_line2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    postal_code: z.string().min(1, 'Postal code is required'),
    country: z.string().min(1, 'Country is required'),
    appointment_required: z.string().min(1, 'Appointment information is required'),
  }),
});

interface ContactMethodManagerProps {
  token: string;
}

type EmailFormData = z.infer<typeof emailSchema>;
type TicketFormData = z.infer<typeof ticketSchema>;
type PhoneFormData = z.infer<typeof phoneSchema>;
type OfficeFormData = z.infer<typeof officeSchema>;

export const ContactMethodManager: React.FC<ContactMethodManagerProps> = ({ token }) => {
  const [methods, setMethods] = useState<ContactMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Fetch all contact methods
  const fetchMethods = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiClient.get<{ methods: ContactMethod[] }>('/admin/contact/methods');
      setMethods(data.methods || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load contact methods');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Get method by type
  const getMethod = (type: string): ContactMethod | undefined => {
    return methods.find(m => m.method_type === type);
  };

  // Update method
  const updateMethod = async (methodType: string, data: any) => {
    setSubmitting(methodType);
    try {
      console.log('[ContactMethodManager] Updating method', { methodType, data });
      
      const responseData = await apiClient.put<{ method: ContactMethod }>(
        `/admin/contact/methods/${methodType}`,
        data
      );
      
      // Update local state with the new method data
      setMethods(prev => prev.map(m => m.method_type === methodType ? responseData.method : m));
      
      // Show success message with method name
      toast.success(`${data.title || methodType} contact method updated successfully`, {
        description: 'Changes have been saved and will appear on the public contact page'
      });
      
      console.log('[ContactMethodManager] Successfully updated method', { methodType });
    } catch (error: any) {
      console.error('[ContactMethodManager] Error updating method', { methodType }, error);
      toast.error(`Failed to update ${methodType} contact method`, {
        description: error.message || 'Please check your input and try again'
      });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        Loading contact methods...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EmailMethodForm
        method={getMethod('email')}
        onSave={(data) => updateMethod('email', data)}
        isSubmitting={submitting === 'email'}
      />
      
      <TicketMethodForm
        method={getMethod('ticket')}
        onSave={(data) => updateMethod('ticket', data)}
        isSubmitting={submitting === 'ticket'}
      />
      
      <PhoneMethodForm
        method={getMethod('phone')}
        onSave={(data) => updateMethod('phone', data)}
        isSubmitting={submitting === 'phone'}
      />
      
      <OfficeMethodForm
        method={getMethod('office')}
        onSave={(data) => updateMethod('office', data)}
        isSubmitting={submitting === 'office'}
      />
    </div>
  );
};

// ============================================================================
// EMAIL METHOD FORM
// ============================================================================

interface EmailMethodFormProps {
  method?: ContactMethod;
  onSave: (data: EmailFormData) => Promise<void>;
  isSubmitting: boolean;
}

const EmailMethodForm: React.FC<EmailMethodFormProps> = ({ method, onSave, isSubmitting }) => {
  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      title: method?.title || 'Email our team',
      description: method?.description || '',
      is_active: method?.is_active ?? true,
      config: {
        email_address: (method?.config as EmailConfig)?.email_address || '',
        response_time: (method?.config as EmailConfig)?.response_time || '',
      },
    },
  });

  useEffect(() => {
    if (method) {
      form.reset({
        title: method.title,
        description: method.description || '',
        is_active: method.is_active,
        config: method.config as EmailConfig,
      });
    }
  }, [method, form]);

  const handleSubmit = async (data: EmailFormData) => {
    console.log('[EmailMethodForm] Submitting data:', data);
    try {
      await onSave(data);
    } catch (error) {
      console.error('[EmailMethodForm] Submission error:', error);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Email Contact Method</CardTitle>
              <CardDescription>Configure email contact information</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.watch('is_active')}
            onCheckedChange={(checked) => form.setValue('is_active', checked)}
            disabled={isSubmitting}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email-title">Title *</Label>
              <Input
                id="email-title"
                {...form.register('title')}
                placeholder="e.g., Email our team"
                disabled={isSubmitting}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email-address">Email Address *</Label>
              <Input
                id="email-address"
                type="email"
                {...form.register('config.email_address')}
                placeholder="support@example.com"
                disabled={isSubmitting}
              />
              {form.formState.errors.config?.email_address && (
                <p className="text-sm text-destructive">{form.formState.errors.config.email_address.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-description">Description</Label>
            <Textarea
              id="email-description"
              {...form.register('description')}
              placeholder="Brief description of this contact method"
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-response-time">Response Time *</Label>
            <Input
              id="email-response-time"
              {...form.register('config.response_time')}
              placeholder="e.g., Within 24 hours"
              disabled={isSubmitting}
            />
            {form.formState.errors.config?.response_time && (
              <p className="text-sm text-destructive">{form.formState.errors.config.response_time.message}</p>
            )}
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// TICKET METHOD FORM
// ============================================================================

interface TicketMethodFormProps {
  method?: ContactMethod;
  onSave: (data: TicketFormData) => Promise<void>;
  isSubmitting: boolean;
}

const TicketMethodForm: React.FC<TicketMethodFormProps> = ({ method, onSave, isSubmitting }) => {
  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: method?.title || 'Submit a ticket',
      description: method?.description || '',
      is_active: method?.is_active ?? true,
      config: {
        dashboard_link: (method?.config as TicketConfig)?.dashboard_link || '/support',
        priority_queues: (method?.config as TicketConfig)?.priority_queues || [
          { label: 'High Priority', response_time: '2-4 hours' },
          { label: 'Normal Priority', response_time: '24 hours' },
        ],
      },
    },
  });

  useEffect(() => {
    if (method) {
      form.reset({
        title: method.title,
        description: method.description || '',
        is_active: method.is_active,
        config: method.config as TicketConfig,
      });
    }
  }, [method, form]);

  const addPriorityQueue = () => {
    const currentQueues = form.getValues('config.priority_queues');
    form.setValue('config.priority_queues', [
      ...currentQueues,
      { label: '', response_time: '' },
    ]);
  };

  const removePriorityQueue = (index: number) => {
    const currentQueues = form.getValues('config.priority_queues');
    form.setValue('config.priority_queues', currentQueues.filter((_, i) => i !== index));
  };

  const handleSubmit = async (data: TicketFormData) => {
    console.log('[TicketMethodForm] Submitting data:', data);
    try {
      await onSave(data);
    } catch (error) {
      console.error('[TicketMethodForm] Submission error:', error);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Ticket Contact Method</CardTitle>
              <CardDescription>Configure support ticket system</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.watch('is_active')}
            onCheckedChange={(checked) => form.setValue('is_active', checked)}
            disabled={isSubmitting}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Title *</Label>
              <Input
                id="ticket-title"
                {...form.register('title')}
                placeholder="e.g., Submit a ticket"
                disabled={isSubmitting}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="ticket-dashboard-link">Dashboard Link *</Label>
              <Input
                id="ticket-dashboard-link"
                {...form.register('config.dashboard_link')}
                placeholder="/support"
                disabled={isSubmitting}
              />
              {form.formState.errors.config?.dashboard_link && (
                <p className="text-sm text-destructive">{form.formState.errors.config.dashboard_link.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              {...form.register('description')}
              placeholder="Brief description of this contact method"
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Priority Queues *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPriorityQueue}
                disabled={isSubmitting}
              >
                Add Queue
              </Button>
            </div>

            {form.watch('config.priority_queues').map((_, index) => (
              <div key={index} className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-[1fr,1fr,auto]">
                <div className="space-y-2">
                  <Label htmlFor={`queue-label-${index}`}>Label *</Label>
                  <Input
                    id={`queue-label-${index}`}
                    {...form.register(`config.priority_queues.${index}.label`)}
                    placeholder="e.g., High Priority"
                    disabled={isSubmitting}
                  />
                  {form.formState.errors.config?.priority_queues?.[index]?.label && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.config.priority_queues[index]?.label?.message}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`queue-response-${index}`}>Response Time *</Label>
                  <Input
                    id={`queue-response-${index}`}
                    {...form.register(`config.priority_queues.${index}.response_time`)}
                    placeholder="e.g., 2-4 hours"
                    disabled={isSubmitting}
                  />
                  {form.formState.errors.config?.priority_queues?.[index]?.response_time && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.config.priority_queues[index]?.response_time?.message}
                    </p>
                  )}
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removePriorityQueue(index)}
                    disabled={isSubmitting || form.watch('config.priority_queues').length === 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            
            {form.formState.errors.config?.priority_queues && (
              <p className="text-sm text-destructive">
                {form.formState.errors.config.priority_queues.message}
              </p>
            )}
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// PHONE METHOD FORM
// ============================================================================

interface PhoneMethodFormProps {
  method?: ContactMethod;
  onSave: (data: PhoneFormData) => Promise<void>;
  isSubmitting: boolean;
}

const PhoneMethodForm: React.FC<PhoneMethodFormProps> = ({ method, onSave, isSubmitting }) => {
  const form = useForm<PhoneFormData>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      title: method?.title || 'Call us',
      description: method?.description || '',
      is_active: method?.is_active ?? true,
      config: {
        phone_number: (method?.config as PhoneConfig)?.phone_number || '',
        availability_text: (method?.config as PhoneConfig)?.availability_text || '',
      },
    },
  });

  useEffect(() => {
    if (method) {
      form.reset({
        title: method.title,
        description: method.description || '',
        is_active: method.is_active,
        config: method.config as PhoneConfig,
      });
    }
  }, [method, form]);

  const handleSubmit = async (data: PhoneFormData) => {
    console.log('[PhoneMethodForm] Submitting data:', data);
    try {
      await onSave(data);
    } catch (error) {
      console.error('[PhoneMethodForm] Submission error:', error);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Phone Contact Method</CardTitle>
              <CardDescription>Configure phone contact information</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.watch('is_active')}
            onCheckedChange={(checked) => form.setValue('is_active', checked)}
            disabled={isSubmitting}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="phone-title">Title *</Label>
              <Input
                id="phone-title"
                {...form.register('title')}
                placeholder="e.g., Call us"
                disabled={isSubmitting}
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number *</Label>
              <Input
                id="phone-number"
                type="tel"
                {...form.register('config.phone_number')}
                placeholder="+1 (555) 123-4567"
                disabled={isSubmitting}
              />
              {form.formState.errors.config?.phone_number && (
                <p className="text-sm text-destructive">{form.formState.errors.config.phone_number.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone-description">Description</Label>
            <Textarea
              id="phone-description"
              {...form.register('description')}
              placeholder="Brief description of this contact method"
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone-availability">Availability Text *</Label>
            <Input
              id="phone-availability"
              {...form.register('config.availability_text')}
              placeholder="e.g., Available Monday-Friday, 9 AM - 5 PM EST"
              disabled={isSubmitting}
            />
            {form.formState.errors.config?.availability_text && (
              <p className="text-sm text-destructive">{form.formState.errors.config.availability_text.message}</p>
            )}
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// ============================================================================
// OFFICE METHOD FORM
// ============================================================================

interface OfficeMethodFormProps {
  method?: ContactMethod;
  onSave: (data: OfficeFormData) => Promise<void>;
  isSubmitting: boolean;
}

const OfficeMethodForm: React.FC<OfficeMethodFormProps> = ({ method, onSave, isSubmitting }) => {
  const form = useForm<OfficeFormData>({
    resolver: zodResolver(officeSchema),
    defaultValues: {
      title: method?.title || 'Visit our office',
      description: method?.description || '',
      is_active: method?.is_active ?? true,
      config: {
        address_line1: (method?.config as OfficeConfig)?.address_line1 || '',
        address_line2: (method?.config as OfficeConfig)?.address_line2 || '',
        city: (method?.config as OfficeConfig)?.city || '',
        state: (method?.config as OfficeConfig)?.state || '',
        postal_code: (method?.config as OfficeConfig)?.postal_code || '',
        country: (method?.config as OfficeConfig)?.country || '',
        appointment_required: (method?.config as OfficeConfig)?.appointment_required || '',
      },
    },
  });

  useEffect(() => {
    if (method) {
      form.reset({
        title: method.title,
        description: method.description || '',
        is_active: method.is_active,
        config: method.config as OfficeConfig,
      });
    }
  }, [method, form]);

  const handleSubmit = async (data: OfficeFormData) => {
    console.log('[OfficeMethodForm] Submitting data:', data);
    try {
      await onSave(data);
    } catch (error) {
      console.error('[OfficeMethodForm] Submission error:', error);
    }
  };

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Office Contact Method</CardTitle>
              <CardDescription>Configure office location information</CardDescription>
            </div>
          </div>
          <Switch
            checked={form.watch('is_active')}
            onCheckedChange={(checked) => form.setValue('is_active', checked)}
            disabled={isSubmitting}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="office-title">Title *</Label>
            <Input
              id="office-title"
              {...form.register('title')}
              placeholder="e.g., Visit our office"
              disabled={isSubmitting}
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="office-description">Description</Label>
            <Textarea
              id="office-description"
              {...form.register('description')}
              placeholder="Brief description of this contact method"
              disabled={isSubmitting}
              rows={2}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Address Information</Label>
            
            <div className="space-y-2">
              <Label htmlFor="office-address1">Address Line 1 *</Label>
              <Input
                id="office-address1"
                {...form.register('config.address_line1')}
                placeholder="123 Main Street"
                disabled={isSubmitting}
              />
              {form.formState.errors.config?.address_line1 && (
                <p className="text-sm text-destructive">{form.formState.errors.config.address_line1.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="office-address2">Address Line 2</Label>
              <Input
                id="office-address2"
                {...form.register('config.address_line2')}
                placeholder="Suite 100 (optional)"
                disabled={isSubmitting}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="office-city">City *</Label>
                <Input
                  id="office-city"
                  {...form.register('config.city')}
                  placeholder="San Francisco"
                  disabled={isSubmitting}
                />
                {form.formState.errors.config?.city && (
                  <p className="text-sm text-destructive">{form.formState.errors.config.city.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="office-state">State/Province *</Label>
                <Input
                  id="office-state"
                  {...form.register('config.state')}
                  placeholder="CA"
                  disabled={isSubmitting}
                />
                {form.formState.errors.config?.state && (
                  <p className="text-sm text-destructive">{form.formState.errors.config.state.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="office-postal">Postal Code *</Label>
                <Input
                  id="office-postal"
                  {...form.register('config.postal_code')}
                  placeholder="94102"
                  disabled={isSubmitting}
                />
                {form.formState.errors.config?.postal_code && (
                  <p className="text-sm text-destructive">{form.formState.errors.config.postal_code.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="office-country">Country *</Label>
                <Input
                  id="office-country"
                  {...form.register('config.country')}
                  placeholder="United States"
                  disabled={isSubmitting}
                />
                {form.formState.errors.config?.country && (
                  <p className="text-sm text-destructive">{form.formState.errors.config.country.message}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="office-appointment">Appointment Information *</Label>
            <Textarea
              id="office-appointment"
              {...form.register('config.appointment_required')}
              placeholder="e.g., Please schedule an appointment in advance"
              disabled={isSubmitting}
              rows={2}
            />
            {form.formState.errors.config?.appointment_required && (
              <p className="text-sm text-destructive">{form.formState.errors.config.appointment_required.message}</p>
            )}
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
