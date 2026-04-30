// Contact Category Types
export interface ContactCategory {
  id: string;
  label: string;
  value: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Contact Method Configuration Types
export interface EmailConfig {
  email_address: string;
  response_time: string;
}

export interface TicketConfig {
  dashboard_link: string;
  priority_queues: Array<{
    label: string;
    response_time: string;
  }>;
}

export interface PhoneConfig {
  phone_number: string;
  availability_text: string;
}

export interface OfficeConfig {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  appointment_required: string;
}

// Contact Method Types
export type ContactMethodType = 'email' | 'ticket' | 'phone' | 'office';

export interface ContactMethod {
  id: string;
  method_type: ContactMethodType;
  title: string;
  description: string | null;
  is_active: boolean;
  config: EmailConfig | TicketConfig | PhoneConfig | OfficeConfig;
  created_at: string;
  updated_at: string;
}

// Platform Availability Types
export interface PlatformAvailability {
  id: string;
  day_of_week: string;
  is_open: boolean;
  hours_text: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// API Response Types
export interface ContactConfig {
  categories: ContactCategory[];
  methods: {
    email?: ContactMethod;
    ticket?: ContactMethod;
    phone?: ContactMethod;
    office?: ContactMethod;
  };
  availability: PlatformAvailability[];
  emergency_support_text?: string;
}

// Form Data Types for Admin Components
export interface CategoryFormData {
  label: string;
  value: string;
  is_active?: boolean;
}

export interface EmailMethodFormData {
  title: string;
  description?: string;
  is_active?: boolean;
  config: EmailConfig;
}

export interface TicketMethodFormData {
  title: string;
  description?: string;
  is_active?: boolean;
  config: TicketConfig;
}

export interface PhoneMethodFormData {
  title: string;
  description?: string;
  is_active?: boolean;
  config: PhoneConfig;
}

export interface OfficeMethodFormData {
  title: string;
  description?: string;
  is_active?: boolean;
  config: OfficeConfig;
}

export type MethodFormData =
  | EmailMethodFormData
  | TicketMethodFormData
  | PhoneMethodFormData
  | OfficeMethodFormData;

export interface AvailabilitySchedule {
  day_of_week: string;
  is_open: boolean;
  hours_text: string;
}

export interface AvailabilityFormData {
  schedules: AvailabilitySchedule[];
  emergency_support_text?: string;
}

// Reorder Types
export interface CategoryReorderData {
  categories: Array<{
    id: string;
    display_order: number;
  }>;
}
