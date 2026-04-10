import React from "react";

import { NotesBoard } from "@/components/notes/NotesBoard";
import {
  useCreateOrganizationNote,
  useDeleteOrganizationNote,
  useOrganizationNotesDetail,
  useUpdateOrganizationNote,
} from "@/hooks/useNotes";

interface OrganizationNotesSectionProps {
  organizationId: string;
  organizationName: string;
}

export function OrganizationNotesSection({
  organizationId,
  organizationName,
}: OrganizationNotesSectionProps) {
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useOrganizationNotesDetail(organizationId);
  const createOrganizationNote = useCreateOrganizationNote();
  const updateOrganizationNote = useUpdateOrganizationNote();
  const deleteOrganizationNote = useDeleteOrganizationNote();

  if (error instanceof Error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        {error.message}
      </div>
    );
  }

  const organization = data?.organization ?? {
    organizationId,
    organizationName,
    canManage: false,
  };

  return (
    <NotesBoard
      title="Organization Notes"
      description={`Shared notes for ${organizationName}.`}
      notes={data?.notes || []}
      isLoading={isLoading}
      isRefreshing={isFetching}
      allowCreate={organization.canManage}
      createMode="organization-only"
      defaultOrganizationId={organizationId}
      organizationOptions={[organization]}
      onRefresh={() => {
        void refetch();
      }}
      onCreatePersonal={async () => {
        throw new Error("Personal notes are not available in this view");
      }}
      onCreateOrganization={(targetOrganizationId, input) =>
        createOrganizationNote.mutateAsync({
          organizationId: targetOrganizationId,
          input,
        })
      }
      onUpdatePersonal={async () => {
        throw new Error("Personal notes are not available in this view");
      }}
      onUpdateOrganization={(targetOrganizationId, noteId, input) =>
        updateOrganizationNote.mutateAsync({
          organizationId: targetOrganizationId,
          noteId,
          input,
        })
      }
      onDeletePersonal={async () => {
        throw new Error("Personal notes are not available in this view");
      }}
      onDeleteOrganization={(targetOrganizationId, noteId) =>
        deleteOrganizationNote.mutateAsync({
          organizationId: targetOrganizationId,
          noteId,
        })
      }
      canManageNote={() => organization.canManage}
      emptyStateTitle="No organization notes yet"
      emptyStateDescription="Create a shared note for runbooks, checklists, or internal reminders."
    />
  );
}
