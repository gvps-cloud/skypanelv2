import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Machine {
  name: string;
  state: string;
  address: string;
  publicIp: string;
  wireguardEndpoints: string;
  machineId: string;
}

export default function AdminPaaSNetworkingPage() {
  const [context, setContext] = useState("");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.get<{
        success: boolean;
        machines: Machine[];
        error?: string;
      }>(
        `/api/admin/paas/networking${
          context ? `?context=${encodeURIComponent(context)}` : ""
        }`
      );
      setMachines(data.machines || []);
    } catch (e: any) {
      const errorMsg = e?.message || "Failed to load network information";
      if (errorMsg.includes('config.yaml') || errorMsg.includes('/root/') || 
          (errorMsg.toLowerCase().includes('context') && errorMsg.toLowerCase().includes('not found'))) {
        setError(context 
          ? `The cluster "${context}" does not exist. Leave the cluster field empty to use your default cluster, or enter the name of an existing cluster.`
          : "Unable to connect to cluster. Please verify your cluster configuration or name is correct.");
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Extract network CIDR from first machine's address
  const networkCidr = machines.length > 0 
    ? machines[0].address.split('/')[1] 
      ? `10.210.0.0/${machines[0].address.split('/')[1]}`
      : "10.210.0.0/16"
    : "10.210.0.0/16";

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Networking"
        description="View your cluster's WireGuard mesh network and machine connectivity. If you manage multiple clusters, use the cluster field to switch between them."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
      />

      <ContentCard
        title="Cluster Network"
        description="Uncloud automatically configures and maintains a secure WireGuard mesh network across your machines."
        headerAction={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Input
                placeholder="default"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="h-8 w-32 text-xs"
                title="Cluster context name (leave empty for default cluster)"
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                cluster
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={refresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        }
      >
        <Tabs defaultValue="config" className="space-y-4">
          <TabsList>
            <TabsTrigger value="config">Network Configuration</TabsTrigger>
            <TabsTrigger value="communication">Service Communication</TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4">
            {context && (
              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border">
                <span className="font-medium">Cluster Context:</span> {context}
              </div>
            )}

            <div className="rounded-md border bg-muted/30 p-4">
              <div className="text-sm text-muted-foreground">
                <p className="mb-3">
                  <strong>Network Configuration:</strong>
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>
                    <strong>Network CIDR:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{networkCidr}</code>
                  </li>
                  <li>
                    <strong>Active Machines:</strong> {machines.length} {machines.length === 1 ? 'machine' : 'machines'}
                  </li>
                  <li>
                    <strong>WireGuard Mesh:</strong> Automatically configured across all nodes
                  </li>
                  <li>
                    <strong>Internal DNS:</strong> Services can be addressed by name within the cluster
                  </li>
                </ul>
              </div>
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}
          </TabsContent>

          <TabsContent value="communication" className="space-y-3">
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="font-medium mb-2 text-sm">Internal DNS Resolution</p>
              <p className="text-muted-foreground mb-3 text-sm">
                Services can address each other using:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground text-sm">
                <li>
                  <strong>Service name:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">http://my-service</code>
                </li>
                <li>
                  <strong>Service ID:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">http://s-abc123</code>
                </li>
                <li>
                  <strong>Machine-scoped:</strong> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">http://my-service.machine-name</code>
                </li>
              </ul>
            </div>

            <div className="rounded-md border bg-muted/30 p-4">
              <p className="font-medium mb-2 text-sm">Direct Container IPs</p>
              <p className="text-muted-foreground text-sm">
                Each container gets a unique IP address from the cluster network range, allowing direct communication without port mapping.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </ContentCard>

      <ContentCard
        title="Machines in Network"
        description="WireGuard mesh network endpoints and machine connectivity."
      >
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : machines.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No machines found in this cluster.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Cluster IP</TableHead>
                  <TableHead>Public IP</TableHead>
                  <TableHead>WireGuard Endpoints</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {machines.map((machine) => (
                  <TableRow key={machine.machineId}>
                    <TableCell className="font-mono text-xs">
                      {machine.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={machine.state === 'Up' ? 'default' : 'secondary'}>
                        {machine.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {machine.address}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {machine.publicIp}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {machine.wireguardEndpoints || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ContentCard>
    </div>
  );
}
