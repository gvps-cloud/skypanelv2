import { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Plus,
  Edit,
  Trash2,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { buildApiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AnnouncementsManagerProps {
  token: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  target_audience: string;
  is_active: boolean;
  is_dismissable: boolean;
  priority: number;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

const announcementSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title must be 255 characters or less"),
  message: z.string().min(1, "Message is required").max(10000, "Message must be 10000 characters or less"),
  type: z.enum(["info", "warning", "success", "maintenance", "urgent"]),
  target_audience: z.enum(["all", "authenticated", "guests", "admin"]),
  is_active: z.boolean(),
  is_dismissable: z.boolean(),
  priority: z.number().int().min(0, "Priority must be 0 or higher"),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
});

type AnnouncementFormData = z.infer<typeof announcementSchema>;

const TYPE_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  success: "Success",
  maintenance: "Maintenance",
  urgent: "Urgent",
};

const TYPE_COLORS: Record<string, string> = {
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  maintenance: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25",
  urgent: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25",
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: "All Users",
  authenticated: "Authenticated",
  guests: "Guests",
  admin: "Admins Only",
};

const AUDIENCE_COLORS: Record<string, string> = {
  all: "",
  authenticated: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/25",
  guests: "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/25",
  admin: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25",
};

const EMPTY_FORM = {
  title: "",
  message: "",
  type: "info" as const,
  target_audience: "all" as const,
  is_active: false,
  is_dismissable: true,
  priority: 0,
  starts_at: "" as string | null,
  expires_at: "" as string | null,
};

