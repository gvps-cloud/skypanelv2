import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export const hostingKeys = {
  all: ["hosting"] as const,
  status: () => ["hosting", "status"] as const,
  plans: () => ["hosting", "plans"] as const,
  regions: () => ["hosting", "regions"] as const,
  stagingDomain: () => ["hosting", "staging-domain"] as const,
  nameservers: () => ["hosting", "nameservers"] as const,
  services: () => ["hosting", "services"] as const,
  service: (id: string) => ["hosting", "services", id] as const,
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
      return res as { plans: any[] };
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
