import { Link } from "react-router-dom";
import { Award, Globe, Shield, Target, Users, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PublicLayout from "@/components/PublicLayout";
import { BRAND_NAME } from "@/lib/brand";
import api from "@/lib/api";

interface PlatformStats {
  users: { total: number; admins: number; regular: number };
  vps: { total: number; active: number };
  support: { totalTickets: number; openTickets: number };
  plans: { vpsPlans: number; containerPlans: number };
  regions: { total: number };
}

const values = [
  { title: "Reliability first", description: "99.99% uptime SLAs, redundant networking, and proactive alerting in every region.", icon: Shield },
  { title: "Developer delight", description: "Intuitive UI, API-first control plane, and consistent account management for teams.", icon: Zap },
  { title: "Transparent pricing", description: "Simple hourly billing, usage alerts, and no hidden egress buckets.", icon: Award },
  { title: "Global reach", description: "Deploy infrastructure next to customers with 20+ regions and growing.", icon: Globe },
  { title: "Human support", description: "24/7 engineering support and onboarding help for every plan.", icon: Users },
  { title: "Security by design", description: "SSH hardening, audit logs, and policy guards at platform level.", icon: Target },
];

export default function AboutUs() {
  const { data: stats, isLoading, isError } = useQuery<PlatformStats>({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const response = await api.get<any>("/health/platform-stats");
      const { success, timestamp, ...payload } = response;
      return payload as PlatformStats;
    },
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  const formatStat = (value?: number) => (typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "N/A");

  return (
    <PublicLayout>
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <section className="space-y-6 text-center">
          <Badge variant="outline" className="mx-auto uppercase tracking-wide">About {BRAND_NAME}</Badge>
          <h1 className="text-3xl font-semibold md:text-5xl">Infrastructure without friction</h1>
          <p className="mx-auto max-w-3xl text-base text-muted-foreground md:text-lg">{BRAND_NAME} is built for teams who need cloud speed with trusted governance. Provision VPS, manage egress, and trace spend from one dashboard.</p>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-3">
          <Card className="col-span-3 md:col-span-2">
            <CardHeader>
              <CardTitle>Our mission</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Provide predictable, secure infrastructure and billing for product teams who move fast. We combine automation-first workflows with peer-grade support to reduce time-to-production.
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Key metrics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, idx) => <Skeleton key={idx} className="h-10 w-full" />)
              ) : isError ? (
                <p className="text-sm text-destructive">Unable to load live metrics.</p>
              ) : (
                <div className="grid gap-2">
                  <div className="flex justify-between"><span className="text-sm">Total users</span><strong>{formatStat(stats?.users.regular)}</strong></div>
                  <div className="flex justify-between"><span className="text-sm">VPS deployed</span><strong>{formatStat(stats?.vps.total)}</strong></div>
                  <div className="flex justify-between"><span className="text-sm">Open tickets</span><strong>{formatStat(stats?.support.openTickets)}</strong></div>
                  <div className="flex justify-between"><span className="text-sm">Regions</span><strong>{formatStat(stats?.regions.total)}</strong></div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-center">What drives us</h2>
          <p className="text-center text-muted-foreground mt-2">A single source of truth for cloud infrastructure teams, from developer environment to production billing.</p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {values.map((item) => (
              <Card key={item.title} className="border-border/80 bg-background">
                <CardHeader>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="space-y-4">
              <h3 className="text-xl font-semibold">Ready to launch your first deployment?</h3>
              <p className="text-sm text-muted-foreground">Start with a free account, onboard in minutes, and scale across regions without surprise bills.</p>
              <div className="flex gap-3">
                <Button asChild size="lg"><Link to="/register">Get started</Link></Button>
                <Button asChild size="lg" variant="outline"><Link to="/contact">Talk to sales</Link></Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h3 className="text-xl font-semibold">Keep controls, cut complexity</h3>
              <p className="text-sm text-muted-foreground">Unified role-based access, billing visibility, and API key management for secure and scalable operations.</p>
              <Badge variant="outline">Secure by default</Badge>
              <Badge variant="outline">API & CLI ready</Badge>
              <Badge variant="outline">24/7 support</Badge>
            </CardContent>
          </Card>
        </section>
      </div>
    </PublicLayout>
  );
}