export const AnnouncementsManager: React.FC<AnnouncementsManagerProps> = ({ token }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");

  const createForm = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: EMPTY_FORM,
  });

  const editForm = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: EMPTY_FORM,
  });

  const fetchAnnouncements = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.set("type", filterType);
      if (filterActive !== "all") params.set("is_active", filterActive);

      const res = await fetch(buildApiUrl(`/api/admin/announcements?${params.toString()}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load announcements");
      setAnnouncements(data.announcements || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, [token, filterType, filterActive]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreate = async (data: AnnouncementFormData) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        starts_at: data.starts_at || null,
        expires_at: data.expires_at || null,
      };

      const res = await fetch(buildApiUrl("/api/admin/announcements"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || "Failed to create announcement");

      setAnnouncements((prev) => [responseData.announcement, ...prev]);
      setShowCreateDialog(false);
      createForm.reset(EMPTY_FORM);
      toast.success("Announcement created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    editForm.reset({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type as any,
      target_audience: announcement.target_audience as any,
      is_active: announcement.is_active,
      is_dismissable: announcement.is_dismissable,
      priority: announcement.priority,
      starts_at: announcement.starts_at ? format(new Date(announcement.starts_at), "yyyy-MM-dd'T'HH:mm") : "",
      expires_at: announcement.expires_at ? format(new Date(announcement.expires_at), "yyyy-MM-dd'T'HH:mm") : "",
    });
    setShowEditDialog(true);
  };

  const handleUpdate = async (data: AnnouncementFormData) => {
    if (!selectedAnnouncement) return;
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        starts_at: data.starts_at || null,
        expires_at: data.expires_at || null,
      };

      const res = await fetch(buildApiUrl(`/api/admin/announcements/${selectedAnnouncement.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || "Failed to update announcement");

      setAnnouncements((prev) =>
        prev.map((a) => (a.id === selectedAnnouncement.id ? responseData.announcement : a))
      );
      setShowEditDialog(false);
      setSelectedAnnouncement(null);
      toast.success("Announcement updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (announcement: Announcement) => {
    try {
      const res = await fetch(buildApiUrl(`/api/admin/announcements/${announcement.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !announcement.is_active }),
      });
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || "Failed to toggle announcement");

      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcement.id ? responseData.announcement : a))
      );
      toast.success(announcement.is_active ? "Announcement deactivated" : "Announcement activated");
    } catch (error: any) {
      toast.error(error.message || "Failed to toggle announcement");
    }
  };

  const openDelete = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setShowDeleteDialog(true);
  };

  const handleDelete = async () => {
    if (!selectedAnnouncement) return;
    setSubmitting(true);
    try {
      const res = await fetch(buildApiUrl(`/api/admin/announcements/${selectedAnnouncement.id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete announcement");

      setAnnouncements((prev) => prev.filter((a) => a.id !== selectedAnnouncement.id));
      setShowDeleteDialog(false);
      setSelectedAnnouncement(null);
      toast.success("Announcement deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "MMM d, yyyy HH:mm");
  };

  const activeCount = announcements.filter((a) => a.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">
              Communication
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Announcements
            </h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              Broadcast messages across the platform to specific audiences. Control
              visibility, scheduling, and dismissal behavior.
            </p>
          </div>
          <Button
            onClick={() => {
              createForm.reset(EMPTY_FORM);
              setShowCreateDialog(true);
            }}
            className="shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Announcement
          </Button>
        </div>
        <div className="relative z-10 mt-4 flex gap-4 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{announcements.length}</strong> total
          </span>
          <span>
            <strong className="text-foreground">{activeCount}</strong> active
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Audience</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Loading announcements...
                </TableCell>
              </TableRow>
            ) : announcements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Megaphone className="h-8 w-8 text-muted-foreground/50" />
                    <span>No announcements found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              announcements.map((announcement) => (
                <TableRow key={announcement.id}>
                  <TableCell className="font-medium">{announcement.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={TYPE_COLORS[announcement.type] || ""}
                    >
                      {TYPE_LABELS[announcement.type] || announcement.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={AUDIENCE_COLORS[announcement.target_audience] || ""}
                    >
                      {AUDIENCE_LABELS[announcement.target_audience] || announcement.target_audience}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={announcement.is_active}
                      onCheckedChange={() => handleToggleActive(announcement)}
                    />
                  </TableCell>
                  <TableCell>{announcement.priority}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {announcement.starts_at || announcement.expires_at ? (
                      <div className="space-y-0.5">
                        {announcement.starts_at && (
                          <div>From: {formatDate(announcement.starts_at)}</div>
                        )}
                        {announcement.expires_at && (
                          <div>Until: {formatDate(announcement.expires_at)}</div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(announcement)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDelete(announcement)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) createForm.reset(EMPTY_FORM);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Announcement</DialogTitle>
            <DialogDescription>
              Broadcast a message to your platform users. Choose the type, audience, and
              optional scheduling.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreate)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="create-title">Title *</Label>
                <Input
                  id="create-title"
                  {...createForm.register("title")}
                  placeholder="e.g., Scheduled Maintenance Window"
                  disabled={submitting}
                />
                {createForm.formState.errors.title && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="create-message">Message *</Label>
                <Textarea
                  id="create-message"
                  {...createForm.register("message")}
                  placeholder="Enter the announcement message..."
                  rows={3}
                  disabled={submitting}
                />
                {createForm.formState.errors.message && (
                  <p className="text-sm text-destructive">
                    {createForm.formState.errors.message.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Type *</Label>
                  <Controller
                    name="type"
                    control={createForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Target Audience *</Label>
                  <Controller
                    name="target_audience"
                    control={createForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-priority">Priority</Label>
                  <Input
                    id="create-priority"
                    type="number"
                    min={0}
                    {...createForm.register("priority", { valueAsNumber: true })}
                    disabled={submitting}
                  />
                  {createForm.formState.errors.priority && (
                    <p className="text-sm text-destructive">
                      {createForm.formState.errors.priority.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-starts">Starts At</Label>
                  <Input
                    id="create-starts"
                    type="datetime-local"
                    {...createForm.register("starts_at")}
                    disabled={submitting}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-expires">Expires At</Label>
                  <Input
                    id="create-expires"
                    type="datetime-local"
                    {...createForm.register("expires_at")}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Controller
                    name="is_active"
                    control={createForm.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={submitting} />
                    )}
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Controller
                    name="is_dismissable"
                    control={createForm.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={submitting} />
                    )}
                  />
                  <Label>Dismissible</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowCreateDialog(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Announcement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setSelectedAnnouncement(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Announcement</DialogTitle>
            <DialogDescription>
              Update the announcement details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleUpdate)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  {...editForm.register("title")}
                  placeholder="e.g., Scheduled Maintenance Window"
                  disabled={submitting}
                />
                {editForm.formState.errors.title && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-message">Message *</Label>
                <Textarea
                  id="edit-message"
                  {...editForm.register("message")}
                  placeholder="Enter the announcement message..."
                  rows={3}
                  disabled={submitting}
                />
                {editForm.formState.errors.message && (
                  <p className="text-sm text-destructive">
                    {editForm.formState.errors.message.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Type *</Label>
                  <Controller
                    name="type"
                    control={editForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Target Audience *</Label>
                  <Controller
                    name="target_audience"
                    control={editForm.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-priority">Priority</Label>
                  <Input
                    id="edit-priority"
                    type="number"
                    min={0}
                    {...editForm.register("priority", { valueAsNumber: true })}
                    disabled={submitting}
                  />
                  {editForm.formState.errors.priority && (
                    <p className="text-sm text-destructive">
                      {editForm.formState.errors.priority.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-starts">Starts At</Label>
                  <Input
                    id="edit-starts"
                    type="datetime-local"
                    {...editForm.register("starts_at")}
                    disabled={submitting}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-expires">Expires At</Label>
                  <Input
                    id="edit-expires"
                    type="datetime-local"
                    {...editForm.register("expires_at")}
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Controller
                    name="is_active"
                    control={editForm.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={submitting} />
                    )}
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Controller
                    name="is_dismissable"
                    control={editForm.control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={submitting} />
                    )}
                  />
                  <Label>Dismissible</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowEditDialog(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedAnnouncement?.title}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
