import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHostingPlans, useHostingRegions, useHostingStatus, useHostingStagingDomain } from "@/hooks/useHosting";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Globe, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function HostingStore() {
  const navigate = useNavigate();
  const { data: statusData } = useHostingStatus();
  const { data: plansData, isLoading: plansLoading } = useHostingPlans();
  const { data: regionsData } = useHostingRegions();
  const { data: stagingDomainData } = useHostingStagingDomain();

  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [domain, setDomain] = useState("");
  const [useStaging, setUseStaging] = useState(false);
  const [regionId, setRegionId] = useState("");
  const [purchasing, setPurchasing] = useState(false);

  const stagingSuffix = stagingDomainData?.stagingDomain || null;
  const canUseStaging = !!stagingSuffix;
  const effectiveDomain = useStaging ? "" : domain;
  const hasDomain = useStaging || domain.trim().length > 0;

  const handlePurchase = async () => {
    if (!selectedPlan) {
      toast.error("Please select a plan");
      return;
    }
    if (!useStaging && !domain.trim()) {
      toast.error("Please enter a domain or use a free staging domain");
      return;
    }

    setPurchasing(true);
    try {
      const payload: Record<string, any> = {
        planId: selectedPlan,
        regionId: regionId || undefined,
      };

      if (useStaging) {
        payload.useStagingDomain = true;
      } else {
        payload.domain = domain.trim();
      }

      const response = await apiClient.post<{
        credentialsCreated?: boolean;
        credentialsEmailed?: boolean;
        stagingDomain?: string;
      }>("/hosting/purchase", payload);

      if (response?.stagingDomain) {
        toast.success(`Hosting subscription purchased! Your staging domain: ${response.stagingDomain}`);
      } else if (response?.credentialsCreated && response?.credentialsEmailed) {
        toast.success("Hosting subscription purchased. Your hosting panel credentials were emailed.");
      } else if (response?.credentialsCreated) {
        toast.success("Hosting subscription purchased. Your hosting account was created; if the email does not arrive, use the panel password reset.");
      } else {
        toast.success("Hosting subscription purchased successfully");
      }
      navigate("/hosting");
    } catch (error: any) {
      toast.error(error?.message || "Failed to purchase hosting");
    } finally {
      setPurchasing(false);
    }
  };

  if (!statusData?.enabled) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Hosting Store</h1>
        <p className="text-muted-foreground">Web hosting is not currently available.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Hosting Store</h1>

      {plansLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        {plansData?.plans?.map((plan: any) => (
          <Card
            key={plan.id}
            className={`cursor-pointer transition-all ${selectedPlan === plan.id ? "ring-2 ring-primary" : ""}`}
            onClick={() => setSelectedPlan(plan.id)}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{plan.name}</span>
                {selectedPlan === plan.id && <Check className="w-5 h-5 text-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold mb-2">
                ${plan.price_monthly}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
              <Badge variant="outline" className="capitalize">
                {plan.service_type}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configure Your Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="domain">
              {useStaging ? "Staging Domain" : "Domain"}
            </Label>
            {canUseStaging && (
              <button
                type="button"
                onClick={() => setUseStaging(!useStaging)}
                className="text-sm text-primary hover:underline"
              >
                {useStaging ? "I have my own domain" : "I don't have a domain"}
              </button>
            )}
          </div>

          {useStaging ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span>A random subdomain on </span>
              <code className="font-mono text-foreground">{stagingSuffix}</code>
              <span> will be assigned automatically</span>
            </div>
          ) : (
            <Input
              id="domain"
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          )}

          {regionsData?.regions && regionsData.regions.length > 0 && (
            <div>
              <Label htmlFor="region">Region (optional)</Label>
              <Select value={regionId} onValueChange={setRegionId}>
                <SelectTrigger id="region">
                  <SelectValue placeholder="Select a region" />
                </SelectTrigger>
                <SelectContent>
                  {regionsData.regions.map((region: any) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            onClick={handlePurchase}
            disabled={purchasing || !selectedPlan || !hasDomain}
            className="w-full"
          >
            {purchasing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Purchase Subscription</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
