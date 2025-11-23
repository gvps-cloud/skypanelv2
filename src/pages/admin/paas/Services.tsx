import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function AdminPaaSServicesPage() {
  const [context, setContext] = useState<string>("");
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.get<{
        success: boolean;
        services: any[];
      }>(
        `/api/admin/paas/services${
          context ? `?context=${encodeURIComponent(context)}` : ""
        }`
      );
      setServices(data.services || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load services");
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  async function scale(name: string, replicas: number) {
    try {
      await apiClient.post(
        `/api/admin/paas/services/${encodeURIComponent(name)}/scale`,
        { replicas, context }
      );
      await load();
    } catch (e: any) {
      setError(e?.message || "Scale failed");
    }
  }

  async function remove(name: string) {
    try {
      await apiClient.delete(
        `/api/admin/paas/services/${encodeURIComponent(name)}${
          context ? `?context=${encodeURIComponent(context)}` : ""
        }`
      );
      await load();
    } catch (e: any) {
      setError(e?.message || "Remove failed");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Services"
        description="Inspect and scale services running in your uncloud contexts."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
      />

      <ContentCard
        title="Services"
        description="Each row represents an uncloud service; you can scale replicas or remove services."
        headerAction={
          <div className="flex items-center gap-2">
            <Input
              placeholder="Uncloud context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="h-8 w-48"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={load}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        }
      >
        {error && <div className="mb-3 text-sm text-destructive">{error}</div>}

        {services.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No services found for this context.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.name}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs sm:text-sm">{s.mode}</TableCell>
                  <TableCell className="capitalize text-xs sm:text-sm">
                    {s.status}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm">
                    {(s.ports || []).join(", ")}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    {s.name === "caddy" || s.mode === "global" ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/admin/paas/caddy">Manage</Link>
                      </Button>
                    ) : (
                      <ScalePopover
                        currentReplicas={s.replicas}
                        onScale={(r) => scale(s.name, r)}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => remove(s.name)}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ContentCard>
    </div>
  );
}

function ScalePopover({
  currentReplicas,
  onScale,
}: {
  currentReplicas: number;
  onScale: (r: number) => void;
}) {
  const [replicas, setReplicas] = useState(currentReplicas || 1);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          Scale
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Scale Service</h4>
            <p className="text-sm text-muted-foreground">
              Set the number of replicas for this service.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              value={replicas}
              onChange={(e) => setReplicas(parseInt(e.target.value) || 0)}
              className="h-8"
            />
            <Button
              size="sm"
              onClick={() => {
                onScale(replicas);
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

