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
import { TerminalPageHeader } from "@/components/terminal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const isResellerPlan = service?.is_reseller_plan === true;
  const visibleTabs = isResellerPlan ? tabs.filter((tab) => tab.id === "overview") : tabs;

  const loadService = useCallback(async () => {
    if (!id) return;
    setServiceLoading(true);
    try {
      const data = await apiClient.get<{ service: Record<string, any> }>(
        `/hosting/services/${id}`
      );
      setService(data.service ?? null);
      if (data.service?.is_reseller_plan) {
        setActiveTab("overview");
      }
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
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 font-mono">
      <TerminalPageHeader pathPrefix={`~/hosting/${id}`} command="subscription --manage" />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-card text-card-foreground shadow-sm">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {service?.domain || service?.plan_name || "Hosting Details"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isResellerPlan
                ? "View your reseller hosting summary and open Enhance for management."
                : "Manage your hosting subscription and website settings."}
            </p>
          </div>
        </div>
        {!isResellerPlan && (
          <Button variant="outline" onClick={handleSso} disabled={serviceLoading || ssoLoading || !service}>
            {ssoLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Open Enhance Panel
          </Button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        {!isResellerPlan && (
          <div className="w-full lg:w-64 shrink-0">
            <nav className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 no-scrollbar">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm font-medium rounded-sm transition-colors whitespace-nowrap",
                      activeTab === tab.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 min-w-0">
          <div className="space-y-6">
            {isResellerPlan && (
              <Card className="border-primary/25 bg-primary/5">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Reseller hosting is managed in Enhance</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This page is read-only. Use the Enhance panel to manage reseller customers, packages, websites, DNS, email, SSL, databases, apps, backups, cron, and SSH access.
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleSso} disabled={serviceLoading || ssoLoading || !service}>
                    {ssoLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="mr-2 h-4 w-4" />
                    )}
                    Open Enhance Panel
                  </Button>
                </CardContent>
              </Card>
            )}
            {activeTab === "overview" &&
              (serviceLoading ? (
                <div className="flex items-center justify-center py-12 rounded-xl border border-dashed border-border bg-card/50">
                  <Activity className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading service details...
                  </span>
                </div>
              ) : (
                <OverviewTab service={service ?? {}} readOnly={isResellerPlan} />
              ))}
            {!isResellerPlan && activeTab === "web" && <WebTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "dns" && <DnsTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "email" && <EmailTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "ftp" && <FtpTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "ssl" && <SslTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "mysql" && <MysqlTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "apps" && <AppsTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "wordpress" && <WordPressTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "joomla" && <JoomlaTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "runtime" && <RuntimeTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "backups" && <BackupsTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "cron" && <CronTab subscriptionId={id} />}
            {!isResellerPlan && activeTab === "ssh" && <SshKeysTab subscriptionId={id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
