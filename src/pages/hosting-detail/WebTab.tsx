import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import WebsiteStatusCard from "./web-tab/WebsiteStatusCard";
import PhpSettingsCard from "./web-tab/PhpSettingsCard";
import PhpExtensionsCard from "./web-tab/PhpExtensionsCard";
import PhpErrorLogCard from "./web-tab/PhpErrorLogCard";
import PhpIniEditorCard from "./web-tab/PhpIniEditorCard";
import IoncubeRedisCard from "./web-tab/IoncubeRedisCard";
import NginxCacheCard from "./web-tab/NginxCacheCard";
import RedisCard from "./web-tab/RedisCard";
import RewritesCard from "./web-tab/RewritesCard";
import MetricsCard from "./web-tab/MetricsCard";
import HtaccessIpRulesCard from "./web-tab/HtaccessIpRulesCard";
import LsphpSettingsCard from "./web-tab/LsphpSettingsCard";
import ModSecurityCard from "./web-tab/ModSecurityCard";
import VhostEditorCard from "./web-tab/VhostEditorCard";
import WebserverProfileCard from "./web-tab/WebserverProfileCard";
import { getWebserverToolCapabilities, normalizeWebserverKind, type WebserverKind } from "./web-tab/webserverTools";

interface Domain {
  id: string;
  domain: string;
}

interface WebTabProps {
  subscriptionId: string;
}

export default function WebTab({ subscriptionId }: WebTabProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [webserverKind, setWebserverKind] = useState<WebserverKind>("unknown");
  const [webserverLoading, setWebserverLoading] = useState(true);

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

  const loadWebserverKind = useCallback(async () => {
    if (!subscriptionId) return;
    setWebserverLoading(true);
    try {
      const data = await apiClient.get<{ kind: WebserverKind }>(`/hosting/web/${subscriptionId}/webserver-kind`);
      setWebserverKind(normalizeWebserverKind(data?.kind));
    } catch {
      setWebserverKind("unknown");
    } finally {
      setWebserverLoading(false);
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadDomains();
    loadWebserverKind();
  }, [loadDomains, loadWebserverKind]);

  const capabilities = getWebserverToolCapabilities(webserverKind);

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="mb-6 h-auto flex-wrap p-1 gap-1">
        <TabsTrigger value="general" className="rounded-md">General</TabsTrigger>
        <TabsTrigger value="php" className="rounded-md">PHP</TabsTrigger>
        <TabsTrigger value="webserver" className="rounded-md">Web Server</TabsTrigger>
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
        {webserverLoading ? (
          <section className="rounded-2xl cyber-card cyber-card--hover">
            <div className="flex items-center justify-center px-6 py-12 sm:px-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Detecting web server...</span>
            </div>
          </section>
        ) : (
          <>
            <WebserverProfileCard kind={webserverKind} capabilities={capabilities} />
            {capabilities.rewritesMode && (
              <RewritesCard subscriptionId={subscriptionId} domains={domains} mode={capabilities.rewritesMode} />
            )}
            {capabilities.htaccessIps && <HtaccessIpRulesCard subscriptionId={subscriptionId} />}
            {capabilities.nginxFastCgi && <NginxCacheCard subscriptionId={subscriptionId} domains={domains} />}
            {capabilities.modSecurity && <ModSecurityCard subscriptionId={subscriptionId} domains={domains} />}
            {capabilities.lsphpSettings && <LsphpSettingsCard subscriptionId={subscriptionId} />}
            {capabilities.vhostWebserver && (
              <VhostEditorCard subscriptionId={subscriptionId} domains={domains} webserver={capabilities.vhostWebserver} />
            )}
          </>
        )}
        <IoncubeRedisCard subscriptionId={subscriptionId} />
        <RedisCard subscriptionId={subscriptionId} />
      </TabsContent>

    </Tabs>
  );
}
