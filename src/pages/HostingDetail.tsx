import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import OverviewTab from "./hosting-detail/OverviewTab";
import WebTab from "./hosting-detail/WebTab";
import DnsTab from "./hosting-detail/DnsTab";
import EmailTab from "./hosting-detail/EmailTab";
import FtpTab from "./hosting-detail/FtpTab";
import SslTab from "./hosting-detail/SslTab";
import MysqlTab from "./hosting-detail/MysqlTab";
import AppsTab from "./hosting-detail/AppsTab";
import WordPressTab from "./hosting-detail/WordPressTab";
import JoomlaTab from "./hosting-detail/JoomlaTab";
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
  { id: "joomla", label: "Joomla", icon: Puzzle },
  { id: "runtime", label: "Node.js", icon: Zap },
  { id: "backups", label: "Backups", icon: Archive },
  { id: "cron", label: "Cron", icon: Clock },
  { id: "ssh", label: "SSH", icon: Key },
];

export default function HostingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [service, setService] = useState<Record<string, any> | null>(null);
  const [serviceLoading, setServiceLoading] = useState(true);
  const [ssoLoading, setSsoLoading] = useState(false);

  const loadService = useCallback(async () => {
    if (!id) return;
    setServiceLoading(true);
    try {
      const data = await apiClient.get<{ service: Record<string, any> }>(
        `/hosting/services/${id}`
      );
      setService(data.service ?? null);
    } catch {
      toast.error("No active hosting plan found.");
      navigate("/hosting", { replace: true });
    } finally {
      setServiceLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadService();
  }, [loadService]);

  const handleSso = async () => {
    setSsoLoading(true);
    try {
      const data = await apiClient.post<{ url: string }>("/hosting/sso", {});
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        return;
      }

      toast.error("No Enhance panel link was returned");
    } catch (error: any) {
      toast.error(error?.message || "Failed to open hosting panel");
    } finally {
      setSsoLoading(false);
    }
  };

  if (!id) {
    return (
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <p className="text-muted-foreground">Invalid subscription ID.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-card-foreground shadow-sm">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {service?.domain || service?.plan_name || "Hosting Details"}
            </h1>
            <p className="text-sm text-muted-foreground">Manage your hosting subscription and website settings.</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleSso} disabled={serviceLoading || ssoLoading || !service}>
          {ssoLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="mr-2 h-4 w-4" />
          )}
          Open Enhance Panel
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 shrink-0">
          <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <div className="space-y-6">
            {activeTab === "overview" &&
              (serviceLoading ? (
                <div className="flex items-center justify-center py-12 rounded-xl border border-dashed border-border bg-card/50">
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
            {activeTab === "joomla" && <JoomlaTab subscriptionId={id} />}
            {activeTab === "runtime" && <RuntimeTab subscriptionId={id} />}
            {activeTab === "backups" && <BackupsTab subscriptionId={id} />}
            {activeTab === "cron" && <CronTab subscriptionId={id} />}
            {activeTab === "ssh" && <SshKeysTab subscriptionId={id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
