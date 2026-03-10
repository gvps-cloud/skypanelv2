import React, { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TicketCategory, TicketPriority } from "@/types/support";
import { Loader2 } from "lucide-react";

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTicketData) => Promise<void>;
  vpsInstances?: Array<{ id: string; label: string }>;
  organizations?: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  vpsId?: string;
  organizationId: string;
}

export const CreateTicketDialog: React.FC<CreateTicketDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  vpsInstances = [],
  organizations = [],
  isLoading = false,
}) => {
  const [data, setData] = useState<CreateTicketData>({
    subject: "",
    description: "",
    priority: "medium",
    category: "general",
    vpsId: "none",
    organizationId: "",
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setData({
        subject: "",
        description: "",
        priority: "medium",
        category: "general",
        vpsId: "none",
        organizationId: organizations[0]?.id || "",
      });
    }
  }, [open, organizations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.subject.trim() || !data.description.trim() || !data.organizationId) return;
    
    await onSubmit({
      ...data,
      vpsId: data.vpsId === "none" ? undefined : data.vpsId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] gap-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">New Support Ticket</DialogTitle>
          <DialogDescription>
            Submit a new ticket and our support team will get back to you shortly.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organization" className="text-sm font-medium">
                Organization <span className="text-destructive">*</span>
              </Label>
              <Select
                value={data.organizationId}
                onValueChange={(val) => setData({ ...data, organizationId: val })}
                disabled={isLoading}
              >
                <SelectTrigger id="organization" className="h-10">
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject" className="text-sm font-medium">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subject"
                value={data.subject}
                onChange={(e) => setData({ ...data, subject: e.target.value })}
                placeholder="Brief summary of the issue"
                className="h-10"
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                <Select
                  value={data.category}
                  onValueChange={(val) => setData({ ...data, category: val as TicketCategory })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="category" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Inquiry</SelectItem>
                    <SelectItem value="technical">Technical Issue</SelectItem>
                    <SelectItem value="billing">Billing & Payments</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority" className="text-sm font-medium">Priority</Label>
                <Select
                  value={data.priority}
                  onValueChange={(val) => setData({ ...data, priority: val as TicketPriority })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="priority" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - General Question</SelectItem>
                    <SelectItem value="medium">Medium - Standard Issue</SelectItem>
                    <SelectItem value="high">High - Important Feature Broken</SelectItem>
                    <SelectItem value="urgent">Urgent - System Down</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {vpsInstances.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="vps" className="text-sm font-medium">Related Service (Optional)</Label>
                <Select
                  value={data.vpsId}
                  onValueChange={(val) => setData({ ...data, vpsId: val })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="vps" className="h-10">
                    <SelectValue placeholder="Select a VPS instance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None / Not Applicable</SelectItem>
                    {vpsInstances.map((vps) => (
                      <SelectItem key={vps.id} value={vps.id}>
                        {vps.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                rows={6}
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                placeholder="Please provide as much detail as possible..."
                className="resize-none min-h-[120px] leading-relaxed"
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !data.subject.trim() || !data.description.trim() || !data.organizationId}
              className="min-w-[100px]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Ticket"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
