import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

interface VPSInstance {
  id: string;
  label: string;
  provider_instance_id: string;
  status: string;
}

interface AllocateIPDialogProps {
  open: boolean;
  onClose: () => void;
  onAllocated: () => void;
}

export function AllocateIPDialog({ open, onClose, onAllocated }: AllocateIPDialogProps) {
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [ipType, setIpType] = useState<"ipv4" | "ipv6">("ipv4");

  const { data: instances = [], isLoading } = useQuery<VPSInstance[]>({
    queryKey: ["admin-servers-for-allocate"],
    queryFn: async () => {
      const json = await apiClient.get<{ servers: any[] }>("/admin/servers");
      return (json.servers || []).map((s: any) => ({
        id: s.id,
        label: s.label,
        provider_instance_id: s.provider_instance_id,
        status: s.status,
      }));
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: {
      instanceId: string;
      public: boolean;
      type: "ipv4" | "ipv6";
    }) => {
      return apiClient.post("/admin/networking/ips", data);
    },
    onSuccess: () => {
      toast.success("IP address allocated");
      onAllocated();
      handleClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleClose = () => {
    setSelectedInstanceId("");
    setIsPublic(true);
    setIpType("ipv4");
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedInstanceId) {
      toast.error("Select a VPS instance");
      return;
    }
    mutation.mutate({
      instanceId: selectedInstanceId,
      public: isPublic,
      type: ipType,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Allocate IP Address</DialogTitle>
          <DialogDescription>
            Assign a new IP address to a VPS instance.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>VPS Instance</Label>
            <Select
              value={selectedInstanceId}
              onValueChange={setSelectedInstanceId}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoading ? "Loading instances..." : "Select an instance"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {instances.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>
                    {inst.label} ({inst.provider_instance_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Scope</Label>
            <Select
              value={isPublic ? "public" : "private"}
              onValueChange={(v) => setIsPublic(v === "public")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>IP Type</Label>
            <Select
              value={ipType}
              onValueChange={(v) => setIpType(v as "ipv4" | "ipv6")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ipv4">IPv4</SelectItem>
                <SelectItem value="ipv6">IPv6</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || isLoading || !selectedInstanceId}
          >
            {mutation.isPending ? "Allocating..." : "Allocate IP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
