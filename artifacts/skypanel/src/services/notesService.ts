import { apiClient } from "@/lib/api";
import type {
  CreateNoteInput,
  Note,
  OrganizationNotesOverview,
} from "@/types/notes";

class NotesService {
  async getPersonalNotes(): Promise<{ success: boolean; notes?: Note[]; error?: string }> {
    try {
      const response = await apiClient.get<{ notes: Note[] }>("/notes/personal");
      return { success: true, notes: response.notes || [] };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to load personal notes",
      };
    }
  }

  async createPersonalNote(
    input: CreateNoteInput,
  ): Promise<{ success: boolean; note?: Note; error?: string }> {
    try {
      const response = await apiClient.post<{ note: Note }>("/notes/personal", input);
      return { success: true, note: response.note };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to create personal note",
      };
    }
  }

  async updatePersonalNote(
    noteId: string,
    input: CreateNoteInput,
  ): Promise<{ success: boolean; note?: Note; error?: string }> {
    try {
      const response = await apiClient.put<{ note: Note }>(
        `/notes/personal/${noteId}`,
        input,
      );
      return { success: true, note: response.note };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to update personal note",
      };
    }
  }

  async deletePersonalNote(
    noteId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.delete(`/notes/personal/${noteId}`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to delete personal note",
      };
    }
  }

  async getOrganizationNotes(
    organizationId?: string,
  ): Promise<{ success: boolean; data?: OrganizationNotesOverview; error?: string }> {
    try {
      const query = organizationId
        ? `/notes/organizations?organizationId=${encodeURIComponent(organizationId)}`
        : "/notes/organizations";
      const response = await apiClient.get<OrganizationNotesOverview>(query);
      return { success: true, data: response };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to load organization notes",
      };
    }
  }

  async getSingleOrganizationNotes(
    organizationId: string,
  ): Promise<{
    success: boolean;
    data?: {
      organization: OrganizationNotesOverview["organizations"][number];
      notes: Note[];
    };
    error?: string;
  }> {
    try {
      const response = await apiClient.get<{
        organization: OrganizationNotesOverview["organizations"][number];
        notes: Note[];
      }>(`/organizations/${organizationId}/notes`);
      return { success: true, data: response };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to load organization notes",
      };
    }
  }

  async createOrganizationNote(
    organizationId: string,
    input: CreateNoteInput,
  ): Promise<{ success: boolean; note?: Note; error?: string }> {
    try {
      const response = await apiClient.post<{ note: Note }>(
        `/organizations/${organizationId}/notes`,
        input,
      );
      return { success: true, note: response.note };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to create organization note",
      };
    }
  }

  async updateOrganizationNote(
    organizationId: string,
    noteId: string,
    input: CreateNoteInput,
  ): Promise<{ success: boolean; note?: Note; error?: string }> {
    try {
      const response = await apiClient.put<{ note: Note }>(
        `/organizations/${organizationId}/notes/${noteId}`,
        input,
      );
      return { success: true, note: response.note };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to update organization note",
      };
    }
  }

  async deleteOrganizationNote(
    organizationId: string,
    noteId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await apiClient.delete(`/organizations/${organizationId}/notes/${noteId}`);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to delete organization note",
      };
    }
  }
}

export const notesService = new NotesService();
