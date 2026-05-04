import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const enhanceAdminKeys = {
  all: ["enhance-admin"] as const,
  status: () => ["enhance-admin", "status"] as const,
  plans: () => ["enhance-admin", "plans"] as const,
  subscriptions: (options?: { page?: number; limit?: number; status?: string }) =>
    ["enhance-admin", "subscriptions", options ?? {}] as const,
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

export function useEnhanceAdminSubscriptions(options?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const { page = 1, limit = 10, status } = options ?? {};
  return useQuery({
    queryKey: enhanceAdminKeys.subscriptions({ page, limit, status }),
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (status && status !== "all") {
        params.set("status", status);
      }
      const res = await apiClient.get(`/admin/enhance/subscriptions?${params}`);
      return res as {
        subscriptions: any[];
        pagination: { total: number; page: number; limit: number; offset: number; totalPages: number };
      };
    },
  });
}
