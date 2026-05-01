import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Globe,
  Server,
  Mail,
  Users,
  Shield,
  Activity,
  LayoutDashboard,
  Database,
  Puzzle,
  Zap,
  Archive,
  Clock,
  Key,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import OverviewTab from "./hosting-detail/OverviewTab";
import WebTab from "./hosting-detail/WebTab";
import DnsTab from "./hosting-detail/DnsTab";
import EmailTab from "./hosting-detail/EmailTab";
import FtpTab from "./hosting-detail/FtpTab";
import SslTab from "./hosting-detail/SslTab";
import MysqlTab from "./hosting-detail/MysqlTab";
import AppsTab from "./hosting-detail/AppsTab";
import WordPressTab from "./hosting-detail/WordPressTab";
import RuntimeTab from "./hosting-detail/RuntimeTab";
import BackupsTab from "./hosting-detail/BackupsTab";
import CronTab from "./hosting-detail/CronTab";
import SshKeysTab from "./hosting-detail/SshKeysTab";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "web", label: "Web", icon: Globe },
  { id: "dns", label: "DNS", icon: Server },
  { id: "email", label: "Email", icon: Mail },
  { id: "ftp", label: "FTP", icon: Users },
  { id: "ssl", label: "SSL", icon: Shield },
  { id: "mysql", label: "MySQL", icon: Database },
  { id: "apps", label: "Apps", icon: Puzzle },
  { id: "wordpress", label: "WordPress", icon: Globe },
  { id: "runtime", label: "Runtime", icon: Zap },
  { id: "backups", label: "Backups", icon: Archive },
  { id: "cron", label: "Cron", icon: Clock },
  { id: "ssh", label: "SSH", icon: Key },
];

export default function HostingDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("overview");
  const [service, setService] = useState<Record<string, any> | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);

  const loadService = useCallback(async () => {
    if (!id) return;
    setServiceLoading(true);
    try {
      const data = await apiClient.get<{ service: Record<string, any> }>(
        `/hosting/services/${id}`
      );
      setService(data.service ?? null);
    } catch {
      setService(null);
    } finally {
      setServiceLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadService();
  }, [loadService]);

  if (!id) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-muted-foreground">Invalid subscription ID.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-2 mb-6">
        <Activity className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">
          {service?.domain || service?.plan_name || "Hosting Details"}
        </h1>
      </div>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">
        {activeTab === "overview" &&
          (serviceLoading ? (
            <div className="flex items-center justify-center py-12">
              <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading service details...
              </span>
            </div>
          ) : (
            <OverviewTab service={service ?? {}} />
          ))}
        {activeTab === "web" && <WebTab subscriptionId={id} />}
        {activeTab === "dns" && <DnsTab subscriptionId={id} />}
        {activeTab === "email" && <EmailTab subscriptionId={id} />}
        {activeTab === "ftp" && <FtpTab subscriptionId={id} />}
        {activeTab === "ssl" && <SslTab subscriptionId={id} />}
        {activeTab === "mysql" && <MysqlTab subscriptionId={id} />}
        {activeTab === "apps" && <AppsTab subscriptionId={id} />}
        {activeTab === "wordpress" && <WordPressTab subscriptionId={id} />}
        {activeTab === "runtime" && <RuntimeTab subscriptionId={id} />}
        {activeTab === "backups" && <BackupsTab subscriptionId={id} />}
        {activeTab === "cron" && <CronTab subscriptionId={id} />}
        {activeTab === "ssh" && <SshKeysTab subscriptionId={id} />}
      </div>
    </div>
  );
}
