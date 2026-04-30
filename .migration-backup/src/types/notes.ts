export type NoteScope = "personal" | "organization";

export interface NoteActor {
  id: string | null;
  name: string | null;
  email: string | null;
}

export interface Note {
  id: string;
  scope: NoteScope;
  organizationId: string | null;
  organizationName: string | null;
  ownerUserId: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: NoteActor | null;
  updatedBy: NoteActor | null;
}

export interface OrganizationNoteMembership {
  organizationId: string;
  organizationName: string;
  canManage: boolean;
}

export interface CreateNoteInput {
  title: string;
  content: string;
}

export interface OrganizationNotesOverview {
  organizations: OrganizationNoteMembership[];
  notes: Note[];
}
