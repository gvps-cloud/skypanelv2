import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

import { UserSupportView } from "./UserSupportView";
import { renderWithAuth } from "@/test-utils";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

class MockEventSource {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("UserSupportView attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows requester and organization context for shared tickets and keeps coworker replies on the non-current-user side", async () => {
    vi.mocked(global.fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/api/payments/wallet/balance") && method === "GET") {
        return jsonResponse({ success: true, balance: 42 });
      }

      if (url.endsWith("/api/vps") && method === "GET") {
        return jsonResponse({ instances: [] });
      }

      if (url.endsWith("/api/support/tickets") && method === "GET") {
        return jsonResponse({
          tickets: [
            {
              id: "ticket-1",
              subject: "Shared org issue",
              message: "The shared server keeps restarting.",
              status: "open",
              priority: "medium",
              category: "technical",
              created_at: "2026-01-01T10:00:00.000Z",
              updated_at: "2026-01-01T10:00:00.000Z",
              has_staff_reply: false,
              vps_id: "vps-1",
              vps_label: "Shared VPS",
              organization_id: "org-1",
              organization_name: "Acme Cloud",
              organization_slug: "acme-cloud",
              created_by: "user-2",
              creator: {
                id: "user-2",
                name: "Coworker Example",
                email: "coworker@example.com",
                displayName: "Coworker Example",
              },
            },
          ],
        });
      }

      if (url.endsWith("/api/support/tickets/ticket-1/replies") && method === "GET") {
        return jsonResponse({
          replies: [
            {
              id: "reply-1",
              ticket_id: "ticket-1",
              sender_type: "user",
              sender_user_id: "user-2",
              sender_name: "Coworker Example",
              message: "Follow-up from coworker",
              created_at: "2026-01-01T11:00:00.000Z",
            },
            {
              id: "reply-2",
              ticket_id: "ticket-1",
              sender_type: "admin",
              sender_name: "Staff Member",
              message: "We are investigating.",
              created_at: "2026-01-01T11:15:00.000Z",
            },
          ],
        });
      }

      throw new Error(`Unhandled request: ${method} ${url}`);
    });

    renderWithAuth(<UserSupportView token="mock-jwt-token" />, {
      user: {
        id: "user-1",
        email: "viewer@example.com",
        firstName: "Viewer",
        lastName: "User",
        role: "user",
        emailVerified: true,
        organizationId: "org-1",
      },
      token: "mock-jwt-token",
    });

    expect(await screen.findByText("Coworker Example")).toBeInTheDocument();
    expect(screen.getByText(/Acme Cloud/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Shared org issue/i }));

    expect(await screen.findByText("Follow-up from coworker")).toBeInTheDocument();
    expect(screen.queryByText(/^You$/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/coworker@example\.com/i).length).toBeGreaterThan(0);

    const coworkerReply = screen.getByText("Follow-up from coworker");
    const bubbleRoot = coworkerReply.closest(".group");

    expect(bubbleRoot).toHaveClass("flex-row");
    expect(bubbleRoot).not.toHaveClass("flex-row-reverse");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/support/tickets/ticket-1/replies"),
        expect.any(Object),
      );
    });
  });
});