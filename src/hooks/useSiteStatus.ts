import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

export interface SiteStatus {
  maintenanceMode: boolean;
  registrationDisabled: boolean;
  maintenanceMessageHtml?: string;
}

export const siteStatusKeys = {
  all: () => ["site-status"] as const,
};

export function useSiteStatus() {
  return useQuery<SiteStatus>({
    queryKey: siteStatusKeys.all(),
    queryFn: async () => {
      const data = await apiClient.get<SiteStatus>("/site-status");
      return {
        maintenanceMode: Boolean(data.maintenanceMode),
        registrationDisabled: Boolean(data.registrationDisabled),
        maintenanceMessageHtml: data.maintenanceMessageHtml,
      };
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });
}
