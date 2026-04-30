import React from "react";
import { Lock, PlusCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { NotesBoard } from "@/components/notes/NotesBoard";
import {
  useCreateOrganizationNote,
  useCreatePersonalNote,
  useDeleteOrganizationNote,
  useDeletePersonalNote,
  useOrganizationNotesOverview,
  usePersonalNotes,
  useUpdateOrganizationNote,
  useUpdatePersonalNote,
} from "@/hooks/useNotes";

export default function PersonalNotes() {
  const {
    data: personalNotes = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = usePersonalNotes();
  const {
    data: organizationOverview,
    isFetching: isRefreshingOrganizations,
    refetch: refetchOrganizations,
  } = useOrganizationNotesOverview();
  const createPersonalNote = useCreatePersonalNote();
  const updatePersonalNote = useUpdatePersonalNote();
  const deletePersonalNote = useDeletePersonalNote();
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

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/30 p-6 md:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <Badge variant="secondary">
            <Lock className="mr-2 h-3 w-3" />
            Private Workspace
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Personal Notes
          </h1>
          <p className="text-muted-foreground">
            Keep personal reminders, incident drafts, and private working notes
            separate from your shared organization records.
          </p>
        </div>
        <PlusCircle className="absolute right-8 top-8 h-24 w-24 text-muted/30" />
      </div>

      <NotesBoard
        title="Your Personal Notes"
        description="Create a note for yourself, or switch the create flow to organization scope when you need to publish something shared."
        notes={personalNotes}
        isLoading={isLoading}
        isRefreshing={isFetching || isRefreshingOrganizations}
        allowCreate
        createMode="choose-scope"
        initialCreateScope="personal"
        organizationOptions={organizationOverview?.organizations || []}
        onRefresh={() => {
          void refetch();
          void refetchOrganizations();
        }}
        onCreatePersonal={(input) => createPersonalNote.mutateAsync(input)}
        onCreateOrganization={(organizationId, input) =>
          createOrganizationNote.mutateAsync({ organizationId, input })
        }
        onUpdatePersonal={(noteId, input) =>
          updatePersonalNote.mutateAsync({ noteId, input })
        }
        onUpdateOrganization={(organizationId, noteId, input) =>
          updateOrganizationNote.mutateAsync({ organizationId, noteId, input })
        }
        onDeletePersonal={(noteId) => deletePersonalNote.mutateAsync(noteId)}
        onDeleteOrganization={(organizationId, noteId) =>
          deleteOrganizationNote.mutateAsync({ organizationId, noteId })
        }
        canManageNote={(note) => note.scope === "personal"}
        emptyStateTitle="No personal notes yet"
        emptyStateDescription="Use personal notes for private reminders, checklists, or draft content that should stay tied only to your account."
      />
    </div>
  );
}
