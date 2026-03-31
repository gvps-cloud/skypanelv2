import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { assignIPs } from "@/services/ipamService";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface VPSInstance {
  id: string;
  label: string;
  provider_instance_id: string;
}

interface AssignmentRow {
  address: string;
  instanceId: string;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  active: boolean;
}

interface Region {
  id: string;
  label: string;
  country: string;
  allowed: boolean;
}

export function IPAssignPanel() {
  const [region, setRegion] = useState("");
  const [assignments, setAssignments] = useState<AssignmentRow[]>([{ address: "", instanceId: "" }]);

  // Fetch providers to get the first active one
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ["admin", "providers-for-regions"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/admin/providers`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load providers");
      return (json.providers || []).filter((p: Provider) => p.active);
    },
  });

  const firstProvider = providers[0];

  // Fetch allowed regions for the first active provider
  const { data: regionsData, isLoading: loadingRegions } = useQuery<{
    regions: Region[];
    mode: "default" | "custom";
  }>({
    queryKey: ["admin", "provider-regions", firstProvider?.id],
    queryFn: async () => {
      if (!firstProvider) return { regions: [], mode: "default" as const };
      const res = await fetch(`${API_BASE_URL}/admin/providers/${firstProvider.id}/regions`, {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load regions");
      return {
        regions: (json.regions || []).map((r: any) => ({
          id: r.id,
          label: r.label || r.id,
          country: r.country,
          allowed: r.allowed,
        })),
        mode: json.mode || "default",
      };
    },
    enabled: !!firstProvider,
  });

  // Filter to only allowed regions
  const allowedRegions = (regionsData?.regions || []).filter((r) => r.allowed);

  const { data: instances = [] } = useQuery<VPSInstance[]>({
    queryKey: ["admin", "servers-for-assign"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/admin/servers`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load instances");
      return (json.servers || []).map((s: any) => ({
        id: s.id,
        label: s.label,
        provider_instance_id: s.provider_instance_id,
      }));
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (data: { assignments: AssignmentRow[]; region: string }) => {
      const result = await assignIPs(data.assignments, data.region);
      if (!result.success) throw new Error(result.error || "Failed to assign IPs");
      return result;
    },
    onSuccess: (_, vars) => {
      toast.success(`Assigned ${vars.assignments.length} IP${vars.assignments.length > 1 ? "s" : ""}`);
      setAssignments([{ address: "", instanceId: "" }]);
      setRegion("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addRow = () => setAssignments((prev) => [...prev, { address: "", instanceId: "" }]);
  const removeRow = (index: number) => setAssignments((prev) => prev.filter((_, i) => i !== index));
  const updateRow = (index: number, field: keyof AssignmentRow, value: string) =>
    setAssignments((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const handleSubmit = () => {
    const valid = assignments.filter((a) => a.address && a.instanceId);
    if (valid.length === 0) {
      toast.error("Add at least one valid assignment");
      return;
    }
    if (!region) {
      toast.error("Select a region");
      return;
    }
    assignMutation.mutate({ assignments: valid, region });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Assign IPs</h3>
        <p className="text-sm text-muted-foreground">
          Move IP addresses between instances in the same region.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Assignment Configuration</CardTitle>
          <CardDescription>
            All IPs must be in the same region. Each assignment moves an IP from its current instance to the target.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assign-region">Region</Label>
            {loadingRegions ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading regions...
              </div>
            ) : allowedRegions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No active regions configured.{" "}
                <a href="/admin#regions" className="text-primary underline">
                  Configure regions
                </a>
              </div>
            ) : (
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger id="assign-region">
                  <SelectValue placeholder="Select a region..." />
                </SelectTrigger>
                <SelectContent>
                  {allowedRegions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label} — {r.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {assignments.map((row, index) => (
            <div key={index} className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label>IP Address</Label>
                <Input
                  value={row.address}
                  onChange={(e) => updateRow(index, "address", e.target.value)}
                  placeholder="192.0.2.1"
                  className="font-mono"
                />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground mb-3" />
              <div className="flex-1 space-y-2">
                <Label>Target Instance</Label>
                <Select
                  value={row.instanceId}
                  onValueChange={(v) => updateRow(index, "instanceId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select instance..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((inst) => (
                      <SelectItem key={inst.provider_instance_id} value={inst.provider_instance_id}>
                        {inst.label} ({inst.provider_instance_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {assignments.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-1 text-destructive"
                  onClick={() => removeRow(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" />
            Add Assignment
          </Button>

          <div className="pt-4">
            <Button onClick={handleSubmit} disabled={assignMutation.isPending}>
              {assignMutation.isPending ? "Assigning..." : "Assign IPs"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
