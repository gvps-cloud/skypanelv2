import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const enhanceAdminKeys = {
  all: ["enhance-admin"] as const,
  status: () => ["enhance-admin", "status"] as const,
  plans: () => ["enhance-admin", "plans"] as const,
  subscriptions: () => ["enhance-admin", "subscriptions"] as const,
};

export function useEnhanceAdminStatus() {
  return useQuery({
    queryKey: enhanceAdminKeys.status(),
    queryFn: async () => {
      const res = await apiClient.get("/admin/enhance/status");
      return res as any;
    },
  });
}

export function useEnhanceAdminPlans() {
  return useQuery({
    queryKey: enhanceAdminKeys.plans(),
    queryFn: async () => {
      const res = await apiClient.get("/admin/enhance/plans");
      return res as { plans: any[] };
    },
  });
}

export function useEnhanceAdminSubscriptions() {
  return useQuery({
    queryKey: enhanceAdminKeys.subscriptions(),
    queryFn: async () => {
      const res = await apiClient.get("/admin/enhance/subscriptions");
      return res as { subscriptions: any[] };
    },
  });
}
