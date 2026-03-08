export interface Organization {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  role_id: string | null;
  created_at: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
  role_name?: string;
  permissions?: string[];
}

export interface OrganizationRole {
  id: string;
  organization_id: string;
  name: string;
  permissions: string[];
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationStats {
  organization_id: string;
  vps_count: number;
  ticket_count: number;
  member_count: number;
}

export interface OrganizationWithStats extends Organization {
  member_role: string;
  role_permissions: string[];
  stats: OrganizationStats;
}

export interface OrganizationVPS {
  id: string;
  label: string;
  status: string;
  configuration: {
    type: string;
    region: string;
  };
  ip_address: string | null;
  created_at: string;
}

export interface OrganizationTicket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationResources {
  organization_id: string;
  organization_name: string;
  vps_instances: OrganizationVPS[];
  tickets: OrganizationTicket[];
  permissions: {
    vps_view: boolean;
    vps_create: boolean;
    vps_manage: boolean;
    tickets_view: boolean;
    tickets_create: boolean;
    tickets_manage: boolean;
    billing_view: boolean;
    billing_manage: boolean;
    members_manage: boolean;
    settings_manage: boolean;
  };
}
