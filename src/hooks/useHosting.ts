import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface HostingPlanFeatures {
  planType?: string;
  resources?: Record<string, { total?: number | null }>;
  allowances?: string[];
  selections?: Record<string, string>;
  subscriptionsCount?: number;
  allowedPhpVersions?: string[];
  defaultPhpVersion?: string | null;
  redisAllowed?: boolean;
  persistentAppsAllowed?: boolean;
  allowServerGroupSelection?: boolean;
  serverGroupIds?: string[];
}

export interface HostingPlan {
  id: string;
  enhance_plan_id?: string | null;
  name: string;
  description?: string | null;
  features?: HostingPlanFeatures;
  service_type: string;
  price_monthly: number | string;
  is_active?: boolean;
}

export interface HostingBillingCycle {
  id: string;
  cycle_type: "initial" | "renewal" | "manual";
  period_start: string;
  period_end: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  failure_reason?: string | null;
  payment_transaction_id?: string | null;
  invoice_id?: string | null;
  invoice_number?: string | null;
  refunded_amount: number;
  created_at: string;
}

export interface HostingBillingRefund {
  id: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  original_transaction_id?: string | null;
  original_hosting_billing_cycle_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HostingBillingSummary {
  subscriptionId: string;
  domain: string;
  planName?: string | null;
  renewalAmount: number;
  currency: string;
  status: string;
  paymentStatus: "current" | "due" | "past_due";
  nextBillingAt?: string | null;
  lastBilledAt?: string | null;
  hostingWalletBalance: number;
  latestFailureReason?: string | null;
  cycles: HostingBillingCycle[];
  refunds: HostingBillingRefund[];
}

export const hostingKeys = {
  all: ["hosting"] as const,
  status: () => ["hosting", "status"] as const,
  plans: () => ["hosting", "plans"] as const,
  regions: () => ["hosting", "regions"] as const,
  stagingDomain: () => ["hosting", "staging-domain"] as const,
  nameservers: () => ["hosting", "nameservers"] as const,
  services: () => ["hosting", "services"] as const,
  service: (id: string) => ["hosting", "services", id] as const,
  billing: (id: string) => ["hosting", "services", id, "billing"] as const,
};

export function useHostingStatus() {
  return useQuery({
    queryKey: hostingKeys.status(),
    queryFn: async () => {
      const res = await apiClient.get("/hosting/status");
      return res as { enabled: boolean };
    },
  });
}

export function useHostingPlans() {
  return useQuery({
    queryKey: hostingKeys.plans(),
    queryFn: async () => {
      const res = await apiClient.get("/hosting/plans");
      return res as { plans: HostingPlan[] };
    },
  });
}

export function useHostingRegions() {
  return useQuery({
    queryKey: hostingKeys.regions(),
    queryFn: async () => {
      const res = await apiClient.get("/hosting/regions");
      return res as { regions: any[] };
    },
  });
}

export function useHostingServices() {
  return useQuery({
    queryKey: hostingKeys.services(),
    queryFn: async () => {
      const res = await apiClient.get("/hosting/services");
      return res as { services: any[] };
    },
  });
}

export function useHostingService(id: string) {
  return useQuery({
    queryKey: hostingKeys.service(id),
    queryFn: async () => {
      const res = await apiClient.get(`/hosting/services/${id}`);
      return res as { service: any };
    },
    enabled: !!id,
  });
}

export function useHostingBilling(id: string) {
  return useQuery({
    queryKey: hostingKeys.billing(id),
    queryFn: async () => {
      const res = await apiClient.get(`/hosting/services/${id}/billing`);
      return res as { billing: HostingBillingSummary };
    },
    enabled: !!id,
  });
}

export function useHostingStagingDomain() {
  return useQuery({
    queryKey: hostingKeys.stagingDomain(),
    queryFn: async () => {
      const res = await apiClient.get("/hosting/staging-domain");
      return res as { stagingDomain: string | null };
    },
  });
}

export function useHostingNameservers() {
  return useQuery({
    queryKey: hostingKeys.nameservers(),
    queryFn: async () => {
      const res = await apiClient.get("/hosting/nameservers");
      return res as { ips: string[]; servers: { hostname: string; ips: string[] }[] };
    },
    staleTime: 10 * 60 * 1000,
  });
}
