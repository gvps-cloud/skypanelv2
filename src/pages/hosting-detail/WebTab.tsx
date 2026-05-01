import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WebsiteStatusCard from "./web-tab/WebsiteStatusCard";
import PhpSettingsCard from "./web-tab/PhpSettingsCard";
import PhpExtensionsCard from "./web-tab/PhpExtensionsCard";
import PhpErrorLogCard from "./web-tab/PhpErrorLogCard";
import PhpIniEditorCard from "./web-tab/PhpIniEditorCard";
import IoncubeRedisCard from "./web-tab/IoncubeRedisCard";
import NginxCacheCard from "./web-tab/NginxCacheCard";
import RewritesCard from "./web-tab/RewritesCard";
import MetricsCard from "./web-tab/MetricsCard";

interface Domain {
  id: string;
  domain: string;
}

interface WebTabProps {
  subscriptionId: string;
}

export default function WebTab({ subscriptionId }: WebTabProps) {
  const [domains, setDomains] = useState<Domain[]>([]);

  const loadDomains = useCallback(async () => {
    if (!subscriptionId) return;
    try {
      const data = await apiClient.get<{ domains: Domain[] }>(
        `/hosting/dns/${subscriptionId}/domains`
      );
      setDomains(
        (data?.domains ?? []).map((d: any) => ({
          id: d.id,
          domain: d.domain,
        }))
      );
    } catch {
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="mb-6 h-auto flex-wrap p-1 gap-1">
        <TabsTrigger value="general" className="rounded-md">General</TabsTrigger>
        <TabsTrigger value="php" className="rounded-md">PHP</TabsTrigger>
        <TabsTrigger value="webserver" className="rounded-md">Web Server</TabsTrigger>
        <TabsTrigger value="security" className="rounded-md">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="space-y-6 outline-none mt-0">
        <WebsiteStatusCard subscriptionId={subscriptionId} />
        <MetricsCard subscriptionId={subscriptionId} />
      </TabsContent>

      <TabsContent value="php" className="space-y-6 outline-none mt-0">
        <PhpSettingsCard subscriptionId={subscriptionId} />
        <PhpExtensionsCard subscriptionId={subscriptionId} />
        <PhpIniEditorCard subscriptionId={subscriptionId} />
        <PhpErrorLogCard subscriptionId={subscriptionId} />
      </TabsContent>

      <TabsContent value="webserver" className="space-y-6 outline-none mt-0">
        <RewritesCard subscriptionId={subscriptionId} domains={domains} />
        <NginxCacheCard subscriptionId={subscriptionId} domains={domains} />
        <IoncubeRedisCard subscriptionId={subscriptionId} />
      </TabsContent>

      <TabsContent value="security" className="space-y-6 outline-none mt-0">
      </TabsContent>
    </Tabs>
  );
}
