import { useCallback, useEffect, useState } from "react";
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
        `/api/admin/paas/services/${encodeURIComponent(name)}`
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
                <TableHead>Image</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.name}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-xs sm:text-sm">{s.image}</TableCell>
                  <TableCell className="capitalize text-xs sm:text-sm">
                    {s.status}
                  </TableCell>
                  <TableCell className="text-xs sm:text-sm">
                    {(s.ports || []).join(", ")}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => scale(s.name, 1)}
                    >
                      Scale 1
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => scale(s.name, 2)}
                    >
                      Scale 2
                    </Button>
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

