import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TicketInfoSidebar } from "./TicketInfoSidebar";
import { SupportTicket } from "@/types/support";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseTicket: SupportTicket = {
  id: "ticket-1",
  subject: "Shared org issue",
  status: "open",
  priority: "medium",
  category: "technical",
  created_at: "2026-01-01T10:00:00.000Z",
  updated_at: "2026-01-01T10:00:00.000Z",
  messages: [],
  organization_id: "org-1",
  organization_name: "Acme Cloud",
  organization_slug: "acme-cloud",
};

describe("TicketInfoSidebar", () => {
  beforeEach(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  it("shows the organization id instead of the slug for requester views", () => {
    render(
      <TicketInfoSidebar
        ticket={baseTicket}
        walletBalance={42}
        showRequester={true}
        clientName="Coworker Example"
        clientEmail="coworker@example.com"
      />,
    );

    expect(screen.getByText("Acme Cloud")).toBeInTheDocument();
    expect(screen.getByText("Organization ID")).toBeInTheDocument();
    expect(screen.getByText("org-1")).toBeInTheDocument();
    expect(screen.queryByText("@acme-cloud")).not.toBeInTheDocument();
  });

  it("shows the organization id instead of the slug for admin views", () => {
    render(
      <TicketInfoSidebar
        ticket={baseTicket}
        walletBalance={42}
        isAdmin={true}
        clientName="Coworker Example"
        clientEmail="coworker@example.com"
      />,
    );

    expect(screen.getByText("Client Information")).toBeInTheDocument();
    expect(screen.getByText("Organization ID")).toBeInTheDocument();
    expect(screen.getByText("org-1")).toBeInTheDocument();
    expect(screen.queryByText("@acme-cloud")).not.toBeInTheDocument();
  });

  it("copies the organization id from the sidebar button", async () => {
    render(
      <TicketInfoSidebar
        ticket={baseTicket}
        walletBalance={42}
        showRequester={true}
        clientName="Coworker Example"
        clientEmail="coworker@example.com"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy organization id/i }));

    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith("org-1");
  });
});