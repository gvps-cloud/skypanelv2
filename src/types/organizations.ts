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
  ssh_key_count: number;
  member_count: number;
}

export interface OrganizationWithStats extends Organization {
  member_role: string;
  role_permissions: string[];
  stats: OrganizationStats;
  joined_at?: string;
}

export interface OrganizationVPS {
  id: string;
  label: string;
  status: string;
  configuration: {
    type: string;
    region: string;
  };
  plan_name?: string | null;
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

export interface OrganizationSSHKey {
  id: string;
  name: string;
  public_key?: string;
  fingerprint: string;
  linode_key_id?: string | null;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export interface AdminSSHKey extends OrganizationSSHKey {
  organization_id: string;
  organization_name: string;
  public_key: string; // Required for admin view
}

export interface OrganizationResources {
  organization_id: string;
  organization_name: string;
  vps_instances: OrganizationVPS[];
  ssh_keys: OrganizationSSHKey[];
  tickets: OrganizationTicket[];
  permissions: {
    vps_view: boolean;
    vps_create: boolean;
    vps_delete: boolean;
    vps_manage: boolean;
    ssh_keys_view: boolean;
    ssh_keys_manage: boolean;
    tickets_view: boolean;
    tickets_create: boolean;
    tickets_manage: boolean;
    billing_view: boolean;
    billing_manage: boolean;
    egress_view: boolean;
    egress_manage: boolean;
    members_manage: boolean;
    settings_manage: boolean;
  };
}

export interface OrganizationEgressServerCharge {
  billingMonth: string;
  poolId: string;
  poolScope: "global" | "region";
  regionId: string | null;
  vpsInstanceId: string | null;
  providerInstanceId: string | null;
  label: string;
  measuredUsageGb: number;
  allocatedBillableGb: number;
  unitPricePerGb: number;
  amount: number;
  status: "projected" | "pending" | "billed" | "failed" | "void";
  updatedAt: string;
}

export interface OrganizationEgressOverview {
  organizationId: string;
  billingMonth: string;
  projectedTotals: {
    totalMeasuredUsageGb: number;
    totalBillableGb: number;
    totalAmount: number;
    activePoolCount: number;
    billingEnabledPoolCount: number;
    updatedAt: string | null;
  };
  servers: OrganizationEgressServerCharge[];
  recentCycles: EgressBillingHistoryRecord[];
}

export interface EgressBillingHistoryRecord {
  id: string;
  billingMonth: string;
  poolId: string;
  poolScope: "global" | "region";
  regionId: string | null;
  organizationId: string;
  organizationName: string | null;
  totalMeasuredUsageGb: number;
  allocatedPoolQuotaGb: number;
  allocatedBillableGb: number;
  unitPricePerGb: number;
  totalAmount: number;
  status: "projected" | "pending" | "billed" | "failed" | "void";
  billedTransactionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationEgressCredits {
  organizationId: string;
  creditsGb: number;
  warning: boolean;
  purchaseHistory: OrganizationEgressCreditPurchase[];
}

export interface OrganizationEgressCreditPurchase {
  id: string;
  organizationId: string;
  packId: string;
  creditsGb: number;
  amountPaid: number;
  paymentTransactionId: string | null;
  createdAt: string;
}
