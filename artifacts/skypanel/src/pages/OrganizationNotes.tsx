import React, { useMemo, useState } from "react";
import { Building2, Users } from "lucide-react";

import { NotesBoard } from "@/components/notes/NotesBoard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateOrganizationNote,
  useDeleteOrganizationNote,
  useOrganizationNotesOverview,
  useUpdateOrganizationNote,
} from "@/hooks/useNotes";
import type { Note } from "@/types/notes";

export default function OrganizationNotes() {
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("all");
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useOrganizationNotesOverview(
    selectedOrganizationId === "all" ? undefined : selectedOrganizationId,
  );
  const createOrganizationNote = useCreateOrganizationNote();
  const updateOrganizationNote = useUpdateOrganizationNote();
  const deleteOrganizationNote = useDeleteOrganizationNote();

  const selectedOrganization = useMemo(
    () =>
      data?.organizations.find(
        (organization) => organization.organizationId === selectedOrganizationId,
      ) || null,
    [data?.organizations, selectedOrganizationId],
  );

  const canCreate =
    selectedOrganizationId === "all"
      ? Boolean(data?.organizations.some((organization) => organization.canManage))
      : Boolean(selectedOrganization?.canManage);

  const canManageNote = (note: Note) =>
    Boolean(
      data?.organizations.find(
        (organization) => organization.organizationId === note.organizationId,
      )?.canManage,
    );

  if (error instanceof Error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/30 p-6 md:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <Badge variant="secondary">
            <Users className="mr-2 h-3 w-3" />
            Shared Workspace
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Organization Notes
          </h1>
          <p className="text-muted-foreground">
            Review shared notes across your teams and maintain the ones you are
            allowed to manage.
          </p>
        </div>
        <Building2 className="absolute right-8 top-8 h-24 w-24 text-muted/30" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Filter by Organization</h2>
            <p className="text-sm text-muted-foreground">
              Narrow the shared note list to a single organization when you need
              a focused view.
            </p>
          </div>
          <div className="w-full sm:w-80">
            <Select
              value={selectedOrganizationId}
              onValueChange={setSelectedOrganizationId}
            >
              <SelectTrigger>
                <SelectValue placeholder="All organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All organizations</SelectItem>
                {(data?.organizations || []).map((organization) => (
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
        </CardContent>
      </Card>

      <NotesBoard
        title="Shared Notes"
        description={
          selectedOrganization
            ? `Shared notes for ${selectedOrganization.organizationName}.`
            : "Browse notes shared across all of your organizations."
        }
        notes={data?.notes || []}
        isLoading={isLoading}
        isRefreshing={isFetching}
        allowCreate={canCreate}
        createMode="organization-only"
        defaultOrganizationId={
          selectedOrganizationId === "all" ? null : selectedOrganizationId
        }
        organizationOptions={data?.organizations || []}
        onRefresh={() => {
          void refetch();
        }}
        onCreatePersonal={async () => {
          throw new Error("Personal notes are not available in this view");
        }}
        onCreateOrganization={(organizationId, input) =>
          createOrganizationNote.mutateAsync({ organizationId, input })
        }
        onUpdatePersonal={async () => {
          throw new Error("Personal notes are not available in this view");
        }}
        onUpdateOrganization={(organizationId, noteId, input) =>
          updateOrganizationNote.mutateAsync({ organizationId, noteId, input })
        }
        onDeletePersonal={async () => {
          throw new Error("Personal notes are not available in this view");
        }}
        onDeleteOrganization={(organizationId, noteId) =>
          deleteOrganizationNote.mutateAsync({ organizationId, noteId })
        }
        canManageNote={canManageNote}
        emptyStateTitle="No organization notes yet"
        emptyStateDescription="Create a shared note for operational runbooks, account context, or internal reminders."
      />
    </div>
  );
}
