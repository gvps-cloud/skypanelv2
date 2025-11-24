import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { apiClient } from "@/lib/api";

interface WorkerSummary {
  id: string;
  name: string;
  hostIp: string;
  sshPort: number;
  sshUser: string;
  uncloudContext: string;
}

interface ImagesResponse {
  success?: boolean;
  images: string[];
  error?: string;
}

export default function AdminPaaSImagesPage() {
  const [workers, setWorkers] = useState<WorkerSummary[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("");
  const [images, setImages] = useState<string[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const [error, setError] = useState<string>("");

  const selectedWorker = useMemo(
    () => workers.find((w) => w.id === selectedWorkerId) || null,
    [workers, selectedWorkerId]
  );

  const loadWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    setError("");
    try {
      const data = await apiClient.get<{
        success?: boolean;
        workers?: any[];
        error?: string;
      }>("/api/admin/paas/workers");

      const rawWorkers = Array.isArray(data.workers) ? data.workers : [];
      const mapped: WorkerSummary[] = rawWorkers.map((w) => ({
        id: String(w.id),
        name: w.name,
        hostIp: w.hostIp || w.ssh_host,
        sshPort: w.sshPort ?? w.ssh_port ?? 22,
        sshUser: w.sshUser || w.ssh_user,
        uncloudContext: w.uncloudContext || w.uncloud_context,
      }));

      setWorkers(mapped);

      if (!selectedWorkerId && mapped.length > 0) {
        setSelectedWorkerId(mapped[0].id);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load workers");
      setWorkers([]);
    } finally {
      setLoadingWorkers(false);
    }
  }, [selectedWorkerId]);

  const loadImages = useCallback(async () => {
    if (!selectedWorkerId) {
      setImages([]);
      return;
    }

    setLoadingImages(true);
    setError("");
    try {
      const data = await apiClient.get<ImagesResponse>(
        `/api/admin/paas/images/workers/${encodeURIComponent(selectedWorkerId)}`
      );
      const list = Array.isArray(data.images) ? data.images : [];
      setImages(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load images");
      setImages([]);
    } finally {
      setLoadingImages(false);
    }
  }, [selectedWorkerId]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    if (selectedWorkerId) {
      void loadImages();
    } else {
      setImages([]);
    }
  }, [selectedWorkerId, loadImages]);

  const filteredImages = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return images;
    return images.filter((img) => img.toLowerCase().includes(term));
  }, [images, search]);

  async function handleDeleteImage(image: string) {
    if (!selectedWorkerId) return;
    const confirmed = window.confirm(
      `Remove image "${image}" from the selected worker?`
    );
    if (!confirmed) return;

    try {
      await apiClient.delete(
        `/api/admin/paas/images/workers/${encodeURIComponent(
          selectedWorkerId
        )}?image=${encodeURIComponent(image)}`
      );
      await loadImages();
    } catch (e: any) {
      setError(e?.message || "Failed to remove image");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS Images"
        description="Inspect and manage Docker images stored on your PaaS worker nodes via Unregistry."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
      />

      <ContentCard
        title="Images"
        description="Select a worker to list its images, then remove unused images to reclaim space."
        headerAction={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select
              value={selectedWorkerId}
              onValueChange={(val) => setSelectedWorkerId(val)}
              disabled={loadingWorkers || workers.length === 0}
           >
              <SelectTrigger className="h-8 w-56">
                <SelectValue
                  placeholder={
                    loadingWorkers
                      ? "Loading workers..."
                      : workers.length === 0
                      ? "No workers available"
                      : "Select worker"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.hostIp}:{w.sshPort})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter images..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full sm:w-56"
            />

            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadImages()}
              disabled={loadingImages || !selectedWorkerId}
            >
              Refresh
            </Button>
          </div>
        }
      >
        <div className="space-y-4 text-sm">
          {selectedWorker && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">
                Worker: {selectedWorker.name}
              </div>
              <div>
                Host: {selectedWorker.hostIp}:{selectedWorker.sshPort} · ctx: {" "}
                {selectedWorker.uncloudContext}
              </div>
            </div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}

          {!selectedWorkerId ? (
            <div className="text-sm text-muted-foreground">
              Select a worker to view its images.
            </div>
          ) : loadingImages ? (
            <div className="text-sm text-muted-foreground">Loading images…</div>
          ) : filteredImages.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {images.length === 0
                ? "No images reported by this worker."
                : "No images match your search."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredImages.map((image) => (
                  <TableRow key={image}>
                    <TableCell className="font-mono text-xs sm:text-sm">
                      {image}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => void handleDeleteImage(image)}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </ContentCard>
    </div>
  );
}
