import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NotesBoard } from "@/components/notes/NotesBoard";
import type { Note } from "@/types/notes";

const note: Note = {
  id: "note-1",
  scope: "personal",
  organizationId: null,
  organizationName: null,
  ownerUserId: "user-1",
  title: "Escaped note",
  content: `<img src=x onerror="alert('xss')">`,
  createdAt: "2026-04-10T12:00:00.000Z",
  updatedAt: "2026-04-10T12:00:00.000Z",
  createdBy: {
    id: "user-1",
    name: "User One",
    email: "user@example.com",
  },
  updatedBy: {
    id: "user-1",
    name: "User One",
    email: "user@example.com",
  },
};

describe("NotesBoard", () => {
  it("renders note content as plain text instead of injecting HTML", () => {
    const { container } = render(
      <NotesBoard
        title="Notes"
        description="Safe notes"
        notes={[note]}
        isLoading={false}
        allowCreate
        createMode="personal-only"
        onCreatePersonal={vi.fn()}
        onCreateOrganization={vi.fn()}
        onUpdatePersonal={vi.fn()}
        onUpdateOrganization={vi.fn()}
        onDeletePersonal={vi.fn()}
        onDeleteOrganization={vi.fn()}
        canManageNote={() => true}
        emptyStateTitle="No notes"
        emptyStateDescription="Nothing here"
      />,
    );

    expect(screen.getByText("Escaped note")).toBeTruthy();
    expect(screen.getByText(`<img src=x onerror="alert('xss')">`)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
});
