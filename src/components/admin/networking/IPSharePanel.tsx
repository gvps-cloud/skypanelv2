import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { shareIPs } from "@/services/ipamService";

// IPv4 regex: matches valid IPv4 addresses
const IPv4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

// IPv6 regex: matches valid IPv6 addresses (including compressed forms)
const IPv6_REGEX = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::)$/;

function isValidIPAddress(value: string): boolean {
  return IPv4_REGEX.test(value) || IPv6_REGEX.test(value);
}

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

export function IPSharePanel() {
  const [instanceId, setInstanceId] = useState("");
  const [ips, setIps] = useState<string[]>([""]);

  const { data: instances = [] } = useQuery<VPSInstance[]>({
    queryKey: ["admin", "servers-for-share"],
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

  const shareMutation = useMutation({
    mutationFn: async (data: { instanceId: string; ips: string[] }) => {
      const result = await shareIPs(data.instanceId, data.ips);
      if (!result.success) throw new Error(result.error || "Failed to share IPs");
      return result;
    },
    onSuccess: (_, vars) => {
      toast.success(`Shared ${vars.ips.length} IP${vars.ips.length > 1 ? "s" : ""}`);
      setInstanceId("");
      setIps([""]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addIP = () => setIps((prev) => [...prev, ""]);
  const removeIP = (index: number) => setIps((prev) => prev.filter((_, i) => i !== index));
  const updateIP = (index: number, value: string) =>
    setIps((prev) => prev.map((ip, i) => (i === index ? value : ip)));

  const handleSubmit = () => {
    const validIPs = ips.filter((ip) => ip.trim());
    if (!instanceId) {
      toast.error("Instance is required");
      return;
    }
    if (validIPs.length === 0) {
      toast.error("Add at least one IP address");
      return;
    }
    // Validate all IPs before submission
    const invalidIPs = validIPs.filter((ip) => !isValidIPAddress(ip));
    if (invalidIPs.length > 0) {
      toast.error(`Invalid IP address(es): ${invalidIPs.join(", ")}`);
      return;
    }
    shareMutation.mutate({ instanceId, ips: validIPs });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Share IPs</h3>
        <p className="text-sm text-muted-foreground">
          Configure IP sharing for failover between instances in the same region.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">IP Sharing Configuration</CardTitle>
          <CardDescription>
            Shared IPs allow a secondary instance to bring up the shared IP if the primary goes down.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-instance">Primary Instance</Label>
            <Select value={instanceId} onValueChange={setInstanceId}>
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

          <div className="space-y-2">
            <Label>IPs to Share</Label>
            {ips.map((ip, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={ip}
                  onChange={(e) => updateIP(index, e.target.value)}
                  placeholder="192.0.2.1 or 2600:3c01::"
                  className={`font-mono flex-1 ${ip && !isValidIPAddress(ip) ? "border-destructive" : ""}`}
                />
                {ip && !isValidIPAddress(ip) && (
                  <p className="text-xs text-destructive">Invalid IP</p>
                )}
                {ips.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeIP(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addIP}>
              <Plus className="h-4 w-4 mr-1" />
              Add IP
            </Button>
          </div>

          <div className="pt-4">
            <Button onClick={handleSubmit} disabled={shareMutation.isPending}>
              {shareMutation.isPending ? "Sharing..." : "Share IPs"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
