import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHostingServices, useHostingPlans, useHostingStatus } from "@/hooks/useHosting";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Hosting() {
  const navigate = useNavigate();
  const { data: statusData } = useHostingStatus();
  const { data: servicesData, isLoading: servicesLoading } = useHostingServices();
  const { data: plansData } = useHostingPlans();

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await apiClient.post(`/hosting/services/${id}/cancel`, {});
      toast.success("Hosting subscription cancelled");
      window.location.reload();
    } catch (error: any) {
      toast.error(error?.message || "Failed to cancel subscription");
    } finally {
      setCancellingId(null);
    }
  };

  if (!statusData?.enabled) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Web Hosting</h1>
        <p className="text-muted-foreground">Web hosting is not currently available.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Web Hosting</h1>
        <Button onClick={() => navigate("/hosting/store")}>
          <Plus className="w-4 h-4 mr-2" />
          New Subscription
        </Button>
      </div>

      {servicesLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!servicesLoading && servicesData?.services?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No hosting subscriptions yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by purchasing your first hosting plan.
            </p>
            <Button onClick={() => navigate("/hosting/store")}>
              Browse Plans
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {servicesData?.services?.map((service: any) => (
          <Card key={service.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/hosting/${service.id}`)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{service.domain}</CardTitle>
                <Badge variant={service.status === "active" ? "default" : "secondary"}>
                  {service.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">{service.plan_name}</p>
              <p className="text-sm text-muted-foreground">{service.service_type}</p>
              {service.primary_ip && (
                <p className="text-sm text-muted-foreground mt-1">{service.primary_ip}</p>
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancel(service.id);
                  }}
                  disabled={cancellingId === service.id || service.status === "cancelled"}
                >
                  {cancellingId === service.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Cancel"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
