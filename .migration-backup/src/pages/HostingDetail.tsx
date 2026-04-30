import { useState } from "react";
import { useParams } from "react-router-dom";
import { Globe, Server, Mail, Users, Shield, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import WebTab from "./hosting-detail/WebTab";
import DnsTab from "./hosting-detail/DnsTab";
import EmailTab from "./hosting-detail/EmailTab";
import FtpTab from "./hosting-detail/FtpTab";
import SslTab from "./hosting-detail/SslTab";

const tabs = [
  { id: "web", label: "Web", icon: Globe },
  { id: "dns", label: "DNS", icon: Server },
  { id: "email", label: "Email", icon: Mail },
  { id: "ftp", label: "FTP", icon: Users },
  { id: "ssl", label: "SSL", icon: Shield },
];

export default function HostingDetail() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("web");

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
        <h1 className="text-2xl font-bold">Hosting Details</h1>
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
        {activeTab === "web" && <WebTab subscriptionId={id} />}
        {activeTab === "dns" && <DnsTab subscriptionId={id} />}
        {activeTab === "email" && <EmailTab subscriptionId={id} />}
        {activeTab === "ftp" && <FtpTab subscriptionId={id} />}
        {activeTab === "ssl" && <SslTab subscriptionId={id} />}
      </div>
    </div>
  );
}
