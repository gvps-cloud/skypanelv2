import React, { useEffect, useMemo, useState } from "react";
import {
  FileText,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Pencil,
  Lock,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import type {
  CreateNoteInput,
  Note,
  NoteScope,
  OrganizationNoteMembership,
} from "@/types/notes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CreateMode = "personal-only" | "organization-only" | "choose-scope";

interface NotesBoardProps {
  title: string;
  description: string;
  notes: Note[];
  isLoading: boolean;
  isRefreshing?: boolean;
  allowCreate: boolean;
  createMode: CreateMode;
  initialCreateScope?: NoteScope;
  defaultOrganizationId?: string | null;
  organizationOptions?: OrganizationNoteMembership[];
  onRefresh?: () => void;
  onCreatePersonal: (input: CreateNoteInput) => Promise<unknown>;
  onCreateOrganization: (
    organizationId: string,
    input: CreateNoteInput,
  ) => Promise<unknown>;
  onUpdatePersonal: (noteId: string, input: CreateNoteInput) => Promise<unknown>;
  onUpdateOrganization: (
    organizationId: string,
    noteId: string,
    input: CreateNoteInput,
  ) => Promise<unknown>;
  onDeletePersonal: (noteId: string) => Promise<unknown>;
  onDeleteOrganization: (
    organizationId: string,
    noteId: string,
  ) => Promise<unknown>;
  canManageNote: (note: Note) => boolean;
  emptyStateTitle: string;
  emptyStateDescription: string;
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function NotesBoard({
  title,
  description,
  notes,
  isLoading,
  isRefreshing = false,
  allowCreate,
  createMode,
  initialCreateScope = "personal",
  defaultOrganizationId = null,
  organizationOptions = [],
  onRefresh,
  onCreatePersonal,
  onCreateOrganization,
  onUpdatePersonal,
  onUpdateOrganization,
  onDeletePersonal,
  onDeleteOrganization,
  canManageNote,
  emptyStateTitle,
  emptyStateDescription,
}: NotesBoardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [scope, setScope] = useState<NoteScope>(initialCreateScope);
  const [organizationId, setOrganizationId] = useState<string>(
    defaultOrganizationId || "",
  );
  const [titleValue, setTitleValue] = useState("");
  const [contentValue, setContentValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const manageableOrganizations = useMemo(
    () => organizationOptions.filter((organization) => organization.canManage),
    [organizationOptions],
  );

  useEffect(() => {
    if (!dialogOpen) {
      setEditingNote(null);
      setTitleValue("");
      setContentValue("");
      setScope(createMode === "organization-only" ? "organization" : initialCreateScope);
      setOrganizationId(defaultOrganizationId || manageableOrganizations[0]?.organizationId || "");
    }
  }, [
    createMode,
    defaultOrganizationId,
    dialogOpen,
    initialCreateScope,
    manageableOrganizations,
  ]);

  const filteredNotes = useMemo(() => {
    if (!searchTerm.trim()) {
      return notes;
    }

    const term = searchTerm.trim().toLowerCase();
    return notes.filter((note) => {
      const haystack = [
        note.title,
        note.content,
        note.organizationName || "",
        note.updatedBy?.name || "",
        note.updatedBy?.email || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [notes, searchTerm]);

  const openCreateDialog = () => {
    setEditingNote(null);
    setDialogOpen(true);
  };

  const openEditDialog = (note: Note) => {
    setEditingNote(note);
    setScope(note.scope);
    setOrganizationId(note.organizationId || defaultOrganizationId || "");
    setTitleValue(note.title);
    setContentValue(note.content);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const normalizedTitle = titleValue.trim();
    if (!normalizedTitle) {
      toast.error("Title is required");
      return;
    }

    if (scope === "organization" && !organizationId) {
      toast.error("Select an organization for this note");
      return;
    }

    setSubmitting(true);
    const payload = {
      title: normalizedTitle,
      content: contentValue,
    };

    try {
      if (editingNote) {
        if (editingNote.scope === "personal") {
          await onUpdatePersonal(editingNote.id, payload);
          toast.success("Personal note updated");
        } else {
          await onUpdateOrganization(editingNote.organizationId!, editingNote.id, payload);
          toast.success("Organization note updated");
        }
      } else if (scope === "personal") {
        await onCreatePersonal(payload);
        toast.success("Personal note created");
      } else {
        await onCreateOrganization(organizationId, payload);
        toast.success("Organization note created");
      }

      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save note");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setSubmitting(true);
    try {
      if (deleteTarget.scope === "personal") {
        await onDeletePersonal(deleteTarget.id);
        toast.success("Personal note deleted");
      } else {
        await onDeleteOrganization(deleteTarget.organizationId!, deleteTarget.id);
        toast.success("Organization note deleted");
      }
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete note");
    } finally {
      setSubmitting(false);
    }
  };

  const showScopeSelector = createMode === "choose-scope" && !editingNote;
  const showOrganizationSelect =
    (createMode === "organization-only" || scope === "organization") &&
    !editingNote;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search notes..."
                className="pl-9"
                aria-label="Search notes"
              />
            </div>
            {onRefresh ? (
              <Button
                type="button"
                variant="outline"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={openCreateDialog}
              disabled={!allowCreate}
              title={
                allowCreate
                  ? "Create a new note"
                  : "You do not have permission to create notes here"
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              New Note
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Card key={item}>
                  <CardContent className="space-y-3 p-5">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{emptyStateTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {searchTerm.trim() ? "No notes match your search." : emptyStateDescription}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredNotes.map((note) => {
                const manageable = canManageNote(note);

                return (
                  <Card key={note.id}>
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">{note.title}</h3>
                            <Badge variant="outline">
                              {note.scope === "personal" ? (
                                <>
                                  <Lock className="mr-1 h-3 w-3" />
                                  Personal
                                </>
                              ) : (
                                <>
                                  <Users className="mr-1 h-3 w-3" />
                                  Organization
                                </>
                              )}
                            </Badge>
                            {note.organizationName ? (
                              <Badge variant="secondary">{note.organizationName}</Badge>
                            ) : null}
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                            {note.content || "No content"}
                          </p>
                        </div>
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Note actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {manageable ? (
                                <>
                                  <DropdownMenuItem onClick={() => openEditDialog(note)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteTarget(note)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem disabled>
                                  <Lock className="mr-2 h-4 w-4" />
                                  Read only
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          Updated {formatTimestamp(note.updatedAt)}
                          {note.updatedBy?.name || note.updatedBy?.email
                            ? ` by ${note.updatedBy?.name || note.updatedBy?.email}`
                            : ""}
                        </span>
                        <span>Created {formatTimestamp(note.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Note" : "Create Note"}</DialogTitle>
            <DialogDescription>
              {editingNote
                ? "Update the note title or content."
                : "Create a note and choose whether it stays personal or belongs to an organization."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {showScopeSelector ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="note-scope">
                  Note Scope
                </label>
                <Select
                  value={scope}
                  onValueChange={(value) => setScope(value as NoteScope)}
                >
                  <SelectTrigger id="note-scope">
                    <SelectValue placeholder="Select note scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem
                      value="organization"
                      disabled={manageableOrganizations.length === 0}
                    >
                      Organization
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {showOrganizationSelect ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="note-organization">
                  Organization
                </label>
                <Select value={organizationId} onValueChange={setOrganizationId}>
                  <SelectTrigger id="note-organization">
                    <SelectValue placeholder="Select an organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {manageableOrganizations.map((organization) => (
                      <SelectItem
                        key={organization.organizationId}
                        value={organization.organizationId}
                      >
                        {organization.organizationName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="note-title">
                Title
              </label>
              <Input
                id="note-title"
                value={titleValue}
                onChange={(event) => setTitleValue(event.target.value)}
                placeholder="Quarterly checklist"
                maxLength={160}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="note-content">
                Content
              </label>
              <Textarea
                id="note-content"
                value={contentValue}
                onChange={(event) => setContentValue(event.target.value)}
                placeholder="Write your notes here..."
                className="min-h-[220px]"
                maxLength={50000}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : editingNote ? "Save Changes" : "Create Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium">{deleteTarget?.title}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={submitting}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
