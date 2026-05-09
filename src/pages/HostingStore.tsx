import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import {
  useHostingPlans,
  useHostingRegions,
  useHostingStatus,
  hostingKeys,
  type HostingPlan,
} from "@/hooks/useHosting";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, ArrowLeft, Server } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { formatBillingAmount } from "@/lib/formatters";
import { TerminalPageHeader } from "@/components/terminal";
import { formatCapacity } from "@/lib/hostingPlanFeatures";

const formatResource = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === -1) return "∞";
  return String(value);
};

const phpDisplay = (version?: string | null) => {
  if (!version) return "—";
  return version.replace("php", "PHP ").replace(/(\d)(\d)/, "$1.$2");
};

export default function HostingStore() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: statusData } = useHostingStatus();
  const { data: plansData, isLoading: plansLoading } = useHostingPlans();
  const { data: regionsData } = useHostingRegions();

  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [domain, setDomain] = useState("");
  const [regionId, setRegionId] = useState("");
  const [purchasing, setPurchasing] = useState(false);

  const hasDomain = domain.trim().length > 0;

  const plans: HostingPlan[] = plansData?.plans ?? [];
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const features = selectedPlan?.features;

  const handlePurchase = async () => {
    if (!selectedPlanId) {
      toast.error("Please select a plan");
      return;
    }
    if (!domain.trim()) {
      toast.error("Please enter a domain");
      return;
    }

    setPurchasing(true);
    try {
      const response = await apiClient.post<{
        credentialsCreated?: boolean;
        credentialsEmailed?: boolean;
      }>("/hosting/purchase", {
        planId: selectedPlanId,
        domain: domain.trim(),
        regionId: regionId || undefined,
      });

      if (response?.credentialsCreated && response?.credentialsEmailed) {
        toast.success("Hosting subscription purchased. Your hosting panel credentials were emailed.");
      } else if (response?.credentialsCreated) {
        toast.success("Hosting subscription purchased. Your hosting account was created; if the email does not arrive, use the panel password reset.");
      } else {
        toast.success("Hosting subscription purchased successfully");
      }

      await queryClient.invalidateQueries({ queryKey: hostingKeys.services() });
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
    <div className="container mx-auto py-8 space-y-6 font-mono">
      <TerminalPageHeader pathPrefix="~/hosting" command="store --catalog" />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/hosting")}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <h1 className="text-2xl font-bold">Hosting Store</h1>
      </div>

      {plansLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">No plans available</h3>
          <p className="text-muted-foreground">
            There are no active hosting plans at the moment. Please check back later.
          </p>
        </div>
      ) : (
        <>
          {/* Plan Table */}
          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Websites</TableHead>
                  <TableHead>Disk</TableHead>
                  <TableHead>Mail</TableHead>
                  <TableHead>DBs</TableHead>
                  <TableHead>Transfer</TableHead>
                  <TableHead>PHP</TableHead>
                  <TableHead>Redis</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => {
                  const f = plan.features;
                  const r = f?.resources;
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <TableRow
                      key={plan.id}
                      className={cn("cursor-pointer", isSelected && "bg-muted/50")}
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setRegionId("");
                      }}
                    >
                      <TableCell>
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground"
                          )}
                        >
                          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {f?.planType || plan.service_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatResource(r?.websites?.total)}</TableCell>
                      <TableCell>
                        {r?.diskspace?.total != null
                          ? formatCapacity(r.diskspace.total)
                          : "∞"}
                      </TableCell>
                      <TableCell>{formatResource(r?.mailboxes?.total)}</TableCell>
                      <TableCell>{formatResource(r?.mysqlDbs?.total)}</TableCell>
                      <TableCell>
                        {r?.transfer?.total != null
                          ? formatCapacity(r.transfer.total)
                          : "∞"}
                      </TableCell>
                      <TableCell>{phpDisplay(f?.defaultPhpVersion)}</TableCell>
                      <TableCell>
                        {f?.redisAllowed ? (
                          <Badge variant="secondary" className="text-xs">
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatBillingAmount(Number(plan.price_monthly) || 0)}
                        <span className="text-muted-foreground font-normal text-xs">/mo</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Checkout Panel */}
          {selectedPlan && (
            <Card className="border-primary/25">
              <CardHeader>
                <CardTitle>Configure Subscription</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selected plan summary */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedPlan.name}</span>
                    <span className="font-semibold">
                      {formatBillingAmount(Number(selectedPlan.price_monthly) || 0)}/mo
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    {features?.planType && (
                      <Badge variant="outline" className="capitalize">
                        {features.planType}
                      </Badge>
                    )}
                    {features?.redisAllowed && (
                      <Badge variant="secondary" className="text-xs">
                        Redis
                      </Badge>
                    )}
                    {features?.persistentAppsAllowed && (
                      <Badge variant="secondary" className="text-xs">
                        Persistent Apps
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Domain section */}
                <div className="space-y-3">
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    placeholder="example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                </div>

                {/* Region selector - only if plan allows server group selection */}
                {features?.allowServerGroupSelection && regionsData?.regions && regionsData.regions.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
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

                {/* Info box */}
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">What happens next?</p>
                  <p>Purchasing creates your hosting account and provisions:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>An Enhance customer organization</li>
                    <li>Your login and member access</li>
                    <li>A subscription to the selected plan</li>
                    <li>A website with your chosen domain</li>
                  </ul>
                  <p className="pt-1">
                    Your hosting panel credentials will be emailed to you automatically.
                  </p>
                </div>

                <Button
                  onClick={handlePurchase}
                  disabled={purchasing || !selectedPlanId || !hasDomain}
                  className="w-full"
                >
                  {purchasing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Purchase Subscription
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
