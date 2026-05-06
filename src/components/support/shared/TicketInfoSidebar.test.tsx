import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { TicketInfoSidebar } from "@/components/support/shared/TicketInfoSidebar";
import type { SupportTicket } from "@/types/support";

vi.mock("@/components/VPS/SSHTerminal", () => ({
  SSHTerminal: () => null,
}));

const buildTicket = (
  overrides: Partial<SupportTicket> = {},
): SupportTicket => ({
  id: "ticket-1",
  subject: "Hosting issue",
  message: "Please help with hosting",
  status: "open",
  priority: "medium",
  category: "general",
  created_at: "2026-05-06T12:00:00.000Z",
  updated_at: "2026-05-06T12:30:00.000Z",
  hosting_subscription_id: "sub-1",
  hosting_subscription_is_active: true,
  hosting_plan_is_active: true,
  hosting_domain: "example.com",
  hosting_plan_name: "Starter",
  messages: [],
  ...overrides,
});

const renderSidebar = (ticket: SupportTicket) => {
  render(
    <MemoryRouter>
      <TicketInfoSidebar ticket={ticket} walletBalance={100} isAdmin={true} />
    </MemoryRouter>,
  );
};

describe("TicketInfoSidebar hosting actions", () => {
  it("shows View hosting when subscription and plan are active", () => {
    renderSidebar(buildTicket());

    expect(
      screen.getByRole("link", { name: /view hosting/i }),
    ).toBeTruthy();
  });

  it("hides View hosting when the hosting plan is inactive", () => {
    renderSidebar(
      buildTicket({
        hosting_plan_is_active: false,
      }),
    );

    expect(
      screen.queryByRole("link", { name: /view hosting/i }),
    ).toBeNull();
  });

  it("hides View hosting when the hosting subscription is inactive", () => {
    renderSidebar(
      buildTicket({
        hosting_subscription_is_active: false,
      }),
    );

    expect(
      screen.queryByRole("link", { name: /view hosting/i }),
    ).toBeNull();
  });

  it("shows created and last updated timestamps", () => {
    renderSidebar(buildTicket());
    expect(screen.getByText(/last updated/i)).toBeTruthy();
    expect(screen.getByText(/created/i)).toBeTruthy();
    expect(screen.getAllByText(/2026/i).length).toBeGreaterThan(0);
  });

  it("keeps related hosting context visible when View hosting is hidden", () => {
    renderSidebar(
      buildTicket({
        hosting_subscription_is_active: false,
        hosting_plan_is_active: false,
      }),
    );

    expect(screen.getByText(/related hosting/i)).toBeTruthy();
    expect(screen.getAllByText(/example\.com/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("link", { name: /view hosting/i }),
    ).toBeNull();
  });
});
