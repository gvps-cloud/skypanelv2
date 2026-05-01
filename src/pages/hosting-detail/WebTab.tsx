import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import WebsiteStatusCard from "./web-tab/WebsiteStatusCard";
import PhpSettingsCard from "./web-tab/PhpSettingsCard";
import PhpExtensionsCard from "./web-tab/PhpExtensionsCard";
import PhpErrorLogCard from "./web-tab/PhpErrorLogCard";
import PhpIniEditorCard from "./web-tab/PhpIniEditorCard";
import IoncubeRedisCard from "./web-tab/IoncubeRedisCard";
import NginxCacheCard from "./web-tab/NginxCacheCard";
import RewritesCard from "./web-tab/RewritesCard";
import MailSslCard from "./web-tab/MailSslCard";
import MetricsCard from "./web-tab/MetricsCard";
import FileManagerCard from "./web-tab/FileManagerCard";

interface Domain {
  id: string;
  domain: string;
}

interface WebTabProps {
  subscriptionId: string;
}

export default function WebTab({ subscriptionId }: WebTabProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [filerdAddress, setFilerdAddress] = useState<string | undefined>();
  const [enhanceApiUrl, _setEnhanceApiUrl] = useState<string | undefined>();

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

  const loadWebsiteMeta = useCallback(async () => {
    if (!subscriptionId) return;
    try {
      const data = await apiClient.get<Record<string, any>>(
        `/hosting/web/${subscriptionId}/website`
      );
      setFilerdAddress(data?.filerdAddress);
    } catch {
    }
  }, [subscriptionId]);

  useEffect(() => {
    loadDomains();
    loadWebsiteMeta();
  }, [loadDomains, loadWebsiteMeta]);

  return (
    <div className="space-y-6">
      <WebsiteStatusCard subscriptionId={subscriptionId} />
      <PhpSettingsCard subscriptionId={subscriptionId} />
      <PhpExtensionsCard subscriptionId={subscriptionId} />
      <PhpIniEditorCard subscriptionId={subscriptionId} />
      <PhpErrorLogCard subscriptionId={subscriptionId} />
      <IoncubeRedisCard subscriptionId={subscriptionId} />
      <NginxCacheCard subscriptionId={subscriptionId} domains={domains} />
      <RewritesCard subscriptionId={subscriptionId} domains={domains} />
      <MailSslCard subscriptionId={subscriptionId} domains={domains} />
      <MetricsCard subscriptionId={subscriptionId} />
      <FileManagerCard filerdAddress={filerdAddress} enhanceApiUrl={enhanceApiUrl} />
    </div>
  );
}
