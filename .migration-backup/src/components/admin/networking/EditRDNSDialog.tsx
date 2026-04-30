import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateReverseDNS } from "@/services/ipamService";
import { toast } from "sonner";

interface EditRDNSDialogProps {
  open: boolean;
  onClose: () => void;
  address: string;
  currentRdns: string | null;
  onSaved: () => void;
}

export function EditRDNSDialog({ open, onClose, address, currentRdns, onSaved }: EditRDNSDialogProps) {
  const [rdns, setRdns] = useState(currentRdns ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRdns(currentRdns ?? "");
    }
  }, [address, currentRdns, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateReverseDNS(address, rdns || null);
      if (result.success) {
        toast.success("Reverse DNS updated");
        onSaved();
        onClose();
      } else {
        toast.error(result.error || "Failed to update rDNS");
      }
    } catch {
      toast.error("Failed to update rDNS");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Reverse DNS</DialogTitle>
          <DialogDescription>
            Update the reverse DNS record for {address}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="rdns-value">Reverse DNS hostname</Label>
            <Input
              id="rdns-value"
              value={rdns}
              onChange={(e) => setRdns(e.target.value)}
              placeholder="e.g. host.example.com"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to reset to the provider default.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
