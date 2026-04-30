import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notesService } from "@/services/notesService";
import type { CreateNoteInput } from "@/types/notes";

export const notesKeys = {
  all: ["notes"] as const,
  personal: () => [...notesKeys.all, "personal"] as const,
  organizations: (organizationId?: string | null) =>
    [...notesKeys.all, "organizations", organizationId ?? "all"] as const,
  organizationDetail: (organizationId: string) =>
    [...notesKeys.all, "organization-detail", organizationId] as const,
};

export function usePersonalNotes() {
  return useQuery({
    queryKey: notesKeys.personal(),
    queryFn: async () => {
      const result = await notesService.getPersonalNotes();
      if (!result.success) {
        throw new Error(result.error || "Failed to load personal notes");
      }

      return result.notes || [];
    },
    staleTime: 60_000,
  });
}

export function useOrganizationNotesOverview(organizationId?: string | null) {
  return useQuery({
    queryKey: notesKeys.organizations(organizationId),
    queryFn: async () => {
      const result = await notesService.getOrganizationNotes(organizationId || undefined);
      if (!result.success) {
        throw new Error(result.error || "Failed to load organization notes");
      }

      return result.data || { organizations: [], notes: [] };
    },
    staleTime: 60_000,
  });
}

export function useOrganizationNotesDetail(organizationId: string) {
  return useQuery({
    queryKey: notesKeys.organizationDetail(organizationId),
    queryFn: async () => {
      const result = await notesService.getSingleOrganizationNotes(organizationId);
      if (!result.success) {
        throw new Error(result.error || "Failed to load organization notes");
      }

      return result.data || { organization: null, notes: [] };
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });
}

function invalidateAllNotes(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: notesKeys.all });
}

export function useCreatePersonalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      const result = await notesService.createPersonalNote(input);
      if (!result.success) {
        throw new Error(result.error || "Failed to create personal note");
      }

      return result.note;
    },
    onSuccess: () => {
      invalidateAllNotes(queryClient);
    },
  });
}

export function useUpdatePersonalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      noteId,
      input,
    }: {
      noteId: string;
      input: CreateNoteInput;
    }) => {
      const result = await notesService.updatePersonalNote(noteId, input);
      if (!result.success) {
        throw new Error(result.error || "Failed to update personal note");
      }

      return result.note;
    },
    onSuccess: () => {
      invalidateAllNotes(queryClient);
    },
  });
}

export function useDeletePersonalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const result = await notesService.deletePersonalNote(noteId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete personal note");
      }

      return noteId;
    },
    onSuccess: () => {
      invalidateAllNotes(queryClient);
    },
  });
}

export function useCreateOrganizationNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      input,
    }: {
      organizationId: string;
      input: CreateNoteInput;
    }) => {
      const result = await notesService.createOrganizationNote(organizationId, input);
      if (!result.success) {
        throw new Error(result.error || "Failed to create organization note");
      }

      return result.note;
    },
    onSuccess: () => {
      invalidateAllNotes(queryClient);
    },
  });
}

export function useUpdateOrganizationNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      noteId,
      input,
    }: {
      organizationId: string;
      noteId: string;
      input: CreateNoteInput;
    }) => {
      const result = await notesService.updateOrganizationNote(
        organizationId,
        noteId,
        input,
      );
      if (!result.success) {
        throw new Error(result.error || "Failed to update organization note");
      }

      return result.note;
    },
    onSuccess: () => {
      invalidateAllNotes(queryClient);
    },
  });
}

export function useDeleteOrganizationNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      noteId,
    }: {
      organizationId: string;
      noteId: string;
    }) => {
      const result = await notesService.deleteOrganizationNote(organizationId, noteId);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete organization note");
      }

      return noteId;
    },
    onSuccess: () => {
      invalidateAllNotes(queryClient);
    },
  });
}
