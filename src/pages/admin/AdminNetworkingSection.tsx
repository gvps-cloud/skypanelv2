import React from "react";
import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NetworkingDashboard } from "@/components/admin/networking/NetworkingDashboard";

type AdminNetworkingTab = "rdns" | "ips" | "vlans" | "firewalls" | "assign" | "share";

interface AdminNetworkingSectionProps {
  networkingTab: AdminNetworkingTab;
  rdnsBaseDomain: string;
  rdnsLoading: boolean;
  rdnsSaving: boolean;
  onNetworkingTabChange: (value: string) => void;
  onRdnsBaseDomainChange: (value: string) => void;
  onSaveNetworkingRdns: () => void;
}

export const AdminNetworkingSection: React.FC<AdminNetworkingSectionProps> = ({
  networkingTab,
  rdnsBaseDomain,
  rdnsLoading,
  rdnsSaving,
  onNetworkingTabChange,
  onRdnsBaseDomainChange,
  onSaveNetworkingRdns,
}) => {
  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10">
          <Badge variant="secondary" className="mb-3">
            Network Configuration
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Networking Controls
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Configure reverse DNS defaults and IP address management settings
          </p>
        </div>

        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Globe className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      </div>

      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle>Network Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={networkingTab} onValueChange={onNetworkingTabChange}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="rdns">Reverse DNS</TabsTrigger>
              <TabsTrigger value="ips">IP Addresses</TabsTrigger>
              <TabsTrigger value="vlans">VLANs</TabsTrigger>
              <TabsTrigger value="firewalls">Firewalls</TabsTrigger>
              <TabsTrigger value="assign">Assign IPs</TabsTrigger>
              <TabsTrigger value="share">Share IPs</TabsTrigger>
            </TabsList>
            <TabsContent value="rdns" className="space-y-6 pt-6">
              <div className="space-y-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Reverse DNS Template
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Define the base domain used when setting custom rDNS for VPS instances. If unset, the system falls back to <span className="font-mono">ip.rev.example.com</span>.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rdns-domain">rDNS base domain</Label>
                    <Input
                      id="rdns-domain"
                      value={rdnsBaseDomain}
                      onChange={(e) => onRdnsBaseDomainChange(e.target.value)}
                      placeholder="ip.rev.example.com"
                      disabled={rdnsLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Example final rDNS: <span className="font-mono">123-45-67-89.{rdnsBaseDomain || "ip.rev.example.com"}</span>
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={onSaveNetworkingRdns}
                    disabled={rdnsSaving || rdnsLoading}
                    className="gap-2"
                  >
                    {rdnsSaving ? "Saving…" : "Save rDNS Template"}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ips" className="pt-6">
              <NetworkingDashboard tab="ips" />
            </TabsContent>
            <TabsContent value="vlans" className="pt-6">
              <NetworkingDashboard tab="vlans" />
            </TabsContent>
            <TabsContent value="firewalls" className="pt-6">
              <NetworkingDashboard tab="firewalls" />
            </TabsContent>
            <TabsContent value="assign" className="pt-6">
              <NetworkingDashboard tab="assign" />
            </TabsContent>
            <TabsContent value="share" className="pt-6">
              <NetworkingDashboard tab="share" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
};
